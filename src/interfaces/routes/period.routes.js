const express = require('express');
const router = express.Router();
const controller = require('../controllers/period.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);

// GET - Listar períodos (admin y docente)
router.get('/', authorize(['admin', 'docente']), controller.list);

// GET - Obtener período por ID
router.get('/:id', authorize(['admin', 'docente']), controller.getById);

// POST - Crear período (solo admin)
router.post('/', authorize(['admin']), controller.create);

// PUT - Actualizar período (solo admin)
router.put('/:id', authorize(['admin']), controller.update);

// DELETE - Eliminar período (solo admin)
router.delete('/:id', authorize(['admin']), controller.delete);

// POST - Cerrar período (admin y docente)
router.post('/:id/close', authorize(['admin', 'docente']), controller.closePeriod);

// POST - Reabrir período (solo admin)
router.post('/:id/reopen', authorize(['admin']), controller.reopenPeriod);

module.exports = router;