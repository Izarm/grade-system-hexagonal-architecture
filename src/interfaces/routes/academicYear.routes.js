const express = require('express');
const router = express.Router();
const controller = require('../controllers/academicYear.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación y rol de administrador
router.use(authenticate, authorize(['admin']));

router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.get('/', controller.list);
router.get('/:id', controller.getById);

module.exports = router;