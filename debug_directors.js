const pool = require('./src/infrastructure/database/mysql');
(async () => {
  // 1. Ver head_teacher_id en groups
  const [grps] = await pool.query(
    'SELECT g.id, g.name, gr.name as grade, g.head_teacher_id FROM `groups` g JOIN grades gr ON gr.id=g.grade_id ORDER BY gr.id, g.name LIMIT 6'
  );
  console.log('=== groups.head_teacher_id ===');
  grps.forEach(r => console.log(`  ${r.grade} ${r.name} → head_teacher_id=${r.head_teacher_id}`));

  // 2. Ver roles de los directores
  const ids = grps.map(r => r.head_teacher_id).filter(Boolean);
  if (ids.length > 0) {
    const [usrs] = await pool.query(`SELECT id, name, role FROM users WHERE id IN (${ids.join(',')})`);
    console.log('\n=== users de esos directores ===');
    usrs.forEach(r => console.log(`  id=${r.id} role=${r.role} name=${r.name}`));
  } else {
    console.log('\n!!! head_teacher_id es NULL en todos los grupos !!!');
  }

  // 3. Simular lo que devuelve /groups?academicYearId=1
  const GroupRepository = require('./src/infrastructure/repositories/GroupRepository');
  const repo = new GroupRepository();
  const groups = await repo.findAll(1);
  console.log('\n=== findAll resultado (primeros 3) ===');
  groups.slice(0,3).forEach(g => console.log('  ', JSON.stringify(g)));

  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
