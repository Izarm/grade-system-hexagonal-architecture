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
    async checkOpen(periodId) {
        const [rows] = await pool.query(
            `SELECT status FROM periods WHERE id = ? AND deleted_at IS NULL`,
            [periodId]
        );
        if (rows.length === 0) throw new Error('Período no encontrado');
        return rows[0].status === 'open';
    }
    // src/infrastructure/repositories/PeriodRepository.js
async closePeriod(periodId, userId) {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Verificar que el período existe y está abierto
        const [period] = await connection.query(
            `SELECT status FROM periods WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
            [periodId]
        );
        if (period.length === 0) throw new Error('Período no encontrado');
        if (period[0].status === 'closed') throw new Error('El período ya está cerrado');
        
        // Cerrar el período
        const [result] = await connection.query(
            `UPDATE periods 
             SET status = 'closed', closed_by = ?, closed_at = NOW() 
             WHERE id = ? AND deleted_at IS NULL`,
            [userId, periodId]
        );
        
        await connection.commit();
        return result.affectedRows > 0;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

// Método para reabrir (opcional, solo para admin)
async reopenPeriod(periodId) {
    const [result] = await pool.query(
        `UPDATE periods 
         SET status = 'open', closed_by = NULL, closed_at = NULL 
         WHERE id = ? AND deleted_at IS NULL`,
        [periodId]
    );
    return result.affectedRows > 0;
}
}

module.exports = PeriodRepository;