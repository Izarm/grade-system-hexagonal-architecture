const pool = require('../../infrastructure/database/mysql');

function extractNumber(name) {
    const m = (name || '').match(/(\d+)/);
    return m ? parseInt(m[1]) : null;
}

function buildNextGradeName(gradeName) {
    const n = extractNumber(gradeName);
    if (n === null) return null;
    return gradeName.replace(/\d+/, String(n + 1));
}

// GET /api/promotions/:yearId — estudiantes del año con promedio final
exports.getStudentsForPromotion = async (req, res) => {
    try {
        const { yearId } = req.params;
        const sql = 'SELECT e.id AS enrollment_id, e.student_id, e.promotion_status, e.folio_number,'
            + ' s.full_name, s.student_code, g.id AS grade_id, g.name AS grade_name,'
            + ' grp.name AS group_name,'
            + ' ROUND(AVG(gr.average), 2) AS final_average, COUNT(gr.id) AS records_count'
            + ' FROM enrollments e'
            + ' JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL'
            + ' JOIN `groups` grp ON grp.id = e.group_id'
            + ' JOIN grades g ON g.id = COALESCE(e.grade_id, grp.grade_id)'
            + ' LEFT JOIN grade_records gr'
            + '   ON gr.enrollment_id = e.id AND gr.deleted_at IS NULL AND gr.is_elective = 0 AND gr.average IS NOT NULL'
            + ' WHERE e.academic_year_id = ? AND e.deleted_at IS NULL'
            + ' GROUP BY e.id, e.student_id, e.promotion_status, s.full_name, s.student_code, g.id, g.name, grp.name, e.folio_number'
            + ' ORDER BY g.name, s.full_name';
        const [students] = await pool.query(sql, [yearId]);
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// PUT /api/promotions/status — actualización masiva de estados
exports.updateStatus = async (req, res) => {
    try {
        const { updates } = req.body;
        if (!Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ message: 'Se requieren actualizaciones' });
        }
        const allowed = ['promoted', 'held_back', 'pending'];
        for (const { enrollmentId, status } of updates) {
            if (!allowed.includes(status)) continue;
            await pool.query(
                'UPDATE enrollments SET promotion_status = ? WHERE id = ? AND deleted_at IS NULL',
                [status, enrollmentId]
            );
        }
        res.json({ message: 'Estados de promoción actualizados' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

// POST /api/promotions/execute — crea matrículas en año destino
exports.execute = async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { fromYearId, toYearId } = req.body;
        if (!fromYearId || !toYearId)
            return res.status(400).json({ message: 'Se requieren fromYearId y toYearId' });
        if (String(fromYearId) === String(toYearId))
            return res.status(400).json({ message: 'El año origen y destino deben ser distintos' });

        await connection.beginTransaction();

        const [toYear] = await connection.query(
            'SELECT id, name FROM academic_years WHERE id = ? AND deleted_at IS NULL', [toYearId]
        );
        if (toYear.length === 0) throw new Error('Año lectivo destino no encontrado');

        const sqlStudents = 'SELECT e.id AS enrollment_id, e.student_id, e.promotion_status,'
            + ' g.name AS grade_name, grp.id AS group_id'
            + ' FROM enrollments e'
            + ' JOIN `groups` grp ON grp.id = e.group_id'
            + ' JOIN grades g ON g.id = COALESCE(e.grade_id, grp.grade_id)'
            + ' WHERE e.academic_year_id = ? AND e.deleted_at IS NULL'
            + " AND e.promotion_status IN ('promoted', 'held_back')";
        const [students] = await connection.query(sqlStudents, [fromYearId]);

        const sqlGrades = 'SELECT g.id AS grade_id, g.name AS grade_name, grp.id AS group_id'
            + ' FROM grades g'
            + ' JOIN `groups` grp ON grp.grade_id = g.id AND grp.deleted_at IS NULL'
            + ' WHERE g.academic_year_id = ? AND g.deleted_at IS NULL ORDER BY grp.id ASC';
        const [newGrades] = await connection.query(sqlGrades, [toYearId]);

        const gradeMap = {};
        for (const row of newGrades) {
            if (!gradeMap[row.grade_name])
                gradeMap[row.grade_name] = { gradeId: row.grade_id, groupId: row.group_id };
        }

        let promoted = 0, heldBack = 0, skipped = 0;
        const warnings = [];

        for (const st of students) {
            const targetGradeName = st.promotion_status === 'promoted'
                ? buildNextGradeName(st.grade_name)
                : st.grade_name;

            const target = gradeMap[targetGradeName];
            if (!target) {
                warnings.push(`"${st.grade_name}" → "${targetGradeName}" no existe en el año destino (estudiante ID ${st.student_id})`);
                skipped++; continue;
            }

            const [[existing]] = await connection.query(
                'SELECT id FROM enrollments WHERE student_id = ? AND academic_year_id = ? AND deleted_at IS NULL',
                [st.student_id, toYearId]
            );
            if (existing) {
                warnings.push(`Estudiante ID ${st.student_id} ya tiene matrícula en el año destino`);
                skipped++; continue;
            }

            await connection.query(
                'INSERT INTO enrollments (student_id, group_id, grade_id, academic_year_id) VALUES (?, ?, ?, ?)',
                [st.student_id, target.groupId, target.gradeId, toYearId]
            );
            if (st.promotion_status === 'promoted') promoted++;
            else heldBack++;
        }

        // Folios del año destino: solo grados con número; preescolar sin folio.
        if (promoted + heldBack > 0) {
            const EnrollmentRepository = require('../../infrastructure/repositories/EnrollmentRepository');
            await new EnrollmentRepository().recalculateFolioNumbers(toYearId, connection);
        }

        await connection.commit();
        res.json({ message: `Promoción ejecutada al año ${toYear[0].name}`, promoted, heldBack, skipped, warnings });
    } catch (err) {
        await connection.rollback();
        res.status(500).json({ message: err.message });
    } finally {
        connection.release();
    }
};

// GET /api/promotions/history/:yearId — historial completo de un año
exports.getHistory = async (req, res) => {
    try {
        const { yearId } = req.params;
        const sql = 'SELECT e.id AS enrollment_id, e.student_id, e.folio_number, e.promotion_status,'
            + ' s.full_name, s.student_code, g.name AS grade_name, grp.name AS group_name, ay.name AS year_name,'
            + ' ROUND(AVG(CASE WHEN gr.is_elective = 0 THEN gr.average END), 2) AS final_average,'
            + ' COUNT(CASE WHEN gr.is_elective = 0 AND gr.average IS NOT NULL THEN 1 END) AS records_count,'
            + ' SUM(COALESCE(gr.absences, 0)) AS total_absences'
            + ' FROM enrollments e'
            + ' JOIN students s ON s.id = e.student_id AND s.deleted_at IS NULL'
            + ' JOIN `groups` grp ON grp.id = e.group_id'
            + ' JOIN grades g ON g.id = COALESCE(e.grade_id, grp.grade_id)'
            + ' JOIN academic_years ay ON ay.id = e.academic_year_id'
            + ' LEFT JOIN grade_records gr ON gr.enrollment_id = e.id AND gr.deleted_at IS NULL'
            + ' WHERE e.academic_year_id = ? AND e.deleted_at IS NULL'
            + ' GROUP BY e.id, e.student_id, e.folio_number, e.promotion_status, s.full_name, s.student_code, g.name, grp.name, ay.name'
            + ' ORDER BY g.name, s.full_name';
        const [students] = await pool.query(sql, [yearId]);
        res.json(students);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
