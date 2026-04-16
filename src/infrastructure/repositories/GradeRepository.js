const pool = require('../database/mysql');

class GradeRepository {
    async create(name) {
        const [result] = await pool.query(
            `INSERT INTO grades (name) VALUES (?)`,
            [name]
        );
        return { id: result.insertId, name };
    }

    async update(id, name) {
        const [result] = await pool.query(
            `UPDATE grades SET name = ? WHERE id = ? AND deleted_at IS NULL`,
            [name, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE grades SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, deleted_at AS deletedAt FROM grades WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, name FROM grades WHERE deleted_at IS NULL ORDER BY CAST(name AS UNSIGNED)`
        );
        return rows;
    }
}

module.exports = GradeRepository;