// src/interfaces/routes/report.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Admin puede ver estructura completa
router.get('/full-structure', authenticate, authorize(['admin']), controller.getFullStructure);

// Docentes y admin pueden ver asignaciones con notas
router.get('/teacher-assignments', authenticate, authorize(['docente', 'admin']), controller.getTeacherAssignmentsWithGrades);

module.exports = router;