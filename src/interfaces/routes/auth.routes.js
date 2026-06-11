const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Rutas públicas
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/register', authController.register); // Registro público

// Perfil propio (cualquier usuario autenticado)
router.get('/me', authenticate, authController.getMe);
router.put('/me', authenticate, authController.updateMe);

// Rutas protegidas (solo admin)
router.get('/users/pending', authenticate, authorize(['admin']), authController.getPendingUsers);
router.put('/approve/:userId', authenticate, authorize(['admin']), authController.approveUser);
router.put('/reject/:userId', authenticate, authorize(['admin']), authController.rejectUser);

module.exports = router;