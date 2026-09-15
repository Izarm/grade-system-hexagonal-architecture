const pool = require('../database/mysql');

class SubjectRepository {
    async create(data) {
        const { name, area } = data;
        const [result] = await pool.query(
            `INSERT INTO subjects (name, area) VALUES (?, ?)`,
            [name, area]
        );
        return { id: result.insertId, name, area };
    }

    async update(id, data) {
        const { name, area } = data;
        const [result] = await pool.query(
            `UPDATE subjects SET name = ?, area = ? WHERE id = ? AND deleted_at IS NULL`,
            [name, area, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE subjects SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, name, area FROM subjects WHERE deleted_at IS NULL ORDER BY name`
        );
        return rows;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, area FROM subjects WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findByNameIncludeDeleted(name) {
        const [rows] = await pool.query(
            `SELECT id, name, area, deleted_at FROM subjects WHERE name = ?`,
            [name]
        );
        return rows[0] || null;
    }

    async reactivate(id) {
        await pool.query(
            `UPDATE subjects SET deleted_at = NULL WHERE id = ?`,
            [id]
        );
        return this.findById(id);
    }

    async deleteAssignmentsBySubject(subjectId) {
        await pool.query(
            `UPDATE subject_assignments SET deleted_at = NOW() WHERE subject_id = ? AND deleted_at IS NULL`,
            [subjectId]
        );
    }
}

module.exports = SubjectRepository;