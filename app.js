require('dotenv').config();

// Guard de arranque: variables críticas
if (!process.env.JWT_SECRET) {
    console.error('FATAL: JWT_SECRET no está definido en .env');
    process.exit(1);
}
const faltantes = ['DB_HOST', 'DB_USER', 'DB_NAME'].filter(v => !process.env[v]);
if (faltantes.length > 0) {
    console.error(`FATAL: faltan variables en .env: ${faltantes.join(', ')}`);
    console.error('Copia .env.example como .env y complétalo.');
    process.exit(1);
}
if (process.env.JWT_SECRET.length < 32) {
    console.warn('[SEGURIDAD] El JWT_SECRET es corto. Conviene generar uno largo con:');
    console.warn('  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
}

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
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
// Módulo San José de Tarbes
const promotionRoutes = require('./src/interfaces/routes/promotion.routes');

// Importar job de cierre automatico
const { checkAndCloseYear } = require('./src/jobs/checkYearClosure');

const app = express();

// ==================== SEGURIDAD ====================
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
}));

// CORS solo sobre /api. El frontend compilado lo sirve este mismo servidor,
// así que sus archivos no son peticiones de otro origen y no deben pasar por
// aquí: cuando lo hacían, desplegar en un puerto o dominio distinto del que
// indicaba ALLOWED_ORIGINS bloqueaba el CSS y el JavaScript de la propia
// página, y el navegador mostraba una pantalla en blanco.
const origenesPermitidos = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',').map(o => o.trim()).filter(Boolean);

const corsDeLaApi = cors((req, callback) => {
    const origen = req.headers.origin;
    // El propio host siempre vale: es la dirección desde la que se está
    // sirviendo la aplicación, cualquiera que sea. Así un despliegue nuevo
    // funciona sin tener que acordarse de configurar nada.
    const propio = req.headers.host
        ? ['http://' + req.headers.host, 'https://' + req.headers.host]
        : [];

    // Sin cabecera Origin son peticiones de la misma página o de herramientas
    // como curl; el navegador no las considera de otro origen.
    const permitido = !origen
        || origenesPermitidos.includes(origen)
        || propio.includes(origen);

    // `origin: false` simplemente no añade las cabeceras de CORS y deja que el
    // navegador bloquee la respuesta. Antes se devolvía un error, que acababa
    // en un 500 y ocultaba el motivo real.
    callback(null, { origin: permitido, credentials: true });
});
app.use('/api', corsDeLaApi);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { message: 'Demasiados intentos. Intenta de nuevo en 15 minutos.' },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use(express.json({ limit: '2mb' }));

// ==================== RUTAS API ====================
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/auth/refresh', authLimiter);
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
// Módulo San José de Tarbes
app.use('/api/promotions', promotionRoutes);

// ==================== SERVIR REACT (PRODUCCION) ====================
app.use(express.static(path.join(__dirname, 'frontend-react/dist')));

// 404 para rutas /api no encontradas (antes del wildcard del frontend)
app.use('/api', (req, res) => {
    res.status(404).json({ message: 'Endpoint no encontrado' });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend-react/dist', 'index.html'));
});

// ==================== MANEJO CENTRALIZADO DE ERRORES ====================
app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);

    // Errores propios de la aplicación: traen mensaje listo para el usuario
    // y, cuando aplica, el campo del formulario que falló.
    if (err?.isAppError) {
        const cuerpo = { message: err.message };
        if (err.field) cuerpo.field = err.field;
        return res.status(err.status).json(cuerpo);
    }

    if (err?.type === 'entity.too.large' || err?.status === 413) {
        return res.status(413).json({
            message: 'La información enviada es demasiado grande. Reduce el tamaño e intenta de nuevo.'
        });
    }
    if (err instanceof SyntaxError && 'body' in err) {
        return res.status(400).json({ message: 'La solicitud tiene un formato inválido' });
    }

    const status = err.status || err.statusCode || 500;
    if (status >= 500) {
        // No se expone el detalle interno al usuario; queda en el registro.
        console.error('[ERROR NO CONTROLADO]', err);
        return res.status(status).json({
            message: 'Ocurrió un error inesperado en el servidor. Intenta de nuevo.'
        });
    }
    res.status(status).json({ message: err.message || 'Error en la solicitud' });
});

// ==================== INICIAR SERVIDOR ====================
const PORT = process.env.PORT || 3000;

// Ejecutar cierre automatico al iniciar
checkAndCloseYear().catch(console.error);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`API disponible en http://localhost:${PORT}/api`);
});