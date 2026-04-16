const pool = require('../database/mysql');

class SubjectAssignmentRepository {
    async create(data) {
        const { groupId, subjectId, teacherId, academicYearId } = data;
        const [result] = await pool.query(
            `INSERT INTO subject_assignments (group_id, subject_id, teacher_id, academic_year_id)
             VALUES (?, ?, ?, ?)`,
            [groupId, subjectId, teacherId, academicYearId]
        );
        return { id: result.insertId, ...data };
    }

    async update(id, data) {
        const { groupId, subjectId, teacherId, academicYearId } = data;
        const [result] = await pool.query(
            `UPDATE subject_assignments
             SET group_id = ?, subject_id = ?, teacher_id = ?, academic_year_id = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [groupId, subjectId, teacherId, academicYearId, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE subject_assignments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, group_id AS groupId, subject_id AS subjectId, teacher_id AS teacherId, academic_year_id AS academicYearId
             FROM subject_assignments WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT sa.id, sa.group_id AS groupId, sa.subject_id AS subjectId, sa.teacher_id AS teacherId, sa.academic_year_id AS academicYearId,
                    g.name AS groupName, gr.name AS gradeName, s.name AS subjectName, u.name AS teacherName
             FROM subject_assignments sa
             JOIN \`groups\` g ON sa.group_id = g.id
             JOIN grades gr ON g.grade_id = gr.id
             JOIN subjects s ON sa.subject_id = s.id
             JOIN users u ON sa.teacher_id = u.id
             WHERE sa.deleted_at IS NULL
             ORDER BY gr.name, g.name, s.name`
        );
        return rows;
    }

    async findUnique(groupId, subjectId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT id FROM subject_assignments
             WHERE group_id = ? AND subject_id = ? AND academic_year_id = ? AND deleted_at IS NULL`,
            [groupId, subjectId, academicYearId]
        );
        return rows[0] || null;
    }
}

module.exports = SubjectAssignmentRepository;