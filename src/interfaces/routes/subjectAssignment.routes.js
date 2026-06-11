const express = require('express');
const router = express.Router();
const controller = require('../controllers/subjectAssignment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);

// GET - Listar asignaciones (admin y docente)
router.get('/', authorize(['admin', 'docente']), controller.list);

// GET - Todas las asignaciones de un grado (solo director de ese grado)
router.get('/by-grade/:gradeId', authorize(['admin', 'docente']), controller.listByGrade);

// GET - Obtener asignacion por ID (admin y docente)
router.get('/:id', authorize(['admin', 'docente']), controller.getById);

// POST - Crear asignacion (solo admin)
router.post('/', authorize(['admin']), controller.create);

// PUT - Actualizar asignacion (solo admin)
router.put('/:id', authorize(['admin']), controller.update);

// DELETE - Eliminar asignacion (solo admin)
router.delete('/:id', authorize(['admin']), controller.delete);

module.exports = router;