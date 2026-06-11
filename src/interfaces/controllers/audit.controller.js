const AuditRepository = require('../../infrastructure/repositories/AuditRepository');
const repo = new AuditRepository();

exports.list = async (req, res) => {
    try {
        const { teacherId, studentId, periodId, page = 1, limit = 50 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        const filters = { teacherId, studentId, periodId, limit, offset };
        const [rows, total] = await Promise.all([
            repo.findAll(filters),
            repo.count({ teacherId, studentId, periodId }),
        ]);
        res.json({ data: rows, total, page: Number(page), limit: Number(limit) });
    } catch (error) {
        console.error('Error en audit list:', error.message, error.code);
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return res.status(500).json({ message: 'La tabla de auditorías no existe. Ejecuta el SQL de creación en tu base de datos.' });
        }
        res.status(500).json({ message: error.message });
    }
};
