const express = require('express');
const router = express.Router();
const controller = require('../controllers/gradeRecord.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Docentes pueden ver sus asignaciones y gestionar notas
router.get('/teacher-assignments', authorize(['docente', 'admin']), controller.getTeacherAssignments);
router.get('/grades', authorize(['docente', 'admin']), controller.getGrades);
router.post('/grades', authorize(['docente', 'admin']), controller.saveGrade);
router.get('/student-report', authorize(['docente', 'admin', 'estudiante']), controller.getStudentReport);

module.exports = router;