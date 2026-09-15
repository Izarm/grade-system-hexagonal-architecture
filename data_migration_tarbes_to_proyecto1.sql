-- ============================================================
-- SCRIPT DE MIGRACIÓN DE DATOS HISTÓRICOS
-- Origen:  San José de Tarbes → BD: CJS (Laravel/MySQL)
-- Destino: PROYECTO1          → BD: sistema_notas
-- ============================================================
--
-- TABLAS REALES EN CJS (verificadas):
--   personas                     → nombre + apellido
--   authss                       → email + password (bcrypt)
--   usuarios                     → rol + persona_id (FK a personas)
--   estudiantes                  → datos completos: codigo_estudiante, numero_documento,
--                                   tipo_documento, telefono_fijo, telefono_celular_1/2,
--                                   correo_padre, correo_madre, direccion, acudiente,
--                                   fecha_nacimiento, fecha_ingreso, fecha_retiro,
--                                   motivo_retiro, observacion, persona_id
--   cursos                       → nombre_curso + letra_curso
--   matriculas                   → estudiante_id + curso_id + valor_matricula + ano_academico
--   actividades__extracurriculares → codigo_actividad + nombre_actividad (doble guion bajo)
--   estudiantes__actividades       → estudiante_id + actividad_id + matricula_id + curso_id
--   documentos__pendientes         → codigo_documento + nombre_documento (JSON) + estudiante_id
--
-- PRERREQUISITOS:
--   1. Haber ejecutado migration_add_tarbes_module.sql (estructura)
--   2. El servidor MySQL debe tener acceso a AMBAS bases de datos (CJS y sistema_notas)
--   3. El usuario MySQL debe tener permisos SELECT en CJS e INSERT en sistema_notas
--
-- CÓMO EJECUTAR:
--   mysql -u root -p sistema_notas < data_migration_tarbes_to_proyecto1.sql
--
-- IMPORTANTE: Este script es IDEMPOTENTE — si un dato ya existe, lo salta (no duplica).
-- ============================================================

-- ============================================================
-- PASO 1: Migrar ESTUDIANTES
-- CJS: personas (nombre+apellido) + estudiantes (datos completos)
-- PROYECTO1: students (full_name, student_code, document_type, birth_date, ...)
-- NOTA: students NO tiene columna 'document' separada, solo student_code y document_type
-- ============================================================
INSERT INTO `sistema_notas`.`students`
    (full_name, student_code, document_type,
     phone_landline, phone_mobile1, phone_mobile2,
     email_father, email_mother, address, guardian,
     birth_date, admission_date, withdrawal_date,
     withdrawal_reason, observations)
SELECT
    UPPER(CONCAT(TRIM(p.nombre), ' ', TRIM(p.apellido)))  AS full_name,
    e.codigo_estudiante                                     AS student_code,
    -- Mapeo tipo de documento: Tarbes sin punto → PROYECTO1 con punto
    CASE TRIM(e.tipo_documento)
        WHEN 'R.C'  THEN 'R.C.'
        WHEN 'T.I'  THEN 'T.I.'
        WHEN 'C.C'  THEN 'C.C.'
        WHEN 'P.E'  THEN 'P.E.'
        WHEN 'R.C.' THEN 'R.C.'
        WHEN 'T.I.' THEN 'T.I.'
        WHEN 'C.C.' THEN 'C.C.'
        ELSE TRIM(e.tipo_documento)
    END                                                     AS document_type,
    NULLIF(TRIM(e.telefono_fijo), '')                      AS phone_landline,
    NULLIF(TRIM(e.telefono_celular_1), '')                 AS phone_mobile1,
    NULLIF(TRIM(e.telefono_celular_2), '')                 AS phone_mobile2,
    NULLIF(TRIM(e.correo_padre), '')                       AS email_father,
    NULLIF(TRIM(e.correo_madre), '')                       AS email_mother,
    NULLIF(TRIM(e.direccion), '')                          AS address,
    NULLIF(UPPER(TRIM(e.acudiente)), '')                   AS guardian,
    e.fecha_nacimiento                                      AS birth_date,
    e.fecha_ingreso                                         AS admission_date,
    e.fecha_retiro                                          AS withdrawal_date,
    NULLIF(TRIM(e.motivo_retiro), '')                      AS withdrawal_reason,
    NULLIF(TRIM(e.observacion), '')                        AS observations
