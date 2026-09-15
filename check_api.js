const pool = require('./src/infrastructure/database/mysql');
(async () => {
  // Simular lo que devuelve /groups?academicYearId=1
  const [groups] = await pool.query(
    'SELECT g.*, gr.name as grade_name, gr.head_teacher_id FROM `groups` g JOIN grades gr ON gr.id = g.grade_id WHERE gr.academic_year_id = 1 LIMIT 5'
  );
  console.log('GROUPS sample:', JSON.stringify(groups, null, 2));

  // Simular lo que devuelve /grades?academicYearId=1
  const [grades] = await pool.query('SELECT id, name, head_teacher_id FROM grades WHERE academic_year_id = 1 LIMIT 5');
  console.log('GRADES sample:', JSON.stringify(grades, null, 2));

  // Simular enrollments
  const [enr] = await pool.query('SELECT id, group_id, grade_id FROM enrollments WHERE academic_year_id = 1 LIMIT 3');
  console.log('ENROLLMENTS sample:', JSON.stringify(enr, null, 2));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
