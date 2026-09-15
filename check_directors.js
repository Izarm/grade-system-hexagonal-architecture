const mysql = require('mysql2/promise');
const pool  = require('./src/infrastructure/database/mysql');
require('dotenv').config();

(async () => {
  // Directores actuales en sistema_notas
  const [rows] = await pool.query(`
    SELECT gr.id as grade_id, gr.name as grade, g.name as grupo,
           u.name as director, gr.head_teacher_id
    FROM grades gr
    LEFT JOIN \`groups\` g ON g.grade_id = gr.id AND g.deleted_at IS NULL
    LEFT JOIN users u ON u.id = gr.head_teacher_id
    WHERE gr.deleted_at IS NULL
    ORDER BY gr.id, g.name
  `);
  console.log('=== DIRECTORES ACTUALES EN SISTEMA_NOTAS ===');
  rows.forEach(r => console.log(`  ${r.grade} ${r.grupo||''} → ${r.director || 'SIN DIRECTOR'} (head_teacher_id=${r.head_teacher_id})`));

  // Directores en la fuente
  const src = await mysql.createConnection({
    host: process.env.DB_HOST, user: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database: 'san_jose_source'
  });
  const [srcDirs] = await src.query(`
    SELECT c.nombre_curso, c.letra_curso, p.nombre, p.apellido
    FROM directores__cursos dc
    JOIN cursos c ON c.id = dc.curso_id
    JOIN personas p ON p.id = dc.persona_id
    ORDER BY c.nombre_curso, c.letra_curso
  `);
  console.log('\n=== DIRECTORES EN FUENTE (san_jose_source) ===');
  srcDirs.forEach(r => console.log(`  ${r.nombre_curso} ${r.letra_curso||''} → ${r.nombre} ${r.apellido}`));
  await src.end();
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