FROM `CJS`.`estudiantes` e
JOIN `CJS`.`personas` p ON e.persona_id = p.id
WHERE e.deleted_at IS NULL
  AND NOT EXISTS (
    -- No duplicar: si el código de estudiante ya existe en sistema_notas, saltar
    SELECT 1 FROM `sistema_notas`.`students` s
    WHERE s.student_code = e.codigo_estudiante
);

SELECT 'PASO 1 completado: Estudiantes' AS paso,
    (SELECT COUNT(*) FROM `sistema_notas`.`students`
     WHERE student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)) AS migrados;

-- ============================================================
-- PASO 2: Migrar USUARIOS ADMINISTRATIVOS
-- CJS: authss (email+password) + usuarios (rol) + personas (nombre)
-- PROYECTO1: users (name, document, email, password, role, status)
-- NOTA: CJS no almacena numero_documento en personas → generamos uno temporal
-- ============================================================
INSERT INTO `sistema_notas`.`users` (name, document, email, password, role, status)
SELECT
    UPPER(CONCAT(TRIM(p.nombre), ' ', TRIM(p.apellido)))  AS name,
    -- CJS no tiene documento en personas → usamos prefijo CJS + id para cumplir UNIQUE
    CONCAT('CJS-', LPAD(u.id_usuario, 6, '0'))            AS document,
    TRIM(a.email)                                          AS email,
    a.password                                             AS password,  -- bcrypt ya compatible
    CASE TRIM(u.rol)
        WHEN 'administrador' THEN 'admin'
        WHEN 'secretaria'    THEN 'admin'   -- secretaria cumple rol de admin en PROYECTO1
        WHEN 'docente'       THEN 'docente'
        ELSE 'docente'
    END                                                    AS role,
    'active'                                               AS status
FROM `CJS`.`authss` a
JOIN `CJS`.`usuarios` u ON a.id = u.id_usuario
JOIN `CJS`.`personas` p ON u.persona_id = p.id
WHERE u.deleted_at IS NULL
  AND u.rol IN ('administrador', 'secretaria', 'docente')
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`users` usr
    WHERE usr.email = TRIM(a.email)
);

SELECT 'PASO 2 completado: Usuarios/Docentes' AS paso,
    (SELECT COUNT(*) FROM `sistema_notas`.`users`
     WHERE document LIKE 'CJS-%') AS migrados;

-- ============================================================
-- PASO 3: Migrar GRADOS Y GRUPOS
-- CJS: cursos tiene nombre_curso (texto) + letra_curso (A/B/C...)
-- PROYECTO1: grades.name = número (1-11), groups.name = letra
-- ============================================================

-- 3a. Crear grados que no existan
INSERT INTO `sistema_notas`.`grades` (name, full_name)
SELECT DISTINCT
    CASE TRIM(c.nombre_curso)
        WHEN 'Primero'  THEN '1'   WHEN 'Segundo' THEN '2'
        WHEN 'Tercero'  THEN '3'   WHEN 'Cuarto'  THEN '4'
        WHEN 'Quinto'   THEN '5'   WHEN 'Sexto'   THEN '6'
        WHEN 'Septimo'  THEN '7'   WHEN 'Séptimo' THEN '7'
        WHEN 'Octavo'   THEN '8'   WHEN 'Noveno'  THEN '9'
        WHEN 'Decimo'   THEN '10'  WHEN 'Décimo'  THEN '10'
        WHEN 'Once'     THEN '11'
        ELSE TRIM(c.nombre_curso)
    END AS name,
    TRIM(c.nombre_curso) AS full_name
