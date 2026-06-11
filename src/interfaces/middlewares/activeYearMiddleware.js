const pool = require('../../infrastructure/database/mysql');

const injectActiveYear = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT id, name, start_date, end_date, active
             FROM academic_years 
             WHERE active = 1 AND deleted_at IS NULL 
             LIMIT 1`
        );
        
        if (rows.length === 0) {
            return res.status(400).json({ 
                message: 'No hay un año lectivo activo. Contacte al administrador.' 
            });
        }
        
        req.activeYear = rows[0];
        next();
    } catch (error) {
        console.error('Error en injectActiveYear:', error);
        res.status(500).json({ message: 'Error al obtener año activo' });
    }
};

const checkYearNotClosed = async (req, res, next) => {
    try {
        if (!req.activeYear) {
            return res.status(400).json({ message: 'No hay año activo disponible' });
        }
        
        // Si el año está activo (active = 1), se puede modificar
        // Para cerrar un año, simplemente se desactiva (active = 0)
        if (req.activeYear.active !== 1) {
            return res.status(403).json({ 
                message: 'El año lectivo está cerrado. No se pueden realizar modificaciones.' 
            });
        }
        
        next();
    } catch (error) {
        console.error('Error en checkYearNotClosed:', error);
        res.status(500).json({ message: 'Error al verificar estado del año' });
    }
};

module.exports = { injectActiveYear, checkYearNotClosed };