const pool = require('../database/mysql');

class StudentRepository {
    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, full_name, document, birth_date, folio_number
             FROM students WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findEnrollmentsByStudent(studentId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT e.id, e.group_id, e.academic_year_id,
                    g.name as group_name, gr.name as grade_name
             FROM enrollments e
             JOIN \`groups\` g ON e.group_id = g.id
             JOIN grades gr ON g.grade_id = gr.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL`,
            [studentId, academicYearId]
        );
        return rows[0] || null;
    }

    async getStudentGradesForReport(studentId, academicYearId) {
        // Obtener todas las notas del estudiante por período y asignatura
        const [rows] = await pool.query(
            `SELECT 
                p.name as period_name,
                p.order as period_order,
                s.name as subject_name,
                s.area,
                gr.normal_note,
                gr.aptitudinal_note,
                gr.average
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

    async getStudentsByGroup(groupId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT s.id, s.full_name, s.document, s.folio_number
             FROM students s
             JOIN enrollments e ON s.id = e.student_id
             WHERE e.group_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY s.full_name`,
            [groupId, academicYearId]
        );
        return rows;
    }

    async getAllStudentsWithFolio(academicYearId) {
        const [rows] = await pool.query(
            `SELECT s.id, s.full_name, s.document, s.folio_number, 
                    gr.name as grade_name, g.name as group_name
             FROM students s
             JOIN enrollments e ON s.id = e.student_id
             JOIN \`groups\` g ON e.group_id = g.id
             JOIN grades gr ON g.grade_id = gr.id
             WHERE e.academic_year_id = ? AND e.deleted_at IS NULL AND s.deleted_at IS NULL
             ORDER BY gr.name, g.name, s.full_name`,
            [academicYearId]
        );
        return rows;
    }
}

module.exports = StudentRepository;