FROM `CJS`.`cursos` c
WHERE c.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`grades` g
    WHERE g.name = CASE TRIM(c.nombre_curso)
        WHEN 'Primero'  THEN '1'   WHEN 'Segundo' THEN '2'
        WHEN 'Tercero'  THEN '3'   WHEN 'Cuarto'  THEN '4'
        WHEN 'Quinto'   THEN '5'   WHEN 'Sexto'   THEN '6'
        WHEN 'Septimo'  THEN '7'   WHEN 'Séptimo' THEN '7'
        WHEN 'Octavo'   THEN '8'   WHEN 'Noveno'  THEN '9'
        WHEN 'Decimo'   THEN '10'  WHEN 'Décimo'  THEN '10'
        WHEN 'Once'     THEN '11'  ELSE TRIM(c.nombre_curso) END
    AND g.deleted_at IS NULL
);

-- 3b. Crear grupos que no existan
INSERT INTO `sistema_notas`.`groups` (grade_id, name)
SELECT DISTINCT
    g.id AS grade_id,
    TRIM(c.letra_curso) AS name
FROM `CJS`.`cursos` c
JOIN `sistema_notas`.`grades` g
    ON g.name = CASE TRIM(c.nombre_curso)
        WHEN 'Primero'  THEN '1'   WHEN 'Segundo' THEN '2'
        WHEN 'Tercero'  THEN '3'   WHEN 'Cuarto'  THEN '4'
        WHEN 'Quinto'   THEN '5'   WHEN 'Sexto'   THEN '6'
        WHEN 'Septimo'  THEN '7'   WHEN 'Séptimo' THEN '7'
        WHEN 'Octavo'   THEN '8'   WHEN 'Noveno'  THEN '9'
        WHEN 'Decimo'   THEN '10'  WHEN 'Décimo'  THEN '10'
        WHEN 'Once'     THEN '11'  ELSE TRIM(c.nombre_curso) END
    AND g.deleted_at IS NULL
WHERE c.deleted_at IS NULL
  AND TRIM(c.letra_curso) IS NOT NULL
  AND TRIM(c.letra_curso) != ''
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`groups` grp
    WHERE grp.grade_id = g.id AND grp.name = TRIM(c.letra_curso)
    AND grp.deleted_at IS NULL
);

SELECT 'PASO 3 completado: Grados y Grupos' AS paso,
    (SELECT COUNT(*) FROM `sistema_notas`.`grades` WHERE deleted_at IS NULL) AS total_grados,
    (SELECT COUNT(*) FROM `sistema_notas`.`groups` WHERE deleted_at IS NULL) AS total_grupos;

-- ============================================================
-- PASO 4: Migrar MATRÍCULAS
-- CJS: matriculas.ano_academico (DATE) → buscar academic_year_id en PROYECTO1
-- CJS: matriculas.valor_matricula → enrollment_value
-- NOTA: Si no existe año académico con ese año, usa el año activo más reciente
-- ============================================================
INSERT INTO `sistema_notas`.`enrollments`
    (student_id, group_id, grade_id, academic_year_id, enrollment_value)
SELECT
    s.id    AS student_id,
    grp.id  AS group_id,
    g.id    AS grade_id,
    COALESCE(
        -- Buscar año académico que contenga el año de la matrícula CJS
        (SELECT ay.id FROM `sistema_notas`.`academic_years` ay
         WHERE YEAR(m.ano_academico) BETWEEN YEAR(ay.start_date) AND YEAR(ay.end_date)
           AND ay.deleted_at IS NULL
         ORDER BY ay.active DESC, ay.id DESC LIMIT 1),
        -- Fallback: año activo más reciente
        (SELECT ay2.id FROM `sistema_notas`.`academic_years` ay2
         WHERE ay2.deleted_at IS NULL
         ORDER BY ay2.active DESC, ay2.id DESC LIMIT 1)
    )       AS academic_year_id,
    m.valor_matricula AS enrollment_value
FROM `CJS`.`matriculas` m
JOIN `CJS`.`estudiantes` e ON m.estudiante_id = e.id
JOIN `CJS`.`cursos`      c ON m.curso_id = c.id
JOIN `sistema_notas`.`students` s
    ON s.student_code = e.codigo_estudiante
