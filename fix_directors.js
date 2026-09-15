/**
 * Mueve head_teacher_id de grades → groups
 * y asigna el director correcto por curso (A y B independientes)
 */
const mysql = require('mysql2/promise');
const pool  = require('./src/infrastructure/database/mysql');
require('dotenv').config();

const GRADE_NAME_MAP = {
  'ONCE':'11°','DECIMO':'10°','NOVENO':'9°','OCTAVO':'8°','SEPTIMO':'7°',
  'SEXTO':'6°','QUINTO':'5°','CUARTO':'4°','TERCERO':'3°','SEGUNDO':'2°',
  'PRIMERO':'1°','TRANSICION':'Transición','JARDIN':'Jardín',
  'PRE - JARDIN':'Pre-Jardín','MATERNO':'Materno'
};

(async () => {
  // 1. Agregar columna head_teacher_id a groups (si no existe)
  try {
    await pool.query('ALTER TABLE `groups` ADD COLUMN head_teacher_id INT UNSIGNED NULL DEFAULT NULL');
    console.log('✓ Columna head_teacher_id agregada a groups');
  } catch (e) {
    if (e.code === 'ER_DUP_FIELDNAME') console.log('ℹ  Columna head_teacher_id ya existe en groups');
    else throw e;
  }

  // 2. Leer directores de la fuente (por curso individual)
  const src = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: 'san_jose_source'
  });

  const [srcDirs] = await src.query(`
    SELECT DISTINCT c.nombre_curso, c.letra_curso, p.nombre, p.apellido
    FROM directores__cursos dc
    JOIN cursos c ON c.id = dc.curso_id
    JOIN personas p ON p.id = dc.persona_id
  `);
  await src.end();

  // 3. Para cada director fuente, encontrar el user y group en destino y asignar
  let ok = 0, skip = 0;
  for (const d of srcDirs) {
    const gradeName = GRADE_NAME_MAP[d.nombre_curso] || d.nombre_curso;
    const groupLetter = d.letra_curso || 'A';
    const fullName = `${d.nombre.trim()} ${d.apellido.trim()}`.toLowerCase();

    // Buscar el grupo en destino
    const [grpRows] = await pool.query(
      `SELECT g.id FROM \`groups\` g
       JOIN grades gr ON gr.id = g.grade_id
       WHERE gr.name = ? AND g.name = ? AND g.deleted_at IS NULL`,
      [gradeName, groupLetter]
    );
    if (!grpRows[0]) { console.log(`  ⚠ Grupo no encontrado: ${gradeName} ${groupLetter}`); skip++; continue; }

    // Buscar el usuario en destino por nombre (búsqueda flexible)
    const [usrRows] = await pool.query(
      `SELECT id, name FROM users WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT 1`,
      [`%${fullName.split(' ')[0]}%${fullName.split(' ').slice(-1)[0] ? '%' : ''}`]
    );

    // Si no encontró con primer+último nombre, buscar solo apellido
    let userId = usrRows[0]?.id;
    if (!userId) {
      const lastName = d.apellido.trim().split(' ')[0].toLowerCase();
      const [usrRows2] = await pool.query(
        `SELECT id, name FROM users WHERE LOWER(name) LIKE ? AND deleted_at IS NULL LIMIT 1`,
        [`%${lastName}%`]
      );
      userId = usrRows2[0]?.id;
      if (userId) console.log(`  ℹ Coincidencia parcial para "${d.nombre} ${d.apellido}" → "${usrRows2[0].name}"`);
    }

    if (!userId) { console.log(`  ⚠ Usuario no encontrado: ${d.nombre} ${d.apellido}`); skip++; continue; }

    await pool.query('UPDATE `groups` SET head_teacher_id = ? WHERE id = ?', [userId, grpRows[0].id]);
    console.log(`  ✓ ${gradeName} ${groupLetter} → ${d.nombre} ${d.apellido} (user_id=${userId})`);
    ok++;
  }

  console.log(`\nDirectores asignados: ${ok} | omitidos: ${skip}`);
  process.exit(0);
})().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
