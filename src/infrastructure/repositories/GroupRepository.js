const pool = require('../database/mysql');

class GroupRepository {
    async create(data) {
        const { gradeId, name } = data;
        const [result] = await pool.query(
            `INSERT INTO \`groups\` (grade_id, name) VALUES (?, ?)`,
            [gradeId, name]
        );
        return { id: result.insertId, ...data };
    }

    async findAll() {
    const [rows] = await pool.query(
        `SELECT g.id, g.grade_id, g.name, gr.name as grade_name
         FROM \`groups\` g
         JOIN grades gr ON g.grade_id = gr.id
         WHERE g.deleted_at IS NULL
         ORDER BY 
             CAST(gr.name AS UNSIGNED) ASC,
             FIELD(g.name, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J') ASC`
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
            `SELECT id, grade_id, name, deleted_at
             FROM \`groups\`
             WHERE grade_id = ? AND deleted_at IS NULL`,
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