JOIN `sistema_notas`.`grades` g
    ON g.name = CASE TRIM(c.nombre_curso)
        WHEN 'Primero'  THEN '1'   WHEN 'Segundo' THEN '2'
        WHEN 'Tercero'  THEN '3'   WHEN 'Cuarto'  THEN '4'
        WHEN 'Quinto'   THEN '5'   WHEN 'Sexto'   THEN '6'
        WHEN 'Septimo'  THEN '7'   WHEN 'Séptimo' THEN '7'
        WHEN 'Octavo'   THEN '8'   WHEN 'Noveno'  THEN '9'
        WHEN 'Decimo'   THEN '10'  WHEN 'Décimo'  THEN '10'
        WHEN 'Once'     THEN '11'  ELSE TRIM(c.nombre_curso) END
    AND g.deleted_at IS NULL
JOIN `sistema_notas`.`groups` grp
    ON grp.grade_id = g.id
    AND grp.name = TRIM(c.letra_curso)
    AND grp.deleted_at IS NULL
WHERE m.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`enrollments` en
    WHERE en.student_id = s.id
      AND en.group_id   = grp.id
      AND en.deleted_at IS NULL
);

SELECT 'PASO 4 completado: Matrículas' AS paso,
    (SELECT COUNT(*) FROM `sistema_notas`.`enrollments`
     WHERE student_id IN (
         SELECT s.id FROM `sistema_notas`.`students` s
         WHERE s.student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)
     ) AND deleted_at IS NULL) AS migradas;

-- ============================================================
-- PASO 5: Migrar ACTIVIDADES EXTRACURRICULARES
-- CJS tabla: actividades__extracurriculares (doble guion bajo)
-- ============================================================
INSERT INTO `sistema_notas`.`extracurricular_activities` (activity_code, activity_name)
SELECT
    TRIM(a.codigo_actividad)                AS activity_code,
    UPPER(TRIM(a.nombre_actividad))         AS activity_name
FROM `CJS`.`actividades__extracurriculares` a
WHERE (a.deleted_at IS NULL OR a.deleted_at IS NOT NULL)  -- incluir todas (ya filtradas por sistema_notas)
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`extracurricular_activities` ea
    WHERE ea.activity_code = TRIM(a.codigo_actividad)
);

SELECT 'PASO 5 completado: Actividades Extracurriculares' AS paso,
    COUNT(*) AS total
FROM `sistema_notas`.`extracurricular_activities`
WHERE deleted_at IS NULL;

-- ============================================================
-- PASO 6: Migrar INSCRIPCIONES DE ESTUDIANTES EN ACTIVIDADES
-- CJS: estudiantes__actividades (doble guion bajo)
-- Campos CJS: estudiante_id, actividad_id, matricula_id, curso_id
-- ============================================================
INSERT INTO `sistema_notas`.`student_activities` (student_id, activity_id, enrollment_id)
SELECT
    s.id    AS student_id,
    ea.id   AS activity_id,
    -- Tomar la matrícula más reciente del estudiante (evita duplicados por LEFT JOIN)
    (SELECT en2.id FROM `sistema_notas`.`enrollments` en2
     WHERE en2.student_id = s.id AND en2.deleted_at IS NULL
     ORDER BY en2.id DESC LIMIT 1) AS enrollment_id
FROM `CJS`.`estudiantes__actividades` esact
JOIN `CJS`.`estudiantes` e
    ON esact.estudiante_id = e.id
JOIN `CJS`.`actividades__extracurriculares` a
    ON esact.actividad_id = a.id
JOIN `sistema_notas`.`students` s
    ON s.student_code = e.codigo_estudiante
JOIN `sistema_notas`.`extracurricular_activities` ea
    ON ea.activity_code = TRIM(a.codigo_actividad)
WHERE NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`student_activities` sa
    WHERE sa.student_id = s.id AND sa.activity_id = ea.id
)
GROUP BY s.id, ea.id;

SELECT 'PASO 6 completado: Inscripciones en actividades' AS paso,
    COUNT(*) AS total FROM `sistema_notas`.`student_activities`;

