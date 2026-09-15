/**
 * SCRIPT DE MIGRACIÓN
 * SanJoseDeTarbes (Laravel/MariaDB) → sistema_notas (Node.js/MySQL)
 *
 * Pasos:
 *  1. Importa el backup SQL en base de datos temporal `san_jose_source`
 *  2. Lee todas las tablas fuente
 *  3. Transforma y escribe en `sistema_notas`
 */

const mysql = require('mysql2/promise');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const BACKUP_FILE = path.join('C:\\Users\\Fabian Realpe\\Downloads\\SanJoseDeTarbes_backup.sql');
const SOURCE_DB   = 'san_jose_source';
const TARGET_DB   = process.env.DB_NAME || 'sistema_notas';

const DB_CFG = {
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  multipleStatements: true,
};

// Mapa: nombre_curso fuente → nombre grado destino
const GRADE_NAME_MAP = {
  'ONCE':       '11°',
  'DECIMO':     '10°',
  'NOVENO':     '9°',
  'OCTAVO':     '8°',
  'SEPTIMO':    '7°',
  'SEXTO':      '6°',
  'QUINTO':     '5°',
  'CUARTO':     '4°',
  'TERCERO':    '3°',
  'SEGUNDO':    '2°',
  'PRIMERO':    '1°',
  'TRANSICION': 'Transición',
  'JARDIN':     'Jardín',
  'PRE - JARDIN': 'Pre-Jardín',
  'MATERNO':    'Materno',
};

function log(msg)  { console.log(`  ✓ ${msg}`); }
function warn(msg) { console.log(`  ⚠ ${msg}`); }
function head(msg) { console.log(`\n▶ ${msg}`); }

