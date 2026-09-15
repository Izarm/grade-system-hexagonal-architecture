const pool = require('./src/infrastructure/database/mysql');
(async () => {
  const [rows] = await pool.query(
    'SELECT g.name as grado, grp.name as grupo, MIN(e.folio_number) as f1, MAX(e.folio_number) as f2, COUNT(*) as total ' +
    'FROM enrollments e ' +
    'JOIN `groups` grp ON grp.id = e.group_id ' +
    'JOIN grades g ON g.id = grp.grade_id ' +
    'WHERE e.academic_year_id = 1 AND e.deleted_at IS NULL ' +
    'GROUP BY g.name, grp.name ' +
    'ORDER BY CASE WHEN CAST(g.name AS UNSIGNED) BETWEEN 1 AND 5 THEN 1 ' +
             'WHEN CAST(g.name AS UNSIGNED) BETWEEN 6 AND 9 THEN 2 ' +
             'WHEN CAST(g.name AS UNSIGNED) BETWEEN 10 AND 11 THEN 3 ELSE 0 END, ' +
    'CAST(g.name AS UNSIGNED), grp.name'
  );
  rows.forEach(r => console.log(`${r.grado} ${r.grupo} | folios ${r.f1}-${r.f2} (${r.total} estudiantes)`));
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
