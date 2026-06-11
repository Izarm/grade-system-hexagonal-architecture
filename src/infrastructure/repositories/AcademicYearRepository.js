const pool = require('../database/mysql');

class AcademicYearRepository {
    async create(data) {
        const { name, startDate, endDate, active } = data;
        const [result] = await pool.query(
            `INSERT INTO academic_years (name, start_date, end_date, active)
             VALUES (?, ?, ?, ?)`,
            [name, startDate, endDate, active || 0]
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
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active
             FROM academic_years WHERE deleted_at IS NULL ORDER BY start_date DESC`
        );
        return rows;
    }

    async deactivateAll() {
        await pool.query(`UPDATE academic_years SET active = 0 WHERE active = 1`);
    }

    async findActive() {
        const [rows] = await pool.query(
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active
             FROM academic_years WHERE active = 1 AND deleted_at IS NULL LIMIT 1`
        );
        return rows[0] || null;
    }

    async findAllPaginated(limit, offset) {
        const [rows] = await pool.query(
            `SELECT id, name, start_date AS startDate, end_date AS endDate, active
             FROM academic_years 
             WHERE deleted_at IS NULL
             ORDER BY start_date DESC 
             LIMIT ? OFFSET ?`,
            [limit, offset]
        );
        return rows;
    }

    async countAll() {
        const [rows] = await pool.query(`SELECT COUNT(*) as total FROM academic_years WHERE deleted_at IS NULL`);
        return rows[0].total;
    }

    async deleteByAcademicYearId(academicYearId) {
        const [result] = await pool.query(
            `UPDATE periods SET deleted_at = NOW() WHERE academic_year_id = ? AND deleted_at IS NULL`,
            [academicYearId]
        );
        return result.affectedRows;
    }

    async reopenYear(yearId, userId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            const [year] = await connection.query(
                `SELECT id, name, active FROM academic_years 
                 WHERE id = ? AND deleted_at IS NULL`,
                [yearId]
            );
            
            if (year.length === 0) {
                throw new Error('Año lectivo no encontrado');
            }
            
            if (year[0].active === 1) {
                throw new Error('El año lectivo ya esta activo');
            }
            
            // Desactivar cualquier otro año activo
            await connection.query(
                `UPDATE academic_years SET active = 0 WHERE active = 1 AND id != ?`,
                [yearId]
            );
            
            // Activar el año seleccionado
            await connection.query(
                `UPDATE academic_years SET active = 1 WHERE id = ?`,
                [yearId]
            );
            
            // Reabrir periodos no vencidos
            await connection.query(
                `UPDATE periods 
                 SET status = 'open', closed_by = NULL, closed_at = NULL
                 WHERE academic_year_id = ? AND status = 'closed' AND end_date >= CURDATE()`,
                [yearId]
            );
            
            await connection.query(
                `INSERT INTO academic_year_logs (academic_year_id, action, user_id, notes)
                 VALUES (?, 'reopened', ?, ?)`,
                [yearId, userId, 'Reabierto manualmente por administrador']
            );
            
            await connection.commit();
            
            return {
                success: true,
                message: `Año ${year[0].name} reabierto exitosamente`,
                reopenedPeriods: true
            };
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = AcademicYearRepository;