async function run() {
  // ── CONEXIÓN SIN BASE DE DATOS (para crear la temporal) ────────────────────
  const root = await mysql.createConnection(DB_CFG);

  // ── 1. CREAR BASE DE DATOS TEMPORAL E IMPORTAR BACKUP ──────────────────────
  head('Creando base de datos temporal: ' + SOURCE_DB);
  await root.query(`DROP DATABASE IF EXISTS \`${SOURCE_DB}\``);
  await root.query(`CREATE DATABASE \`${SOURCE_DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await root.query(`USE \`${SOURCE_DB}\``);

  head('Importando backup SQL...');
  const sql = fs.readFileSync(BACKUP_FILE, 'utf8');
  // Ejecutar en bloques separados por punto y coma (mysql2 con multipleStatements)
  await root.query(sql);
  log('Backup importado correctamente');
  await root.end();

  // ── CONEXIONES SEPARADAS PARA SOURCE Y TARGET ───────────────────────────────
  const src = await mysql.createConnection({ ...DB_CFG, database: SOURCE_DB });
  const dst = await mysql.createConnection({ ...DB_CFG, database: TARGET_DB });

  await dst.query('SET FOREIGN_KEY_CHECKS = 0');

  try {
    // ── 2. AÑO LECTIVO 2025 ────────────────────────────────────────────────────
    head('Creando año lectivo 2025');
    const [ayRes] = await dst.query(
      `INSERT INTO academic_years (name, start_date, end_date, active) VALUES (?, ?, ?, ?)`,
      ['2025', '2025-01-15', '2025-11-30', 1]
    );
    const academicYearId = ayRes.insertId;
    log(`Año lectivo 2025 creado (id=${academicYearId})`);

    // ── 3. PERÍODOS ────────────────────────────────────────────────────────────
    head('Creando 4 períodos académicos');
    const periods = [
      { name: 'Período 1', order: 1, start: '2025-01-15', end: '2025-03-28', pct: 25.00 },
      { name: 'Período 2', order: 2, start: '2025-03-31', end: '2025-06-13', pct: 25.00 },
      { name: 'Período 3', order: 3, start: '2025-06-23', end: '2025-08-29', pct: 25.00 },
      { name: 'Período 4', order: 4, start: '2025-09-01', end: '2025-11-28', pct: 25.00 },
    ];
    for (const p of periods) {
      await dst.query(
        `INSERT INTO periods (academic_year_id, name, \`order\`, start_date, end_date, percentage, status)
         VALUES (?, ?, ?, ?, ?, ?, 'open')`,
        [academicYearId, p.name, p.order, p.start, p.end, p.pct]
      );
    }
    log('4 períodos creados');

    // ── 4. GRADOS Y GRUPOS ─────────────────────────────────────────────────────
    head('Migrando cursos → grades + groups');
    const [cursos] = await src.query('SELECT * FROM cursos ORDER BY id');

    // Crear grados únicos
    const gradeMap = {}; // nombre_curso → grade_id en destino
    for (const curso of cursos) {
      const gradeName = GRADE_NAME_MAP[curso.nombre_curso] || curso.nombre_curso;
      if (!gradeMap[curso.nombre_curso]) {
        const [gr] = await dst.query(
          `INSERT INTO grades (name, academic_year_id) VALUES (?, ?)`,
          [gradeName, academicYearId]
        );
        gradeMap[curso.nombre_curso] = gr.insertId;
        log(`Grado creado: ${gradeName} (id=${gr.insertId})`);
      }
    }

    // Crear grupos (uno por curso fuente)
    const groupMap = {}; // curso.id (fuente) → group_id (destino)
    for (const curso of cursos) {
      const gradeId   = gradeMap[curso.nombre_curso];
      const groupName = curso.letra_curso || 'A';
      const [gr] = await dst.query(
        `INSERT INTO \`groups\` (grade_id, name) VALUES (?, ?)`,
        [gradeId, groupName]
      );
      groupMap[curso.id] = gr.insertId;
      log(`Grupo creado: ${GRADE_NAME_MAP[curso.nombre_curso] || curso.nombre_curso} ${groupName} (id=${gr.insertId})`);
    }

    // ── 5. USUARIOS (DOCENTES Y ADMINS) ────────────────────────────────────────
    head('Migrando usuarios');
    const [personas]  = await src.query('SELECT * FROM personas');
    const [usuarios]  = await src.query('SELECT * FROM usuarios');
    const [authss]    = await src.query('SELECT * FROM authss');

    const personaMap  = {}; personas.forEach(p => { personaMap[p.id] = p; });
    const authByUser  = {}; authss.forEach(a => { authByUser[a.usuario_id] = a; });

    const userMap = {}; // usuario_id fuente → user_id destino
    let usersCreated = 0;

    for (const u of usuarios) {
      // Ignorar rol 'estudiante' — no se crea usuario
      if (u.rol === 'estudiante') continue;

      const persona = personaMap[u.persona_id];
      if (!persona) { warn(`Persona no encontrada para usuario ${u.id_usuario}`); continue; }

      const auth = authByUser[u.id_usuario];
      if (!auth) { warn(`Sin auth para usuario ${u.id_usuario} (${persona.nombre} ${persona.apellido})`); continue; }

      // Rol mapping
      let role = 'docente';
      if (u.rol === 'administrador' || u.rol === 'secretaria') role = 'admin';

      // Convertir hash PHP $2y$ → $2b$ (mismo algoritmo, diferente prefijo)
      const password = auth.password.replace(/^\$2y\$/, '$2b$');

      // Nombre completo
      const fullName = `${persona.nombre.trim()} ${persona.apellido.trim()}`;

      // document: usamos el email como placeholder (se puede actualizar después)
      const document = auth.email.toLowerCase();

      // Email limpio (puede tener mayúsculas)
      const email = auth.email.toLowerCase();

      try {
        const [res] = await dst.query(
          `INSERT INTO users (name, document, email, password, role, status, created_at)
           VALUES (?, ?, ?, ?, ?, 'active', ?)`,
          [fullName, document, email, password, role, auth.created_at || new Date()]
        );
        userMap[u.id_usuario] = res.insertId;
        usersCreated++;
      } catch (e) {
        warn(`Usuario duplicado o error: ${email} — ${e.message}`);
      }
    }
    log(`${usersCreated} usuarios creados`);

    // ── 6. DIRECTORES DE CURSO → head_teacher_id ───────────────────────────────
    head('Asignando directores de curso');
    const [directores] = await src.query('SELECT * FROM directores__cursos');
    // Construir mapa persona_id → usuario_id fuente
    const personaToUsuario = {};
    for (const u of usuarios) { personaToUsuario[u.persona_id] = u.id_usuario; }

    let dirCount = 0;
    for (const d of directores) {
      const gradeId = gradeMap[cursos.find(c => c.id === d.curso_id)?.nombre_curso];
      const usuarioId = personaToUsuario[d.persona_id];
      const userId = userMap[usuarioId];
      if (!gradeId || !userId) continue;
      await dst.query(
        `UPDATE grades SET head_teacher_id = ? WHERE id = ?`,
        [userId, gradeId]
      );
      dirCount++;
    }
    log(`${dirCount} directores de curso asignados`);

    // ── 7. ESTUDIANTES ─────────────────────────────────────────────────────────
    head('Migrando estudiantes');
    const [estudiantes] = await src.query('SELECT * FROM estudiantes');

    const studentMap = {}; // estudiante.id fuente → student_id destino
    let studentsCreated = 0;

    for (const e of estudiantes) {
      const persona = personaMap[e.persona_id];
      if (!persona) { warn(`Persona no encontrada para estudiante ${e.id}`); continue; }

      const fullName = `${persona.nombre.trim()} ${persona.apellido.trim()}`;

      // Mapear tipo de documento
      let docType = e.tipo_documento || null;
      // La fuente usa 'R.C', 'T.I', 'C.C', 'T.E'  — destino acepta ambos con y sin punto final
      // ENUM destino: 'R.C.','T.I.','C.C.','P.E.','NIT','R.C','T.I','C.C'
      // Los valores sin punto final son compatibles directamente

      try {
        const [res] = await dst.query(
          `INSERT INTO students
           (full_name, student_code, document_type, phone_landline, phone_mobile1,
            phone_mobile2, email_father, email_mother, address, guardian,
            birth_date, admission_date, withdrawal_date, withdrawal_reason,
            observations, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            fullName,
            e.codigo_estudiante,
            docType,
            e.telefono_fijo     || null,
            e.telefono_celular_1|| null,
            e.telefono_celular_2|| null,
            e.correo_padre      || null,
            e.correo_madre      || null,
            e.direccion         || null,
            e.acudiente         || null,
            e.fecha_nacimiento  || null,
            e.fecha_ingreso     || null,
            e.fecha_retiro      || null,
            e.motivo_retiro     || null,
            e.observacion       || null,
            e.created_at        || new Date(),
            e.updated_at        || new Date(),
          ]
        );
        studentMap[e.id] = res.insertId;
        studentsCreated++;
      } catch (err) {
        warn(`Estudiante duplicado o error (${e.codigo_estudiante}): ${err.message}`);
      }
    }
    log(`${studentsCreated} estudiantes creados`);

    // ── 8. MATRÍCULAS → enrollments ────────────────────────────────────────────
    head('Migrando matrículas → enrollments');
    const [matriculas] = await src.query('SELECT * FROM matriculas ORDER BY id');

    // Folio counter global
    let folioCounter = 1;
    let enrollCount  = 0;
    let enrollErrors = 0;

    for (const m of matriculas) {
      const studentId = studentMap[m.estudiante_id];
      const groupId   = groupMap[m.curso_id];

      if (!studentId) { warn(`Estudiante fuente ${m.estudiante_id} no encontrado en destino`); enrollErrors++; continue; }
      if (!groupId)   { warn(`Curso fuente ${m.curso_id} no encontrado en destino`); enrollErrors++; continue; }

      // Obtener grade_id del grupo
      const [grRows] = await dst.query('SELECT grade_id FROM `groups` WHERE id = ?', [groupId]);
      const gradeId  = grRows[0]?.grade_id || null;

      // Valor matrícula (puede ser 0 o negativo en la fuente — sanitizar)
      const enrollValue = m.valor_matricula > 0 ? m.valor_matricula : null;

      try {
        await dst.query(
          `INSERT INTO enrollments
           (student_id, group_id, grade_id, academic_year_id, enrollment_value,
            folio_number, promotion_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [
            studentId,
            groupId,
            gradeId,
            academicYearId,
            enrollValue,
            folioCounter++,
            m.created_at || new Date(),
            m.updated_at || new Date(),
          ]
        );
        enrollCount++;
      } catch (err) {
        warn(`Matrícula ${m.id} error: ${err.message}`);
        enrollErrors++;
      }
    }
    log(`${enrollCount} matrículas migradas (${enrollErrors} omitidas)`);

    // ── 9. ACTIVIDADES EXTRACURRICULARES ───────────────────────────────────────
    head('Migrando actividades extracurriculares');
    const [actividades] = await src.query('SELECT * FROM actividades__extracurriculares');
    const activityMap   = {}; // actividad.id fuente → activity_id destino

    for (const a of actividades) {
      const [res] = await dst.query(
        `INSERT INTO extracurricular_activities (activity_code, activity_name, created_at, updated_at)
         VALUES (?, ?, ?, ?)`,
        [a.codigo_actividad, a.nombre_actividad, a.created_at || new Date(), a.updated_at || new Date()]
      );
      activityMap[a.id] = res.insertId;
    }
    log(`${actividades.length} actividades creadas`);

    // ── 10. ACTIVIDADES DE ESTUDIANTES ─────────────────────────────────────────
    head('Migrando actividades de estudiantes');
    const [estActs] = await src.query('SELECT * FROM estudiantes__actividades');
    let actCount = 0;

    // Mapa matricula_id fuente → enrollment_id destino
    const enrollByMatricula = {};
    const [allEnrollments] = await dst.query('SELECT id FROM enrollments ORDER BY id');
    // No tenemos relación directa matricula→enrollment; usaremos student+group
    // Crear mapa: (estudiante_id_src, curso_id_src) → enrollment_id
    const [matEnrollPairs] = await src.query('SELECT id, estudiante_id, curso_id FROM matriculas');
    const matriculaToEnroll = {};
    for (const m of matEnrollPairs) {
      const sId = studentMap[m.estudiante_id];
      const gId = groupMap[m.curso_id];
      if (!sId || !gId) continue;
      const [er] = await dst.query(
        'SELECT id FROM enrollments WHERE student_id = ? AND group_id = ? LIMIT 1',
        [sId, gId]
      );
      if (er[0]) matriculaToEnroll[m.id] = er[0].id;
    }

    for (const ea of estActs) {
      const studentId    = studentMap[ea.estudiante_id];
      const activityId   = activityMap[ea.actividad_id];
      const enrollmentId = matriculaToEnroll[ea.matricula_id] || null;

      if (!studentId || !activityId) continue;

      try {
        await dst.query(
          `INSERT INTO student_activities (student_id, activity_id, enrollment_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [studentId, activityId, enrollmentId, ea.created_at || new Date(), ea.updated_at || new Date()]
        );
        actCount++;
      } catch (err) {
        warn(`Actividad estudiante ${ea.id}: ${err.message}`);
      }
    }
    log(`${actCount} actividades de estudiantes migradas`);

    // ── 11. DOCUMENTOS PENDIENTES ──────────────────────────────────────────────
    head('Migrando documentos pendientes');
    const [docs] = await src.query('SELECT * FROM documentos__pendientes');
    let docCount = 0;

    for (const d of docs) {
      const studentId = studentMap[d.estudiante_id];
      if (!studentId) continue;
      try {
        await dst.query(
          `INSERT INTO pending_documents (student_id, document_code, document_names, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [studentId, d.codigo_documento, d.nombre_documento, d.created_at || new Date(), d.updated_at || new Date()]
        );
        docCount++;
      } catch (err) {
        warn(`Documento ${d.id}: ${err.message}`);
      }
    }
    log(`${docCount} documentos pendientes migrados`);

  } finally {
    await dst.query('SET FOREIGN_KEY_CHECKS = 1');
    await src.end();
    await dst.end();
  }

  // ── RESUMEN ─────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════');
  console.log('  MIGRACIÓN COMPLETADA EXITOSAMENTE');
  console.log('════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\n❌ ERROR EN MIGRACIÓN:', err.message);
  process.exit(1);
});
