const express = require('express');
const router = express.Router();
const controller = require('../controllers/report.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

// Todas las rutas requieren autenticación
router.use(authenticate);

// Rutas accesibles para admin y docente
router.get('/teacher-assignments', authorize(['admin', 'docente']), controller.getTeacherAssignmentsWithGrades);
router.get('/students-list', authorize(['admin', 'docente']), controller.getStudentsList);

// Rutas solo para admin
router.get('/full-structure', authorize(['admin']), controller.getFullStructure);
router.get('/student-report-card', authorize(['admin']), controller.generateStudentReportCard);
// Listado de estudiantes por curso (PDF o Excel).
// ?academicYearId=  y opcionalmente  &groupId=  o  &gradeId=  y  &format=excel
router.get('/student-listing', authorize(['admin', 'docente']), controller.generateAlphabeticalList);
// Listado con todos los datos del estudiante (Word o Excel)
router.get('/student-data-sheet', authorize(['admin', 'docente']), controller.generateStudentDataSheet);
// Nombre anterior, se mantiene para no romper enlaces guardados.
router.get('/alphabetical-list', authorize(['admin', 'docente']), controller.generateAlphabeticalList);
router.get('/bulk-report-cards', authorize(['admin']), controller.generateBulkReportCards);

// REPORTES WORD
router.get('/period-report-word', authorize(['admin', 'docente']), controller.generatePeriodReportWord);
router.get('/final-report-word', authorize(['admin', 'docente']), controller.generateFinalReportWord);
router.get('/bulk-word-reports', authorize(['admin']), controller.generateBulkWordReports);

// BOLETINES PARA IMPRIMIR (HTML que se auto-imprime en el navegador)
router.get('/bulk-print', authorize(['admin']), controller.generateBulkPrintHTML);

// TARJETA ACUMULATIVA DE MATRÍCULA (historial de un estudiante)
router.get('/enrollment-card-word', authorize(['admin']), controller.generateEnrollmentCardWord);

// LIBRO DE CALIFICACIONES (por grado)
router.get('/grade-book-word', authorize(['admin']), controller.generateGradeBookWord);

// REPORTES WORD — POR GRADO
router.get('/grade-report-word', authorize(['admin', 'docente']), controller.generateGradeReportWord);
router.get('/grade-report-attitudinal-word', authorize(['admin', 'docente']), controller.generateGradeReportAttitudinalWord);
router.get('/grade-report-electives-word', authorize(['admin', 'docente']), controller.generateGradeReportElectivesWord);

// REPORTES EXCEL
router.get('/period-report-excel', authorize(['admin', 'docente']), controller.generatePeriodReportExcel);
router.get('/final-report-excel', authorize(['admin', 'docente']), controller.generateFinalReportExcel);
router.get('/grade-report-excel', authorize(['admin', 'docente']), controller.generateGradeReportExcel);
router.get('/grade-report-attitudinal-excel', authorize(['admin', 'docente']), controller.generateGradeReportAttitudinalExcel);
router.get('/grade-report-electives-excel', authorize(['admin', 'docente']), controller.generateGradeReportElectivesExcel);
router.get('/bulk-excel-reports', authorize(['admin']), controller.generateBulkExcelReports);

module.exports = router;