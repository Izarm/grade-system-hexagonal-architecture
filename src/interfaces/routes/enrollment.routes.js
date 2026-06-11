const express = require('express');
const router = express.Router();
const controller = require('../controllers/enrollment.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);

// GET - Listar matrículas (admin y docente)
router.get('/', authorize(['admin', 'docente']), controller.list);

// GET - Obtener matrícula por ID (admin y docente)
router.get('/:id', authorize(['admin', 'docente']), controller.getById);

// POST - Crear matrícula (solo admin)
router.post('/', authorize(['admin']), controller.create);

// PUT - Actualizar matrícula (solo admin)
router.put('/:id', authorize(['admin']), controller.update);

// DELETE - Eliminar matrícula (solo admin)
router.delete('/:id', authorize(['admin']), controller.delete);

module.exports = router;