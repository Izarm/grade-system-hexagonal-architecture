const pool = require('./src/infrastructure/database/mysql');
const GroupRepository = require('./src/infrastructure/repositories/GroupRepository');

(async () => {
  const repo = new GroupRepository();
  try {
    const groups = await repo.findAll(1);
    console.log('findAll OK, total:', groups.length);
    if (groups.length > 0) {
      console.log('Muestra grupo 1:', JSON.stringify(groups[0]));
    }

    // Simular el controlador
    const [gradesRows] = await pool.query('SELECT id, name FROM grades WHERE deleted_at IS NULL');
    const gradesMap = {};
    gradesRows.forEach(g => { gradesMap[g.id] = g.name; });

    const result = groups.map(group => ({
      id:              group.id,
      grade_id:        group.grade_id,
      name:            group.name,
      head_teacher_id: group.head_teacher_id ?? null,
      academic_year_id: group.academic_year_id,
      grade_name:      group.grade_name || gradesMap[group.grade_id] || null,
    }));
    console.log('Controlador OK, total:', result.length);
    console.log('Muestra resultado 1:', JSON.stringify(result[0]));
  } catch(e) {
    console.error('ERROR:', e.message);
    console.error(e.stack);
  }
  process.exit(0);
})();
