const pool = require('../database/mysql');

class PeriodRepository {
    async create(data) {
        const { academicYearId, name, order, startDate, endDate, status } = data;
        const [result] = await pool.query(
            `INSERT INTO periods (academic_year_id, name, \`order\`, start_date, end_date, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [academicYearId, name, order, startDate, endDate, status]
        );
        return { id: result.insertId, ...data };
    }

    async update(id, data) {
        const { name, order, startDate, endDate, status } = data;
        const [result] = await pool.query(
            `UPDATE periods
             SET name = ?, \`order\` = ?, start_date = ?, end_date = ?, status = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [name, order, startDate, endDate, status, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE periods SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, academic_year_id AS academicYearId, name, \`order\`, start_date AS startDate,
                    end_date AS endDate, status, closed_by AS closedBy, closed_at AS closedAt, deleted_at AS deletedAt
             FROM periods WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findByAcademicYear(academicYearId) {
        const [rows] = await pool.query(
            `SELECT id, academic_year_id AS academicYearId, name, \`order\`, start_date AS startDate,
                    end_date AS endDate, status, closed_by AS closedBy, closed_at AS closedAt
             FROM periods WHERE academic_year_id = ? AND deleted_at IS NULL ORDER BY \`order\``,
            [academicYearId]
        );
        return rows;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, academic_year_id AS academicYearId, name, \`order\`, start_date AS startDate,
                    end_date AS endDate, status, closed_by AS closedBy, closed_at AS closedAt
             FROM periods WHERE deleted_at IS NULL ORDER BY academic_year_id, \`order\``
        );
        return rows;
    }
}

module.exports = PeriodRepository;