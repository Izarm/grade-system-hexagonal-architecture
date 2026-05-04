require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

// Importar rutas de API
const authRoutes = require('./src/interfaces/routes/auth.routes');

const app = express();

// Middlewares globales
app.use(cors());
app.use(express.json());

// Servir archivos estáticos desde la carpeta 'frontend'
app.use(express.static(path.join(__dirname, 'frontend')));

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/academic-years', require('./src/interfaces/routes/academicYear.routes'));
app.use('/api/periods', require('./src/interfaces/routes/period.routes'));
app.use('/api/grades', require('./src/interfaces/routes/grade.routes'));
app.use('/api/groups', require('./src/interfaces/routes/group.routes'));
app.use('/api/subjects', require('./src/interfaces/routes/subject.routes'));
app.use('/api/subject-assignments', require('./src/interfaces/routes/subjectAssignment.routes'));
app.use('/api/users', require('./src/interfaces/routes/user.routes'));
app.use('/api/grade-records', require('./src/interfaces/routes/gradeRecord.routes'));
app.use('/api/reports', require('./src/interfaces/routes/report.routes'));

// Rutas del frontend (para redirigir después del login)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'login.html'));
});
app.get('/admin/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'admin-dashboard.html'));
});
app.get('/docente/dashboard', (req, res) => {
    // Si aún no tienes docente-dashboard.html, puedes redirigir a admin o crear uno
    res.sendFile(path.join(__dirname, 'frontend', 'admin-dashboard.html'));
});
app.get('/teacher/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'frontend', 'teacher-dashboard.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en puerto ${PORT}`);
});
