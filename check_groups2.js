const pool = require('./src/infrastructure/database/mysql');
(async () => {
  // Total grupos
  const [[tot]] = await pool.query('SELECT COUNT(*) as n FROM `groups` WHERE deleted_at IS NULL');
  console.log('Total grupos activos:', tot.n);

  // Ver todos los grupos con su grado
  const [rows] = await pool.query(`
    SELECT g.id, g.grade_id, g.name as group_name, gr.name as grade_name, gr.academic_year_id
    FROM \`groups\` g
    JOIN grades gr ON gr.id = g.grade_id
    WHERE g.deleted_at IS NULL
    ORDER BY gr.academic_year_id, g.grade_id, g.name
  `);
  console.log('\nTodos los grupos:');
  rows.forEach(r => console.log(`  id=${r.id} grade_id=${r.grade_id} ay=${r.academic_year_id} => ${r.grade_name} ${r.group_name}`));

  // Detectar duplicados (mismo grade_id + name)
  const [dups] = await pool.query(`
    SELECT grade_id, name, COUNT(*) as n FROM \`groups\`
    WHERE deleted_at IS NULL
    GROUP BY grade_id, name HAVING n > 1
  `);
  if (dups.length > 0) {
    console.log('\nDUPLICADOS ENCONTRADOS:', dups);
  } else {
    console.log('\nNo hay duplicados en la tabla groups');
  }

  // Cuántos años académicos hay
  const [ays] = await pool.query('SELECT id, name, active FROM academic_years');
  console.log('\nAños académicos:', ays);

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