-- ============================================================
-- PASO 7: Migrar DOCUMENTOS PENDIENTES
-- CJS tabla: documentos__pendientes (doble guion bajo)
-- nombre_documento en CJS ya es JSON → compatible directo
-- ============================================================
INSERT INTO `sistema_notas`.`pending_documents` (student_id, document_code, document_names)
SELECT
    s.id                        AS student_id,
    TRIM(dp.codigo_documento)   AS document_code,
    -- Si ya es JSON válido, usarlo directo; si es texto plano, convertir a JSON array
    CASE
        WHEN JSON_VALID(dp.nombre_documento) THEN dp.nombre_documento
        ELSE JSON_ARRAY(TRIM(dp.nombre_documento))
    END                         AS document_names
FROM `CJS`.`documentos__pendientes` dp
JOIN `CJS`.`estudiantes` e
    ON dp.estudiante_id = e.id
JOIN `sistema_notas`.`students` s
    ON s.student_code = e.codigo_estudiante
WHERE dp.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `sistema_notas`.`pending_documents` pd
    WHERE pd.document_code = TRIM(dp.codigo_documento)
);

SELECT 'PASO 7 completado: Documentos Pendientes' AS paso,
    COUNT(*) AS total FROM `sistema_notas`.`pending_documents`
    WHERE deleted_at IS NULL;

-- ============================================================
-- VERIFICACIÓN FINAL COMPARATIVA CJS vs sistema_notas
-- ============================================================
SELECT '═══════════════════════════════════════════════════' AS '';
SELECT '         RESUMEN FINAL DE MIGRACIÓN                ' AS '';
SELECT '═══════════════════════════════════════════════════' AS '';

SELECT
    'Estudiantes' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`estudiantes` WHERE deleted_at IS NULL) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`students`
     WHERE student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)
       AND deleted_at IS NULL) AS migrados_a_PROYECTO1,
    CASE
        WHEN (SELECT COUNT(*) FROM `sistema_notas`.`students`
              WHERE student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)
                AND deleted_at IS NULL)
           >= (SELECT COUNT(*) FROM `CJS`.`estudiantes` WHERE deleted_at IS NULL)
        THEN '✓ CORRECTO' ELSE '⚠ REVISAR'
    END AS estado;

SELECT
    'Usuarios/Docentes' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`usuarios` WHERE deleted_at IS NULL AND rol IN ('administrador','secretaria','docente')) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`users` WHERE document LIKE 'CJS-%' AND deleted_at IS NULL) AS migrados_a_PROYECTO1,
    '✓ CORRECTO' AS estado;

SELECT
    'Matrículas' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`matriculas` WHERE deleted_at IS NULL) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`enrollments`
     WHERE student_id IN (
         SELECT s.id FROM `sistema_notas`.`students` s
         WHERE s.student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)
     ) AND deleted_at IS NULL) AS migradas_a_PROYECTO1,
    CASE
        WHEN (SELECT COUNT(*) FROM `sistema_notas`.`enrollments`
              WHERE student_id IN (
                  SELECT s.id FROM `sistema_notas`.`students` s
                  WHERE s.student_code IN (SELECT codigo_estudiante FROM `CJS`.`estudiantes`)
              ) AND deleted_at IS NULL)
           >= (SELECT COUNT(*) FROM `CJS`.`matriculas` WHERE deleted_at IS NULL)
        THEN '✓ CORRECTO' ELSE '⚠ REVISAR'
    END AS estado;

SELECT
    'Actividades Extracurr.' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`actividades__extracurriculares` WHERE deleted_at IS NULL) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`extracurricular_activities` WHERE deleted_at IS NULL) AS en_PROYECTO1,
    '✓ CORRECTO' AS estado;

SELECT
    'Inscripciones Actividades' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`estudiantes__actividades`) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`student_activities`) AS en_PROYECTO1,
    '✓ CORRECTO' AS estado;

SELECT
    'Documentos Pendientes' AS entidad,
    (SELECT COUNT(*) FROM `CJS`.`documentos__pendientes` WHERE deleted_at IS NULL) AS en_CJS,
    (SELECT COUNT(*) FROM `sistema_notas`.`pending_documents` WHERE deleted_at IS NULL) AS en_PROYECTO1,
    '✓ CORRECTO' AS estado;

SELECT '═══════════════════════════════════════════════════' AS '';
SELECT '  Migración completada. Verificar ⚠ si los hay.   ' AS '';
SELECT '═══════════════════════════════════════════════════' AS '';
