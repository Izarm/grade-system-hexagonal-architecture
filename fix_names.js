const pool = require('./src/infrastructure/database/mysql');

const titleCase = (str) => {
    if (!str) return str;
    return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

(async () => {
    // Estudiantes
    const [students] = await pool.query('SELECT id, full_name FROM students WHERE deleted_at IS NULL');
    let sCount = 0;
    for (const s of students) {
        const fixed = titleCase(s.full_name);
        if (fixed !== s.full_name) {
            await pool.query('UPDATE students SET full_name = ? WHERE id = ?', [fixed, s.id]);
            sCount++;
        }
    }
    console.log(`Estudiantes actualizados: ${sCount}`);

    // Docentes / usuarios
    const [users] = await pool.query('SELECT id, name FROM users WHERE deleted_at IS NULL');
    let uCount = 0;
    for (const u of users) {
        const fixed = titleCase(u.name);
        if (fixed !== u.name) {
            await pool.query('UPDATE users SET name = ? WHERE id = ?', [fixed, u.id]);
            uCount++;
        }
    }
    console.log(`Usuarios actualizados: ${uCount}`);

    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
