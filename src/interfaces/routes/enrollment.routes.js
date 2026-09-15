const express = require('express');
const router = express.Router();
const controller = require('../controllers/enrollment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);

// GET - Listar matrículas (admin y docente)
router.get('/', authorize(['admin', 'docente']), controller.list);

// GET - Estudiantes sin matrícula en el año activo (debe ir antes de '/:id')
router.get('/unenrolled', authorize(['admin']), controller.listUnenrolled);

// GET - Candidatos a matricular en el año nuevo (debe ir antes de '/:id')
router.get('/new-year-candidates', authorize(['admin']), controller.newYearCandidates);

// GET - Años disponibles y matrículas por año (deben ir antes de '/:id')
router.get('/years', authorize(['admin']), controller.listYears);
router.get('/by-year', authorize(['admin']), controller.listByYear);

// POST - Matrícula en lote
router.post('/bulk', authorize(['admin']), controller.bulkCreate);

// GET - Obtener matrícula por ID (admin y docente)
router.get('/:id', authorize(['admin', 'docente']), controller.getById);

// POST - Crear matrícula (solo admin)
router.post('/', authorize(['admin']), controller.create);

// PUT - Actualizar matrícula (solo admin)
router.put('/:id', authorize(['admin']), controller.update);

// DELETE - Eliminar matrícula (solo admin)
router.delete('/:id', authorize(['admin']), controller.delete);

// POST - Trasladar estudiante a otro grupo (solo admin)
router.post('/:id/transfer', authorize(['admin']), controller.transfer);

// GET - Historial: lista de estudiantes únicos
router.get('/history/search', authorize(['admin']), controller.listHistory);
// GET - Historial: detalle de un estudiante por código
router.get('/history/student/:code', authorize(['admin']), controller.studentHistory);

module.exports = router;