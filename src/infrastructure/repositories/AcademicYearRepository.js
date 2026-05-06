const pool = require('../database/mysql');

class AcademicYearRepository {
    async create(data) {
        const { name, startDate, endDate, active } = data;
        const [result] = await pool.query(
            `INSERT INTO academic_years (name, start_date, end_date, active)
             VALUES (?, ?, ?, ?)`,
            [name, startDate, endDate, active]
        );
        return { id: result.insertId, ...data };
    }

    async update(id, data) {
        const { name, startDate, endDate, active } = data;
        const [result] = await pool.query(
            `UPDATE academic_years
             SET name = ?, start_date = ?, end_date = ?, active = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [name, startDate, endDate, active, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE academic_years SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active, deleted_at AS deletedAt
             FROM academic_years WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active, deleted_at AS deletedAt
             FROM academic_years WHERE deleted_at IS NULL ORDER BY start_date DESC`
        );
        return rows;
    }

    async deactivateAll() {
        await pool.query(`UPDATE academic_years SET active = FALSE WHERE active = TRUE`);
    }

    async findActive() {
        const [rows] = await pool.query(
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active
             FROM academic_years WHERE active = TRUE AND deleted_at IS NULL`
        );
        return rows[0] || null;
    }
}

module.exports = AcademicYearRepository;