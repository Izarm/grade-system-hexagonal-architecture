const mysql = require('mysql2/promise');

const srcConfig = { host: 'localhost', user: 'root', password: '3229306032', database: 'san_jose_source' };
const dstConfig = { host: 'localhost', user: 'root', password: '3229306032', database: 'sistema_notas' };

const GRADE_MAP = {
    'ONCE':'11°','DECIMO':'10°','NOVENO':'9°','OCTAVO':'8°','SEPTIMO':'7°',
    'SEXTO':'6°','QUINTO':'5°','CUARTO':'4°','TERCERO':'3°','SEGUNDO':'2°',
    'PRIMERO':'1°','TRANSICION':'Transición','JARDIN':'Jardín','PRE - JARDIN':'Pre-Jardín','MATERNO':'Materno'
};

const titleCase = s => s ? s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : s;

(async () => {
    const src = await mysql.createConnection(srcConfig);
    const dst = await mysql.createConnection(dstConfig);

    // 1. Crear tabla enrollment_history
    await dst.query(`
        CREATE TABLE IF NOT EXISTS enrollment_history (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            student_code    VARCHAR(50),
            student_name    VARCHAR(255),
            grade_name      VARCHAR(50),
            group_name      VARCHAR(10),
            academic_year   INT,
            enrollment_value DECIMAL(10,2),
            created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
    await dst.query(`TRUNCATE TABLE enrollment_history`);
    console.log('Tabla enrollment_history lista');

    // 2. Obtener nombres de personas
    const [personas] = await src.query('SELECT id, CONCAT(nombre, " ", apellido) as nombre FROM personas');
    const personaMap = {};
    personas.forEach(p => { personaMap[p.id] = p.nombre; });

    // 3. Obtener estudiantes
    const [estudiantes] = await src.query('SELECT id, persona_id, codigo_estudiante FROM estudiantes');
    const estudianteMap = {};
    estudiantes.forEach(e => { estudianteMap[e.id] = { codigo: e.codigo_estudiante, nombre: personaMap[e.persona_id] || '' }; });

    // 4. Obtener cursos
    const [cursos] = await src.query('SELECT id, nombre_curso, letra_curso FROM cursos');
    const cursoMap = {};
    cursos.forEach(c => { cursoMap[c.id] = { nombre: GRADE_MAP[c.nombre_curso] || c.nombre_curso, letra: c.letra_curso || '' }; });

    // 5. Migrar matrículas históricas (todos los años excepto 2025 y 2026)
    const [matriculas] = await src.query(
        `SELECT * FROM matriculas WHERE YEAR(ano_academico) NOT IN (2025, 2026) ORDER BY ano_academico, id`
    );

    let inserted = 0;
    for (const m of matriculas) {
        const est = estudianteMap[m.estudiante_id];
        const cur = cursoMap[m.curso_id];
        if (!est || !cur) continue;

        await dst.query(
            `INSERT INTO enrollment_history (student_code, student_name, grade_name, group_name, academic_year, enrollment_value, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                est.codigo,
                titleCase(est.nombre),
                cur.nombre,
                cur.letra,
                YEAR(m.ano_academico),
                m.valor_matricula > 0 ? m.valor_matricula : null,
                m.created_at || new Date()
            ]
        );
        inserted++;
    }

    console.log(`Matrículas históricas insertadas: ${inserted}`);
    await src.end();
    await dst.end();
    process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });

function YEAR(dateVal) {
    return new Date(dateVal).getFullYear();
}
