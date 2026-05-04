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

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT g.id, g.grade_id AS gradeId, g.name, gr.name AS gradeName
             FROM \`groups\` g
             JOIN grades gr ON g.grade_id = gr.id
             WHERE g.id = ? AND g.deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT g.id, g.grade_id AS gradeId, g.name, gr.name AS gradeName
             FROM \`groups\` g
             JOIN grades gr ON g.grade_id = gr.id
             WHERE g.deleted_at IS NULL
             ORDER BY gr.name, g.name`
        );
        return rows;
    }

    async findByGrade(gradeId) {
        const [rows] = await pool.query(
            `SELECT id, grade_id AS gradeId, name
             FROM \`groups\`
             WHERE grade_id = ? AND deleted_at IS NULL
             ORDER BY name`,
            [gradeId]
        );
        return rows;
    }
}

module.exports = GroupRepository;