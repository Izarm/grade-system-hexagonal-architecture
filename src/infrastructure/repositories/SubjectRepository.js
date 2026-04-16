const pool = require('../database/mysql');

class SubjectRepository {
    async create(data) {
        const { name, area, intensityHours } = data;
        const [result] = await pool.query(
            `INSERT INTO subjects (name, area, intensity_hours) VALUES (?, ?, ?)`,
            [name, area, intensityHours]
        );
        return { id: result.insertId, name, area, intensityHours };
    }

    async update(id, data) {
        const { name, area, intensityHours } = data;
        const [result] = await pool.query(
            `UPDATE subjects SET name = ?, area = ?, intensity_hours = ? WHERE id = ? AND deleted_at IS NULL`,
            [name, area, intensityHours, id]
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

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, area, intensity_hours AS intensityHours, deleted_at AS deletedAt
             FROM subjects WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, name, area, intensity_hours AS intensityHours
             FROM subjects WHERE deleted_at IS NULL ORDER BY name`
        );
        return rows;
    }
}

module.exports = SubjectRepository;