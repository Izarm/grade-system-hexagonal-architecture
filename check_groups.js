const pool = require('./src/infrastructure/database/mysql');
(async () => {
  const [rows] = await pool.query(
    "SELECT gr.name as grado, g.name as grupo, COUNT(e.id) as n FROM enrollments e JOIN `groups` g ON g.id = e.group_id JOIN grades gr ON gr.id = g.grade_id GROUP BY gr.id, g.id ORDER BY gr.id, g.name"
  );
  rows.forEach(r => console.log(' ', r.grado, r.grupo, '->', r.n, 'estudiantes'));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
