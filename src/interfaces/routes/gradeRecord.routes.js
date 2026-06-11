const express = require('express');
const router = express.Router();
const controller = require('../controllers/gradeRecord.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const { injectActiveYear, checkYearNotClosed } = require('../middlewares/activeYearMiddleware');

router.use(authenticate);
router.use(injectActiveYear);

router.get('/teacher-assignments', authorize(['docente', 'admin']), controller.getTeacherAssignments);
router.get('/grades', authorize(['docente', 'admin']), controller.getGrades);
router.get('/student-report', authorize(['docente', 'admin', 'estudiante']), controller.getStudentReport);
router.post('/grades', authorize(['docente', 'admin']), checkYearNotClosed, controller.saveGrade);

module.exports = router;