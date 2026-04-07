// src/interfaces/routes/auth.routes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Ruta pública: login
router.post('/login', authController.login);

// Ruta protegida: registro (solo admin)
router.post('/register', authenticate, authorize(['admin']), authController.register);

module.exports = router;