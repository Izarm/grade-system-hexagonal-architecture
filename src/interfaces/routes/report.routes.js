const express = require('express');
const router = express.Router();
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// ==================== RUTAS DE REPORTES ====================

// Estructura académica completa (solo admin)
router.get('/full-structure', authenticate, authorize(['admin']), controller.getFullStructure);

// Asignaciones del docente con notas (admin y docente)
router.get('/teacher-assignments', authenticate, authorize(['admin', 'docente']), controller.getTeacherAssignmentsWithGrades);

// Lista de estudiantes para selectores (admin y docente)
router.get('/students-list', authenticate, authorize(['admin', 'docente']), controller.getStudentsList);

// Boletín individual PDF (admin y docente)
router.get('/student-report-card', authenticate, authorize(['admin', 'docente']), controller.generateStudentReportCard);

// Listado alfabético (admin y docente) - puede ser PDF o Excel por parámetro format
router.get('/alphabetical-list', authenticate, authorize(['admin', 'docente']), controller.generateAlphabeticalList);

module.exports = router;