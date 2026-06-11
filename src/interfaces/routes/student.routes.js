const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const studentController = require('../controllers/student.controller');

// Las rutas de lectura requieren autenticación (cualquier usuario logueado puede ver estudiantes)
router.get('/', authenticate, studentController.list);
router.get('/:id', authenticate, studentController.getById);

// Las rutas de escritura requieren autenticación y rol de admin
router.post('/', authenticate, authorize(['admin']), studentController.create);
router.put('/:id', authenticate, authorize(['admin']), studentController.update);
router.delete('/:id', authenticate, authorize(['admin']), studentController.delete);
router.put('/:id/folio', authenticate, authorize(['admin']), studentController.updateFolio);

module.exports = router;