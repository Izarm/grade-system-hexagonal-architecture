const pool = require('../../../infrastructure/database/mysql');

class CloseAcademicYear {
    constructor(academicYearRepository) {
        this.academicYearRepository = academicYearRepository;
    }

    async execute(academicYearId, closedByUserId) {
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();
            
            const [year] = await connection.query(
                `SELECT id, name, active FROM academic_years 
                 WHERE id = ? AND deleted_at IS NULL`,
                [academicYearId]
            );
            
            if (year.length === 0) {
                throw new Error('Año lectivo no encontrado');
            }
            
            if (year[0].active === 0) {
                throw new Error('El año lectivo ya esta cerrado');
            }
            
            // Cerrar todos los periodos del año
            await connection.query(
                `UPDATE periods 
                 SET status = 'closed', closed_by = ?, closed_at = NOW()
                 WHERE academic_year_id = ? AND deleted_at IS NULL AND status = 'open'`,
                [closedByUserId, academicYearId]
            );
            
            // Desactivar el año (cerrarlo)
            await connection.query(
                `UPDATE academic_years 
                 SET active = 0, updated_at = NOW()
                 WHERE id = ?`,
                [academicYearId]
            );
            
            await connection.query(
                `INSERT INTO academic_year_logs (academic_year_id, action, user_id, created_at)
                 VALUES (?, 'closed', ?, NOW())`,
                [academicYearId, closedByUserId]
            );
            
            await connection.commit();
            
            return {
                success: true,
                message: `Año lectivo ${year[0].name} cerrado exitosamente`,
                closedPeriods: true
            };
            
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = CloseAcademicYear;