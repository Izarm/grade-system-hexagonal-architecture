-- ============================================================
-- DATOS DE PRUEBA — Sistema San José de Tarbes
-- Ejecutar en la BD sistema_notas
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── 1. MIGRACIÓN: columna promotion_status (segura para re-ejecución) ────────
DROP PROCEDURE IF EXISTS add_promotion_status_col;
DELIMITER //
CREATE PROCEDURE add_promotion_status_col()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'enrollments'
      AND COLUMN_NAME  = 'promotion_status'
  ) THEN
    ALTER TABLE enrollments
    ADD COLUMN `promotion_status`
      ENUM('pending','promoted','held_back') NOT NULL DEFAULT 'pending'
    AFTER `folio_number`;
  END IF;
END //
DELIMITER ;
CALL add_promotion_status_col();
DROP PROCEDURE IF EXISTS add_promotion_status_col;

-- ── 2. DOCENTES (contraseña: Docente123) ──────────────────────────────────
INSERT INTO users (name, document, email, phone, password, role, status) VALUES
('Ana María González',    '10001', 'ana.gonzalez@tarbes.edu.co',   '3001111111', '$2b$10$V6Ml05TJozY/CCWJsfpjteWx0tg/LvkumFvhg3VyuGKoYMRpeGfbW', 'docente', 'active'),
('Carlos Alberto Pérez',  '10002', 'carlos.perez@tarbes.edu.co',   '3002222222', '$2b$10$V6Ml05TJozY/CCWJsfpjteWx0tg/LvkumFvhg3VyuGKoYMRpeGfbW', 'docente', 'active'),
('Lucía Fernández Mora',  '10003', 'lucia.fernandez@tarbes.edu.co','3003333333', '$2b$10$V6Ml05TJozY/CCWJsfpjteWx0tg/LvkumFvhg3VyuGKoYMRpeGfbW', 'docente', 'active'),
('Jorge Hernández López', '10004', 'jorge.hernandez@tarbes.edu.co','3004444444', '$2b$10$V6Ml05TJozY/CCWJsfpjteWx0tg/LvkumFvhg3VyuGKoYMRpeGfbW', 'docente', 'active'),
('Sandra Milena Ruiz',    '10005', 'sandra.ruiz@tarbes.edu.co',    '3005555555', '$2b$10$V6Ml05TJozY/CCWJsfpjteWx0tg/LvkumFvhg3VyuGKoYMRpeGfbW', 'docente', 'active')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 3. AÑOS LECTIVOS ───────────────────────────────────────────────────────
INSERT INTO academic_years (id, name, start_date, end_date, active) VALUES
(1, '2024', '2024-01-15', '2024-11-30', 0),
(2, '2025', '2025-01-13', '2025-11-28', 1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 4. PERÍODOS — Año 2024 (todos cerrados) ────────────────────────────────
INSERT INTO periods (id, academic_year_id, name, `order`, start_date, end_date, percentage, status) VALUES
(1, 1, 'Periodo 1', 1, '2024-01-15', '2024-03-22', 25.00, 'closed'),
(2, 1, 'Periodo 2', 2, '2024-04-01', '2024-06-14', 25.00, 'closed'),
(3, 1, 'Periodo 3', 3, '2024-07-15', '2024-09-20', 25.00, 'closed'),
(4, 1, 'Periodo 4', 4, '2024-09-23', '2024-11-30', 25.00, 'closed')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 5. PERÍODOS — Año 2025 (abiertos) ─────────────────────────────────────
INSERT INTO periods (id, academic_year_id, name, `order`, start_date, end_date, percentage, status) VALUES
(5, 2, 'Periodo 1', 1, '2025-01-13', '2025-03-21', 25.00, 'open'),
(6, 2, 'Periodo 2', 2, '2025-04-01', '2025-06-13', 25.00, 'open'),
(7, 2, 'Periodo 3', 3, '2025-07-14', '2025-09-19', 25.00, 'open'),
(8, 2, 'Periodo 4', 4, '2025-09-22', '2025-11-28', 25.00, 'open')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 6. GRADOS — Año 2024 ──────────────────────────────────────────────────
INSERT INTO grades (id, name, full_name, academic_year_id) VALUES
(1,  '6°',  'Sexto grado',   1),
(2,  '7°',  'Séptimo grado', 1),
(3,  '8°',  'Octavo grado',  1),
(4,  '9°',  'Noveno grado',  1),
(5,  '10°', 'Décimo grado',  1),
(6,  '11°', 'Undécimo grado',1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 7. GRADOS — Año 2025 ──────────────────────────────────────────────────
INSERT INTO grades (id, name, full_name, academic_year_id) VALUES
(7,  '6°',  'Sexto grado',   2),
(8,  '7°',  'Séptimo grado', 2),
(9,  '8°',  'Octavo grado',  2),
(10, '9°',  'Noveno grado',  2),
(11, '10°', 'Décimo grado',  2),
(12, '11°', 'Undécimo grado',2)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 8. GRUPOS — un grupo A por grado ──────────────────────────────────────
INSERT INTO `groups` (id, grade_id, name) VALUES
-- 2024
(1,  1, 'A'), (2,  2, 'A'), (3,  3, 'A'),
(4,  4, 'A'), (5,  5, 'A'), (6,  6, 'A'),
-- 2025
(7,  7,  'A'), (8,  8,  'A'), (9,  9,  'A'),
(10, 10, 'A'), (11, 11, 'A'), (12, 12, 'A')
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 9. ASIGNATURAS ────────────────────────────────────────────────────────
INSERT INTO subjects (id, name, area, is_elective) VALUES
(1,  'Matemáticas',         'Ciencias Exactas',    0),
(2,  'Español y Literatura','Humanidades',          0),
(3,  'Ciencias Naturales',  'Ciencias',            0),
(4,  'Ciencias Sociales',   'Humanidades',          0),
(5,  'Inglés',              'Idiomas',              0),
(6,  'Educación Física',    'Artística y Deportes', 0),
(7,  'Artística',           'Artística y Deportes', 1),
(8,  'Informática',         'Tecnología',           1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- ── 10. ASIGNACIONES DOCENTE-MATERIA-GRUPO (Año 2024) ────────────────────
-- Usamos los IDs de usuarios; admin=1,2,3 → docentes=4,5,6,7,8
SET @doc1 = (SELECT id FROM users WHERE document='10001');
SET @doc2 = (SELECT id FROM users WHERE document='10002');
SET @doc3 = (SELECT id FROM users WHERE document='10003');
SET @doc4 = (SELECT id FROM users WHERE document='10004');
SET @doc5 = (SELECT id FROM users WHERE document='10005');

-- Grado 6° — 2024
INSERT INTO subject_assignments (id, group_id, grade_id, subject_id, teacher_id, academic_year_id, is_elective) VALUES
(1,  1, 1, 1, @doc1, 1, 0),
(2,  1, 1, 2, @doc2, 1, 0),
(3,  1, 1, 3, @doc3, 1, 0),
(4,  1, 1, 4, @doc4, 1, 0),
(5,  1, 1, 5, @doc5, 1, 0),
(6,  1, 1, 6, @doc1, 1, 0),
(7,  1, 1, 7, @doc2, 1, 1),
(8,  1, 1, 8, @doc3, 1, 1)
ON DUPLICATE KEY UPDATE teacher_id=VALUES(teacher_id);

-- Grado 7° — 2024
INSERT INTO subject_assignments (id, group_id, grade_id, subject_id, teacher_id, academic_year_id, is_elective) VALUES
(9,  2, 2, 1, @doc1, 1, 0),
(10, 2, 2, 2, @doc2, 1, 0),
(11, 2, 2, 3, @doc3, 1, 0),
(12, 2, 2, 4, @doc4, 1, 0),
(13, 2, 2, 5, @doc5, 1, 0),
(14, 2, 2, 6, @doc1, 1, 0),
(15, 2, 2, 7, @doc2, 1, 1),
(16, 2, 2, 8, @doc3, 1, 1)
ON DUPLICATE KEY UPDATE teacher_id=VALUES(teacher_id);

-- Asignaciones 2025 — Grado 7° (los que son promovidos desde 6°)
INSERT INTO subject_assignments (id, group_id, grade_id, subject_id, teacher_id, academic_year_id, is_elective) VALUES
(17, 8, 8, 1, @doc1, 2, 0),
(18, 8, 8, 2, @doc2, 2, 0),
(19, 8, 8, 3, @doc3, 2, 0),
(20, 8, 8, 4, @doc4, 2, 0),
(21, 8, 8, 5, @doc5, 2, 0)
ON DUPLICATE KEY UPDATE teacher_id=VALUES(teacher_id);

-- ── 11. ESTUDIANTES ───────────────────────────────────────────────────────
INSERT INTO students (id, full_name, student_code, birth_date, guardian, address, phone_mobile1) VALUES
-- Grado 6° 2024 (10 estudiantes)
(1,  'Valentina Torres Ríos',      '2024-001', '2011-03-12', 'María Ríos',       'Calle 5 #12-30', '3101111111'),
(2,  'Sebastián Morales García',   '2024-002', '2011-07-24', 'Pedro Morales',    'Carrera 8 #45-20','3102222222'),
(3,  'Camila Jiménez Vargas',      '2024-003', '2011-05-09', 'Laura Vargas',     'Calle 15 #3-10', '3103333333'),
(4,  'Andrés Felipe Castro',       '2024-004', '2011-11-30', 'Rosa Castro',      'Av. 10 #22-50',  '3104444444'),
(5,  'Isabella Díaz Hernández',    '2024-005', '2011-02-18', 'Carlos Díaz',      'Calle 20 #7-80', '3105555555'),
(6,  'Santiago Reyes Medina',      '2024-006', '2011-08-05', 'Gloria Medina',    'Carrera 3 #10-5','3106666666'),
(7,  'Valeria Ospina Cruz',        '2024-007', '2011-04-14', 'Héctor Ospina',    'Calle 30 #18-40','3107777777'),
(8,  'Mateo González Suárez',      '2024-008', '2011-09-22', 'Ana Suárez',       'Carrera 12 #6-15','3108888888'),
(9,  'Paula Andrea Ramírez',       '2024-009', '2011-01-07', 'Luis Ramírez',     'Calle 50 #4-60', '3109999999'),
(10, 'Felipe Andrade Pinto',       '2024-010', '2011-12-03', 'Claudia Pinto',    'Av. 6 #33-20',   '3100000000'),
-- Grado 7° 2024 (5 estudiantes)
(11, 'Daniela Cortés Beltrán',     '2024-011', '2010-06-15', 'Jaime Cortés',     'Calle 8 #20-10', '3111111111'),
(12, 'Julián Escobar Nieto',       '2024-012', '2010-03-28', 'Patricia Nieto',   'Carrera 7 #14-8','3122222222'),
(13, 'Mariana Ávila Castillo',     '2024-013', '2010-10-11', 'Roberto Castillo', 'Calle 40 #9-70', '3133333333'),
(14, 'Samuel Peña Guerrero',       '2024-014', '2010-08-19', 'Diana Guerrero',   'Av. 4 #55-30',   '3144444444'),
(15, 'Alejandra Muñoz Torres',     '2024-015', '2010-01-25', 'Mario Muñoz',      'Calle 60 #2-45', '3155555555')
ON DUPLICATE KEY UPDATE full_name=VALUES(full_name);

-- ── 12. MATRÍCULAS — Año 2024 ─────────────────────────────────────────────
INSERT INTO enrollments (id, student_id, group_id, grade_id, academic_year_id, folio_number, promotion_status) VALUES
-- Grado 6° (grupo 1)
(1,  1,  1, 1, 1, 1,  'pending'),
(2,  2,  1, 1, 1, 2,  'pending'),
(3,  3,  1, 1, 1, 3,  'pending'),
(4,  4,  1, 1, 1, 4,  'pending'),
(5,  5,  1, 1, 1, 5,  'pending'),
(6,  6,  1, 1, 1, 6,  'pending'),
(7,  7,  1, 1, 1, 7,  'pending'),
(8,  8,  1, 1, 1, 8,  'pending'),
(9,  9,  1, 1, 1, 9,  'pending'),
(10, 10, 1, 1, 1, 10, 'pending'),
-- Grado 7° (grupo 2)
(11, 11, 2, 2, 1, 11, 'pending'),
(12, 12, 2, 2, 1, 12, 'pending'),
(13, 13, 2, 2, 1, 13, 'pending'),
(14, 14, 2, 2, 1, 14, 'pending'),
(15, 15, 2, 2, 1, 15, 'pending')
ON DUPLICATE KEY UPDATE folio_number=VALUES(folio_number);

-- ── 13. NOTAS — Grado 6° × 4 períodos × 6 materias (sin electivas) ───────
-- Valentina (estudiante 1, matrícula 1) — promedio alto ~8.5
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
-- P1
(1,1,1, '8.5,9.0', 9.0, 1, 8.8, 0),(1,1,2, '9.0,8.5', 9.0, 0, 8.9, 0),(1,1,3, '8.0,9.0', 9.0, 2, 8.7, 0),
(1,1,4, '9.5,9.0', 9.5, 0, 9.3, 0),(1,1,5, '7.5,8.5', 8.5, 1, 8.2, 0),(1,1,6, '9.0,9.5', 9.5, 0, 9.3, 0),
-- P2
(1,2,1, '9.0,8.5', 9.0, 0, 8.9, 0),(1,2,2, '8.5,9.5', 9.0, 1, 9.0, 0),(1,2,3, '9.0,8.0', 8.5, 0, 8.6, 0),
(1,2,4, '9.0,9.5', 9.5, 0, 9.3, 0),(1,2,5, '8.0,9.0', 8.5, 2, 8.5, 0),(1,2,6, '9.5,9.0', 9.5, 0, 9.3, 0),
-- P3
(1,3,1, '8.0,9.0', 9.0, 1, 8.7, 0),(1,3,2, '9.5,9.0', 9.0, 0, 9.2, 0),(1,3,3, '8.5,9.5', 9.0, 0, 9.0, 0),
(1,3,4, '9.0,9.0', 9.5, 0, 9.2, 0),(1,3,5, '8.5,8.0', 8.5, 1, 8.3, 0),(1,3,6, '9.0,9.5', 9.5, 0, 9.3, 0),
-- P4
(1,4,1, '9.5,9.0', 9.5, 0, 9.3, 0),(1,4,2, '9.0,9.5', 9.5, 0, 9.3, 0),(1,4,3, '9.0,9.0', 9.5, 1, 9.2, 0),
(1,4,4, '9.5,9.5', 9.5, 0, 9.5, 0),(1,4,5, '9.0,9.5', 9.5, 0, 9.3, 0),(1,4,6, '9.5,9.5', 9.5, 0, 9.5, 0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Sebastián (estudiante 2, matrícula 2) — promedio medio ~7.2
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(2,1,1,'7.0,7.5',7.5,2,7.3,0),(2,1,2,'6.5,7.5',7.0,3,7.0,0),(2,1,3,'7.5,7.0',7.5,1,7.3,0),
(2,1,4,'8.0,7.0',7.5,0,7.5,0),(2,1,5,'6.0,7.0',7.0,4,6.7,0),(2,1,6,'7.5,8.0',8.0,1,7.8,0),
(2,2,1,'7.0,8.0',7.5,1,7.5,0),(2,2,2,'7.5,7.0',7.0,2,7.2,0),(2,2,3,'7.0,7.5',7.5,3,7.3,0),
(2,2,4,'7.5,8.0',7.5,0,7.7,0),(2,2,5,'6.5,7.0',7.0,2,6.9,0),(2,2,6,'8.0,7.5',8.0,0,7.8,0),
(2,3,1,'7.5,7.0',7.5,2,7.3,0),(2,3,2,'7.0,7.5',7.0,1,7.2,0),(2,3,3,'8.0,7.0',7.5,0,7.5,0),
(2,3,4,'7.5,7.5',7.5,1,7.5,0),(2,3,5,'7.0,6.5',7.0,3,6.8,0),(2,3,6,'7.5,8.0',8.0,0,7.8,0),
(2,4,1,'7.0,7.5',7.5,1,7.3,0),(2,4,2,'7.5,8.0',7.5,0,7.7,0),(2,4,3,'7.5,7.0',7.5,2,7.3,0),
(2,4,4,'8.0,7.5',8.0,0,7.8,0),(2,4,5,'7.0,7.5',7.5,1,7.3,0),(2,4,6,'8.0,8.5',8.5,0,8.3,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Camila (estudiante 3, matrícula 3) — promedio bajo ~5.2 (repite)
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(3,1,1,'4.5,5.0',5.0,5,4.8,0),(3,1,2,'5.5,5.0',5.0,3,5.2,0),(3,1,3,'5.0,4.5',5.0,6,4.8,0),
(3,1,4,'5.5,5.0',5.5,2,5.3,0),(3,1,5,'4.0,5.0',5.0,7,4.7,0),(3,1,6,'6.0,5.5',5.5,1,5.7,0),
(3,2,1,'5.0,5.5',5.0,4,5.2,0),(3,2,2,'5.0,4.5',5.0,5,4.8,0),(3,2,3,'5.5,5.0',5.0,3,5.2,0),
(3,2,4,'5.0,5.5',5.5,2,5.3,0),(3,2,5,'4.5,5.0',5.0,6,4.8,0),(3,2,6,'5.5,6.0',5.5,1,5.7,0),
(3,3,1,'5.0,5.5',5.5,3,5.3,0),(3,3,2,'5.5,5.0',5.0,4,5.2,0),(3,3,3,'5.0,5.5',5.5,5,5.3,0),
(3,3,4,'5.5,5.0',5.5,2,5.3,0),(3,3,5,'5.0,4.5',5.0,4,4.8,0),(3,3,6,'6.0,5.5',6.0,0,5.8,0),
(3,4,1,'5.5,5.0',5.5,4,5.3,0),(3,4,2,'5.0,5.5',5.0,3,5.2,0),(3,4,3,'5.5,5.0',5.5,5,5.3,0),
(3,4,4,'5.0,5.5',5.5,2,5.3,0),(3,4,5,'4.5,5.5',5.0,6,5.0,0),(3,4,6,'5.5,6.0',5.5,1,5.7,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Andrés (estudiante 4, matrícula 4) — promedio límite ~6.5
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(4,1,1,'6.0,7.0',6.5,2,6.5,0),(4,1,2,'7.0,6.0',6.5,1,6.5,0),(4,1,3,'6.5,6.0',6.5,3,6.3,0),
(4,1,4,'7.0,6.5',7.0,0,6.8,0),(4,1,5,'6.0,6.5',6.5,2,6.3,0),(4,1,6,'7.0,6.5',7.0,1,6.8,0),
(4,2,1,'6.5,7.0',6.5,1,6.7,0),(4,2,2,'6.0,7.0',6.5,2,6.5,0),(4,2,3,'7.0,6.0',6.5,1,6.5,0),
(4,2,4,'6.5,7.0',7.0,0,6.8,0),(4,2,5,'6.5,6.0',6.5,2,6.3,0),(4,2,6,'7.0,7.5',7.0,0,7.2,0),
(4,3,1,'6.0,6.5',6.5,3,6.3,0),(4,3,2,'7.0,6.5',6.5,1,6.7,0),(4,3,3,'6.5,7.0',6.5,2,6.7,0),
(4,3,4,'7.0,6.5',7.0,0,6.8,0),(4,3,5,'6.0,7.0',6.5,3,6.5,0),(4,3,6,'7.0,7.0',7.0,1,7.0,0),
(4,4,1,'7.0,6.5',7.0,1,6.8,0),(4,4,2,'6.5,7.0',7.0,0,6.8,0),(4,4,3,'7.0,6.5',7.0,2,6.8,0),
(4,4,4,'7.0,7.5',7.5,0,7.3,0),(4,4,5,'6.5,7.0',7.0,1,6.8,0),(4,4,6,'7.5,7.0',7.5,0,7.3,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Isabella (estudiante 5, matrícula 5) — promedio muy alto ~9.1
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(5,1,1,'9.0,9.5',9.5,0,9.3,0),(5,1,2,'9.5,9.0',9.5,0,9.3,0),(5,1,3,'9.0,9.5',9.5,0,9.3,0),
(5,1,4,'9.5,9.5',9.5,0,9.5,0),(5,1,5,'8.5,9.0',9.0,1,8.8,0),(5,1,6,'9.5,9.5',9.5,0,9.5,0),
(5,2,1,'9.5,9.0',9.5,0,9.3,0),(5,2,2,'9.0,9.5',9.5,0,9.3,0),(5,2,3,'9.5,9.0',9.0,0,9.2,0),
(5,2,4,'9.0,9.5',9.5,0,9.3,0),(5,2,5,'9.0,9.0',9.0,0,9.0,0),(5,2,6,'9.5,9.5',9.5,0,9.5,0),
(5,3,1,'9.0,9.5',9.5,0,9.3,0),(5,3,2,'9.5,9.5',9.5,0,9.5,0),(5,3,3,'9.0,9.5',9.5,0,9.3,0),
(5,3,4,'9.5,9.0',9.5,0,9.3,0),(5,3,5,'9.0,8.5',9.0,1,8.8,0),(5,3,6,'9.5,9.5',9.5,0,9.5,0),
(5,4,1,'9.5,9.5',9.5,0,9.5,0),(5,4,2,'9.0,9.5',9.5,0,9.3,0),(5,4,3,'9.5,9.0',9.5,0,9.3,0),
(5,4,4,'9.5,9.5',9.5,0,9.5,0),(5,4,5,'9.0,9.5',9.5,0,9.3,0),(5,4,6,'9.5,9.5',9.5,0,9.5,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Santiago (6) — promedio ~7.8
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(6,1,1,'8.0,7.5',7.5,1,7.7,0),(6,1,2,'7.5,8.0',8.0,0,7.8,0),(6,1,3,'8.0,7.5',7.5,2,7.7,0),
(6,1,4,'8.0,8.0',8.0,0,8.0,0),(6,1,5,'7.5,7.5',7.5,1,7.5,0),(6,1,6,'8.0,8.5',8.5,0,8.3,0),
(6,2,1,'7.5,8.0',8.0,1,7.8,0),(6,2,2,'8.0,7.5',7.5,0,7.7,0),(6,2,3,'7.5,8.0',8.0,1,7.8,0),
(6,2,4,'8.0,8.5',8.0,0,8.2,0),(6,2,5,'7.5,8.0',7.5,2,7.7,0),(6,2,6,'8.5,8.0',8.5,0,8.3,0),
(6,3,1,'8.0,8.0',8.0,0,8.0,0),(6,3,2,'7.5,8.5',8.0,1,7.9,0),(6,3,3,'8.0,7.5',8.0,0,7.8,0),
(6,3,4,'8.5,8.0',8.5,0,8.3,0),(6,3,5,'7.5,8.0',7.5,2,7.7,0),(6,3,6,'8.5,9.0',8.5,0,8.7,0),
(6,4,1,'8.0,8.5',8.5,1,8.3,0),(6,4,2,'8.5,8.0',8.0,0,8.2,0),(6,4,3,'8.0,8.5',8.5,0,8.3,0),
(6,4,4,'8.5,8.5',8.5,0,8.5,0),(6,4,5,'8.0,8.5',8.0,1,8.2,0),(6,4,6,'9.0,8.5',9.0,0,8.8,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Valeria (7) — promedio bajo ~5.0 (repite)
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(7,1,1,'4.0,5.0',5.0,7,4.7,0),(7,1,2,'5.0,5.0',5.0,5,5.0,0),(7,1,3,'5.0,4.5',5.0,6,4.8,0),
(7,1,4,'5.5,5.0',5.0,3,5.2,0),(7,1,5,'4.5,5.0',5.0,8,4.8,0),(7,1,6,'5.5,5.5',5.5,2,5.5,0),
(7,2,1,'5.0,4.5',5.0,6,4.8,0),(7,2,2,'4.5,5.5',5.0,4,5.0,0),(7,2,3,'5.0,5.0',5.0,5,5.0,0),
(7,2,4,'5.5,5.0',5.0,2,5.2,0),(7,2,5,'4.0,5.0',4.5,7,4.5,0),(7,2,6,'5.0,5.5',5.5,3,5.3,0),
(7,3,1,'5.0,5.0',5.0,5,5.0,0),(7,3,2,'5.0,4.5',5.0,6,4.8,0),(7,3,3,'5.5,5.0',5.0,4,5.2,0),
(7,3,4,'5.0,5.5',5.5,2,5.3,0),(7,3,5,'4.5,4.5',4.5,8,4.5,0),(7,3,6,'5.5,5.0',5.5,2,5.3,0),
(7,4,1,'5.0,5.5',5.5,4,5.3,0),(7,4,2,'5.5,5.0',5.0,3,5.2,0),(7,4,3,'5.0,5.5',5.5,5,5.3,0),
(7,4,4,'5.5,5.0',5.5,2,5.3,0),(7,4,5,'5.0,4.5',4.5,6,4.7,0),(7,4,6,'5.5,5.5',5.5,1,5.5,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Mateo (8) — promedio ~6.8
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(8,1,1,'7.0,6.5',7.0,2,6.8,0),(8,1,2,'6.5,7.0',7.0,1,6.8,0),(8,1,3,'7.0,6.5',6.5,2,6.7,0),
(8,1,4,'7.0,7.0',7.0,0,7.0,0),(8,1,5,'6.5,6.5',6.5,3,6.5,0),(8,1,6,'7.0,7.5',7.0,1,7.2,0),
(8,2,1,'6.5,7.0',7.0,1,6.8,0),(8,2,2,'7.0,6.5',6.5,2,6.7,0),(8,2,3,'7.0,7.0',7.0,1,7.0,0),
(8,2,4,'7.0,7.5',7.0,0,7.2,0),(8,2,5,'6.5,7.0',6.5,2,6.7,0),(8,2,6,'7.5,7.0',7.5,0,7.3,0),
(8,3,1,'7.0,7.0',7.0,2,7.0,0),(8,3,2,'6.5,7.5',7.0,1,6.9,0),(8,3,3,'7.0,6.5',7.0,3,6.8,0),
(8,3,4,'7.5,7.0',7.5,0,7.3,0),(8,3,5,'6.5,7.0',7.0,2,6.8,0),(8,3,6,'7.5,7.5',7.5,0,7.5,0),
(8,4,1,'7.0,7.5',7.5,1,7.3,0),(8,4,2,'7.5,7.0',7.0,0,7.2,0),(8,4,3,'7.0,7.5',7.5,2,7.3,0),
(8,4,4,'7.5,7.5',7.5,0,7.5,0),(8,4,5,'7.0,7.5',7.0,1,7.2,0),(8,4,6,'7.5,8.0',8.0,0,7.8,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Paula (9) — promedio ~5.8 (límite, repite con 5.8)
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(9,1,1,'6.0,5.5',5.5,3,5.7,0),(9,1,2,'5.5,6.0',6.0,2,5.8,0),(9,1,3,'6.0,5.5',5.5,4,5.7,0),
(9,1,4,'6.0,6.0',6.0,1,6.0,0),(9,1,5,'5.5,5.5',5.5,5,5.5,0),(9,1,6,'6.0,6.0',6.0,2,6.0,0),
(9,2,1,'5.5,6.0',5.5,4,5.7,0),(9,2,2,'6.0,5.5',5.5,3,5.7,0),(9,2,3,'5.5,6.0',6.0,3,5.8,0),
(9,2,4,'6.0,6.0',6.0,1,6.0,0),(9,2,5,'5.5,5.5',5.5,5,5.5,0),(9,2,6,'6.0,5.5',6.0,2,5.8,0),
(9,3,1,'6.0,5.5',6.0,3,5.8,0),(9,3,2,'5.5,6.0',6.0,2,5.8,0),(9,3,3,'6.0,5.5',5.5,4,5.7,0),
(9,3,4,'6.0,6.0',6.0,0,6.0,0),(9,3,5,'5.5,6.0',5.5,4,5.7,0),(9,3,6,'6.0,6.0',6.0,1,6.0,0),
(9,4,1,'5.5,6.0',6.0,4,5.8,0),(9,4,2,'6.0,5.5',5.5,3,5.7,0),(9,4,3,'6.0,6.0',6.0,3,6.0,0),
(9,4,4,'6.0,6.5',6.0,1,6.2,0),(9,4,5,'5.5,6.0',5.5,5,5.7,0),(9,4,6,'6.0,6.5',6.0,1,6.2,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Felipe (10) — promedio ~7.5
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(10,1,1,'7.5,7.5',7.5,1,7.5,0),(10,1,2,'7.5,8.0',7.5,0,7.7,0),(10,1,3,'7.5,7.0',7.5,2,7.3,0),
(10,1,4,'8.0,7.5',7.5,0,7.7,0),(10,1,5,'7.0,7.5',7.0,2,7.2,0),(10,1,6,'8.0,7.5',8.0,0,7.8,0),
(10,2,1,'7.5,8.0',7.5,1,7.7,0),(10,2,2,'7.5,7.5',7.5,1,7.5,0),(10,2,3,'7.5,8.0',7.5,0,7.7,0),
(10,2,4,'8.0,7.5',8.0,0,7.8,0),(10,2,5,'7.5,7.0',7.0,2,7.2,0),(10,2,6,'8.0,8.5',8.0,0,8.2,0),
(10,3,1,'7.5,7.5',7.5,2,7.5,0),(10,3,2,'8.0,7.5',7.5,1,7.7,0),(10,3,3,'7.5,8.0',7.5,1,7.7,0),
(10,3,4,'8.0,8.0',8.0,0,8.0,0),(10,3,5,'7.0,8.0',7.5,2,7.5,0),(10,3,6,'8.0,8.0',8.0,0,8.0,0),
(10,4,1,'7.5,8.0',8.0,1,7.8,0),(10,4,2,'8.0,8.0',8.0,0,8.0,0),(10,4,3,'8.0,7.5',8.0,1,7.8,0),
(10,4,4,'8.0,8.5',8.5,0,8.3,0),(10,4,5,'7.5,8.0',7.5,1,7.7,0),(10,4,6,'8.5,8.5',8.5,0,8.5,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- ── 14. NOTAS GRADO 7° (estudiantes 11-15, matrículas 11-15) ───────────────
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
-- Daniela (11) ~8.0
(11,1,9,'8.0,8.0',8.0,1,8.0,0),(11,1,10,'8.5,7.5',8.0,0,8.0,0),(11,1,11,'8.0,8.0',8.0,1,8.0,0),
(11,1,12,'8.5,8.0',8.0,0,8.2,0),(11,1,13,'7.5,8.0',8.0,1,7.8,0),(11,1,14,'8.0,8.5',8.5,0,8.3,0),
(11,2,9,'8.0,8.5',8.0,0,8.2,0),(11,2,10,'8.0,8.0',8.0,1,8.0,0),(11,2,11,'8.5,8.0',8.0,0,8.2,0),
(11,2,12,'8.0,8.5',8.5,0,8.3,0),(11,2,13,'8.0,7.5',8.0,2,7.8,0),(11,2,14,'8.5,8.5',8.5,0,8.5,0),
(11,3,9,'8.0,8.0',8.0,1,8.0,0),(11,3,10,'8.5,8.0',8.0,0,8.2,0),(11,3,11,'8.0,8.5',8.0,0,8.2,0),
(11,3,12,'8.5,8.5',8.5,0,8.5,0),(11,3,13,'7.5,8.5',8.0,1,7.9,0),(11,3,14,'8.5,9.0',8.5,0,8.7,0),
(11,4,9,'8.5,8.0',8.5,0,8.3,0),(11,4,10,'8.0,8.5',8.5,0,8.3,0),(11,4,11,'8.5,8.5',8.5,0,8.5,0),
(11,4,12,'9.0,8.5',9.0,0,8.8,0),(11,4,13,'8.0,8.5',8.5,1,8.3,0),(11,4,14,'9.0,9.0',9.0,0,9.0,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Julián (12) ~5.5 (repite)
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(12,1,9,'5.0,5.5',5.5,4,5.3,0),(12,1,10,'5.5,5.0',5.0,3,5.2,0),(12,1,11,'5.0,5.5',5.5,5,5.3,0),
(12,1,12,'5.5,5.5',5.5,2,5.5,0),(12,1,13,'5.0,5.0',5.0,6,5.0,0),(12,1,14,'5.5,6.0',5.5,2,5.7,0),
(12,2,9,'5.5,5.0',5.0,5,5.2,0),(12,2,10,'5.0,5.5',5.5,4,5.3,0),(12,2,11,'5.5,5.0',5.0,4,5.2,0),
(12,2,12,'5.5,5.5',5.5,2,5.5,0),(12,2,13,'5.0,5.0',5.0,5,5.0,0),(12,2,14,'6.0,5.5',5.5,1,5.7,0),
(12,3,9,'5.0,5.5',5.5,5,5.3,0),(12,3,10,'5.5,5.0',5.0,3,5.2,0),(12,3,11,'5.5,5.5',5.5,4,5.5,0),
(12,3,12,'5.5,6.0',6.0,1,5.8,0),(12,3,13,'5.0,5.5',5.0,5,5.2,0),(12,3,14,'5.5,6.0',5.5,2,5.7,0),
(12,4,9,'5.5,6.0',5.5,3,5.7,0),(12,4,10,'5.0,5.5',5.5,4,5.3,0),(12,4,11,'5.5,5.5',5.5,3,5.5,0),
(12,4,12,'6.0,5.5',6.0,2,5.8,0),(12,4,13,'5.5,5.0',5.5,4,5.3,0),(12,4,14,'6.0,6.0',6.0,1,6.0,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Mariana (13) ~8.5
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(13,1,9,'8.5,8.5',8.5,0,8.5,0),(13,1,10,'9.0,8.5',8.5,0,8.7,0),(13,1,11,'8.5,8.5',8.5,1,8.5,0),
(13,1,12,'9.0,8.5',9.0,0,8.8,0),(13,1,13,'8.0,8.5',8.5,0,8.3,0),(13,1,14,'9.0,9.0',9.0,0,9.0,0),
(13,2,9,'8.5,9.0',8.5,0,8.7,0),(13,2,10,'8.5,8.5',8.5,0,8.5,0),(13,2,11,'9.0,8.5',9.0,0,8.8,0),
(13,2,12,'9.0,9.0',9.0,0,9.0,0),(13,2,13,'8.5,8.0',8.5,1,8.3,0),(13,2,14,'9.0,9.5',9.0,0,9.2,0),
(13,3,9,'8.5,8.5',8.5,0,8.5,0),(13,3,10,'9.0,9.0',9.0,0,9.0,0),(13,3,11,'8.5,9.0',9.0,0,8.8,0),
(13,3,12,'9.0,9.0',9.0,0,9.0,0),(13,3,13,'8.5,8.5',8.5,0,8.5,0),(13,3,14,'9.0,9.5',9.5,0,9.3,0),
(13,4,9,'9.0,8.5',9.0,0,8.8,0),(13,4,10,'9.0,9.0',9.0,0,9.0,0),(13,4,11,'9.0,9.0',9.0,0,9.0,0),
(13,4,12,'9.5,9.0',9.5,0,9.3,0),(13,4,13,'8.5,9.0',9.0,0,8.8,0),(13,4,14,'9.5,9.5',9.5,0,9.5,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Samuel (14) ~7.0
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(14,1,9,'7.0,7.0',7.0,2,7.0,0),(14,1,10,'7.5,6.5',7.0,1,7.0,0),(14,1,11,'7.0,7.0',7.0,2,7.0,0),
(14,1,12,'7.5,7.0',7.5,0,7.3,0),(14,1,13,'6.5,7.0',7.0,3,6.8,0),(14,1,14,'7.0,7.5',7.5,0,7.3,0),
(14,2,9,'7.0,7.5',7.5,1,7.3,0),(14,2,10,'7.0,7.0',7.0,2,7.0,0),(14,2,11,'7.5,7.0',7.0,2,7.2,0),
(14,2,12,'7.5,7.5',7.5,0,7.5,0),(14,2,13,'6.5,7.5',7.0,3,6.9,0),(14,2,14,'7.5,7.5',7.5,0,7.5,0),
(14,3,9,'7.0,7.0',7.0,2,7.0,0),(14,3,10,'7.5,7.0',7.0,1,7.2,0),(14,3,11,'7.0,7.5',7.5,1,7.3,0),
(14,3,12,'7.5,7.5',7.5,0,7.5,0),(14,3,13,'7.0,7.0',7.0,2,7.0,0),(14,3,14,'7.5,8.0',8.0,0,7.8,0),
(14,4,9,'7.5,7.0',7.0,2,7.2,0),(14,4,10,'7.0,7.5',7.5,1,7.3,0),(14,4,11,'7.5,7.5',7.5,1,7.5,0),
(14,4,12,'7.5,8.0',8.0,0,7.8,0),(14,4,13,'7.0,7.5',7.0,2,7.2,0),(14,4,14,'8.0,8.0',8.0,0,8.0,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- Alejandra (15) ~6.2
INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective) VALUES
(15,1,9,'6.0,6.5',6.0,3,6.2,0),(15,1,10,'6.5,6.0',6.0,2,6.2,0),(15,1,11,'6.0,6.5',6.5,3,6.3,0),
(15,1,12,'6.5,6.0',6.5,1,6.3,0),(15,1,13,'6.0,6.0',6.0,4,6.0,0),(15,1,14,'6.5,6.5',6.5,1,6.5,0),
(15,2,9,'6.5,6.0',6.0,2,6.2,0),(15,2,10,'6.0,6.5',6.5,2,6.3,0),(15,2,11,'6.5,6.0',6.0,3,6.2,0),
(15,2,12,'6.5,6.5',6.5,1,6.5,0),(15,2,13,'6.0,6.5',6.0,4,6.2,0),(15,2,14,'6.5,7.0',6.5,1,6.7,0),
(15,3,9,'6.0,6.5',6.5,3,6.3,0),(15,3,10,'6.5,6.0',6.0,2,6.2,0),(15,3,11,'6.5,6.5',6.5,2,6.5,0),
(15,3,12,'6.5,7.0',7.0,1,6.8,0),(15,3,13,'6.0,6.0',6.0,4,6.0,0),(15,3,14,'6.5,7.0',7.0,0,6.8,0),
(15,4,9,'6.5,6.5',6.5,2,6.5,0),(15,4,10,'6.5,7.0',6.5,1,6.7,0),(15,4,11,'6.5,6.5',6.5,2,6.5,0),
(15,4,12,'7.0,6.5',7.0,0,6.8,0),(15,4,13,'6.0,6.5',6.0,3,6.2,0),(15,4,14,'7.0,7.0',7.0,0,7.0,0)
ON DUPLICATE KEY UPDATE average=VALUES(average);

-- ── 15. ACTIVIDADES EXTRACURRICULARES ──────────────────────────────────────
INSERT INTO extracurricular_activities (id, activity_code, activity_name) VALUES
(1, 'CORO-01',  'Coro escolar'),
(2, 'AJEDREZ-01','Club de ajedrez'),
(3, 'ATL-01',  'Atletismo')
ON DUPLICATE KEY UPDATE activity_name=VALUES(activity_name);

-- Inscribir algunos estudiantes en actividades
INSERT INTO student_activities (student_id, activity_id) VALUES
(1,1),(2,2),(3,1),(5,1),(6,3),(8,2),(11,1),(13,3)
ON DUPLICATE KEY UPDATE activity_id=VALUES(activity_id);

-- ── 16. DOCUMENTOS PENDIENTES ─────────────────────────────────────────────
INSERT INTO pending_documents (student_id, document_code, document_names) VALUES
(3,  'DOC-003', '["Fotocopia cédula padre","Certificado médico"]'),
(7,  'DOC-007', '["Foto 3x4","Certificado vacunas"]'),
(12, 'DOC-012', '["Fotocopia cédula padre","Acta de nacimiento","Foto 3x4"]')
ON DUPLICATE KEY UPDATE document_names=VALUES(document_names);

SET FOREIGN_KEY_CHECKS = 1;

-- ── RESUMEN ───────────────────────────────────────────────────────────────
SELECT 'Datos de prueba cargados exitosamente' AS resultado;
SELECT
  (SELECT COUNT(*) FROM academic_years)               AS años_lectivos,
  (SELECT COUNT(*) FROM periods)                      AS periodos,
  (SELECT COUNT(*) FROM grades WHERE deleted_at IS NULL) AS grados,
  (SELECT COUNT(*) FROM students WHERE deleted_at IS NULL) AS estudiantes,
  (SELECT COUNT(*) FROM enrollments WHERE deleted_at IS NULL) AS matriculas,
  (SELECT COUNT(*) FROM grade_records WHERE deleted_at IS NULL) AS registros_notas,
  (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS usuarios;
