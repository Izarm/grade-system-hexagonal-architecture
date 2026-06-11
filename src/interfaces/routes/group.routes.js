const express = require('express');
const router = express.Router();
const groupController = require('../controllers/group.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Las rutas de lectura solo requieren autenticación (cualquier usuario logueado)
router.get('/', authenticate, groupController.list);
router.get('/by-grade/:gradeId', authenticate, groupController.listByGrade);
router.get('/:id', authenticate, groupController.getById);

// Las rutas de escritura requieren autenticación y rol de admin
router.post('/', authenticate, authorize(['admin']), groupController.create);
router.put('/:id', authenticate, authorize(['admin']), groupController.update);
router.delete('/:id', authenticate, authorize(['admin']), groupController.delete);

module.exports = router;