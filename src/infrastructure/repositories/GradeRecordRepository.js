const pool = require('../database/mysql');

class GradeRecordRepository {
    // Upsert: si existe actualiza, si no inserta
    async upsert(data) {
        const { enrollmentId, periodId, subjectAssignmentId, normalNote, aptitudinalNote, average } = data;
        const connection = await pool.getConnection();
        try {
            // Verificar si ya existe
            const [existing] = await connection.query(
                `SELECT id FROM grade_records
                 WHERE enrollment_id = ? AND period_id = ? AND subject_assignment_id = ? AND deleted_at IS NULL`,
                [enrollmentId, periodId, subjectAssignmentId]
            );
            if (existing.length > 0) {
                const id = existing[0].id;
                await connection.query(
                    `UPDATE grade_records
                     SET normal_note = ?, aptitudinal_note = ?, average = ?
                     WHERE id = ? AND deleted_at IS NULL`,
                    [normalNote, aptitudinalNote, average, id]
                );
                return { id, ...data };
            } else {
                const [result] = await connection.query(
                    `INSERT INTO grade_records (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, average)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [enrollmentId, periodId, subjectAssignmentId, normalNote, aptitudinalNote, average]
                );
                return { id: result.insertId, ...data };
            }
        } finally {
            connection.release();
        }
    }

    async findByAssignmentAndPeriod(subjectAssignmentId, periodId) {
        const [rows] = await pool.query(
            `SELECT gr.id, gr.enrollment_id, gr.period_id, gr.subject_assignment_id,
                    gr.normal_note, gr.aptitudinal_note, gr.average,
                    e.student_id, s.full_name AS studentName, s.document
             FROM grade_records gr
             JOIN enrollments e ON gr.enrollment_id = e.id
             JOIN students s ON e.student_id = s.id
             WHERE gr.subject_assignment_id = ? AND gr.period_id = ? AND gr.deleted_at IS NULL
             ORDER BY s.full_name`,
            [subjectAssignmentId, periodId]
        );
        return rows;
    }

    async getStudentGradeReport(studentId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT gr.*, p.name AS periodName, p.order AS periodOrder, s.name AS subjectName
             FROM grade_records gr
             JOIN enrollments e ON gr.enrollment_id = e.id
             JOIN periods p ON gr.period_id = p.id
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN subjects s ON sa.subject_id = s.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.deleted_at IS NULL
             ORDER BY p.order, s.name`,
            [studentId, academicYearId]
        );
        return rows;
    }
}

module.exports = GradeRecordRepository;