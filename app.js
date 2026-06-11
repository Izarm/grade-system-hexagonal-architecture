require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas API
const authRoutes = require('./src/interfaces/routes/auth.routes');
const academicYearRoutes = require('./src/interfaces/routes/academicYear.routes');
const periodRoutes = require('./src/interfaces/routes/period.routes');
const gradeRoutes = require('./src/interfaces/routes/grade.routes');
const groupRoutes = require('./src/interfaces/routes/group.routes');
const subjectRoutes = require('./src/interfaces/routes/subject.routes');
const subjectAssignmentRoutes = require('./src/interfaces/routes/subjectAssignment.routes');
const userRoutes = require('./src/interfaces/routes/user.routes');
const reportRoutes = require('./src/interfaces/routes/report.routes');
const studentRoutes = require('./src/interfaces/routes/student.routes');
const enrollmentRoutes = require('./src/interfaces/routes/enrollment.routes');
const gradeRecordRoutes = require('./src/interfaces/routes/gradeRecord.routes');
const headTeacherReviewRoutes = require('./src/interfaces/routes/headTeacherReview.routes');
const dashboardRoutes = require('./src/interfaces/routes/dashboard.routes');
const auditRoutes = require('./src/interfaces/routes/audit.routes');

// Importar job de cierre automatico
const { checkAndCloseYear } = require('./src/jobs/checkYearClosure');

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// ==================== RUTAS API ====================
app.use('/api/auth', authRoutes);
app.use('/api/academic-years', academicYearRoutes);
app.use('/api/periods', periodRoutes);
app.use('/api/grades', gradeRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/subjects', subjectRoutes);
app.use('/api/subject-assignments', subjectAssignmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/grade-records', gradeRecordRoutes);
app.use('/api/head-teacher-reviews', headTeacherReviewRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit-logs', auditRoutes);

// ==================== SERVIR REACT (PRODUCCION) ====================
app.use(express.static(path.join(__dirname, 'frontend-react/dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-react/dist', 'index.html'));
});

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3000;

// Ejecutar cierre automatico al iniciar
checkAndCloseYear().catch(console.error);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}/api`);
});