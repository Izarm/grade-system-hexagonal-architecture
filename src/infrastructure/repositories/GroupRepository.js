const pool = require('../database/mysql');

class GroupRepository {
    async create(data) {
        const { gradeId, name } = data;
        // If a soft-deleted group with the same (grade_id, name) exists, reactivate it
        const [existing] = await pool.query(
            `SELECT id FROM \`groups\` WHERE grade_id = ? AND name = ? AND deleted_at IS NOT NULL`,
            [gradeId, name]
        );
        if (existing.length > 0) {
            await pool.query(`UPDATE \`groups\` SET deleted_at = NULL WHERE id = ?`, [existing[0].id]);
            return { id: existing[0].id, ...data };
        }
        const [result] = await pool.query(
            `INSERT INTO \`groups\` (grade_id, name) VALUES (?, ?)`,
            [gradeId, name]
        );
        return { id: result.insertId, ...data };
    }

    async findAll(academicYearId = null) {
        const extra = academicYearId ? 'AND gr.academic_year_id = ?' : '';
        const params = academicYearId ? [academicYearId] : [];
        const [rows] = await pool.query(
            `SELECT g.id, g.grade_id, g.name, g.head_teacher_id,
                    gr.name as grade_name, gr.academic_year_id, gr.takes_grades
             FROM \`groups\` g
             JOIN grades gr ON g.grade_id = gr.id
             WHERE g.deleted_at IS NULL AND gr.deleted_at IS NULL ${extra}
             ORDER BY
                 CAST(gr.name AS UNSIGNED) ASC,
                 FIELD(g.name, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J') ASC`,
            params
        );
        return rows;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, grade_id, name FROM \`groups\` WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findByGrade(gradeId) {
        const [rows] = await pool.query(
            `SELECT g.id, g.grade_id, g.name, g.deleted_at, gr.takes_grades
             FROM \`groups\` g
             JOIN grades gr ON g.grade_id = gr.id
             WHERE g.grade_id = ? AND g.deleted_at IS NULL`,
            [gradeId]
        );
        return rows;
    }

    async findByGradeAndName(gradeId, name) {
        const [rows] = await pool.query(
            `SELECT id, grade_id, name, deleted_at
             FROM \`groups\`
             WHERE grade_id = ? AND name = ? AND deleted_at IS NULL`,
            [gradeId, name]
        );
        return rows[0] || null;
    }

    async update(id, data) {
        const { gradeId, name } = data;
        const [result] = await pool.query(
            `UPDATE \`groups\` SET grade_id = ?, name = ? WHERE id = ? AND deleted_at IS NULL`,
            [gradeId, name, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE \`groups\` SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async updateHeadTeacher(id, teacherId) {
        const [result] = await pool.query(
            `UPDATE \`groups\` SET head_teacher_id = ? WHERE id = ? AND deleted_at IS NULL`,
            [teacherId, id]
        );
        return result.affectedRows > 0;
    }

    async reactivate(id) {
        const [result] = await pool.query(
            `UPDATE \`groups\` SET deleted_at = NULL WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async deletePhysical(id) {
        const [result] = await pool.query(
            `DELETE FROM \`groups\` WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = GroupRepository;