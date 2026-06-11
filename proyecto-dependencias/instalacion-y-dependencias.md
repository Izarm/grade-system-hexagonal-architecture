# Guía de Instalación — Sistema de Gestión Académica
## Colegio San José de Tarbes

---

## Requisitos previos

Tener instalado en el sistema:

| Herramienta | Versión mínima | Descarga |
|-------------|---------------|----------|
| Node.js     | 18 o superior | https://nodejs.org |
| MySQL       | 8.0 o superior | https://dev.mysql.com/downloads/ |
| npm         | Incluido con Node.js | — |

---

## Estructura del proyecto

```
Proyecto/
├── app.js                        ← Punto de entrada del servidor
├── package.json                  ← Dependencias del backend
├── .env                          ← Variables de entorno (no subir a git)
├── src/                          ← Backend (arquitectura hexagonal)
│   ├── domain/                   ← Entidades y contratos
│   ├── application/              ← Casos de uso
│   ├── infrastructure/           ← Repositorios, base de datos
│   └── interfaces/               ← Controladores y rutas HTTP
├── frontend-react/               ← Frontend React + Vite
│   ├── package.json              ← Dependencias del frontend
│   └── src/
│       ├── pages/                ← AdminDashboard, TeacherDashboard
│       ├── components/           ← Componentes por módulo
│       └── contexts/             ← AuthContext
└── proyecto-dependencias/        ← Esta carpeta (guía + base de datos)
```

---

## Paso 1 — Configurar la base de datos

1. Abrir MySQL (terminal, phpMyAdmin, DBeaver o MySQL Workbench).
2. Ejecutar el archivo `base-de-datos.sql` que está en esta misma carpeta:

```bash
mysql -u root -p < base-de-datos.sql
```

Esto crea la base de datos `sistema_notas` con todas las tablas y un usuario administrador inicial.

**Credenciales del administrador inicial:**
- Email: `admin@colegio.edu`
- Contraseña: `Admin1234`
- Cambiar la contraseña después del primer inicio de sesión.

---

## Paso 2 — Configurar variables de entorno

Crear un archivo `.env` en la raíz del proyecto (junto a `app.js`) con el siguiente contenido:

```env
# Base de datos
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=tu_contraseña_mysql
DB_NAME=sistema_notas

# JWT
JWT_SECRET=clave_secreta_muy_larga_y_segura

# Servidor
PORT=3000

# Email (para recuperación de contraseña)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=correo@gmail.com
EMAIL_PASS=contraseña_de_aplicacion
```

> El archivo `.env` nunca debe subirse a repositorios públicos.

---

## Paso 3 — Instalar dependencias del backend

Desde la raíz del proyecto (`Proyecto/`):

```bash
npm install
```

### Dependencias del backend (package.json)

| Paquete | Versión | Uso |
|---------|---------|-----|
| express | ^4.22 | Servidor HTTP y rutas |
| mysql2 | ^3.20 | Conexión a MySQL con pool |
| jsonwebtoken | ^9.0 | Autenticación JWT |
| bcrypt | ^6.0 | Cifrado de contraseñas |
| dotenv | ^16.6 | Variables de entorno |
| cors | ^2.8 | Permitir peticiones del frontend |
| nodemailer | ^8.0 | Envío de emails (recuperar contraseña) |
| pdfkit | ^0.18 | Generación de reportes PDF |
| exceljs | ^4.4 | Generación de reportes Excel |
| docx | ^9.7 | Generación de reportes Word |
| archiver | ^7.0 | Comprimir archivos para descarga |
| axios | ^1.16 | Peticiones HTTP desde el servidor |
| he | ^1.2 | Decodificación de entidades HTML |
| react-router-dom | ^7.14 | (incluido en backend por build) |

### DevDependencias del backend

| Paquete | Uso |
|---------|-----|
| nodemon | ^3.0 | Reinicio automático en desarrollo |

---

## Paso 4 — Instalar dependencias del frontend

Entrar a la carpeta del frontend e instalar:

```bash
cd frontend-react
npm install
```

### Dependencias del frontend (frontend-react/package.json)

| Paquete | Versión | Uso |
|---------|---------|-----|
| react | ^19.2 | Librería principal de UI |
| react-dom | ^19.2 | Renderizado en el DOM |
| react-router-dom | ^7.14 | Navegación entre páginas |
| axios | ^1.16 | Peticiones HTTP a la API |
| @heroicons/react | ^2.2 | Íconos SVG |
| lucide-react | ^1.17 | Íconos adicionales SVG |

### DevDependencias del frontend

| Paquete | Uso |
|---------|-----|
| vite | ^8.0 | Bundler y servidor de desarrollo |
| @vitejs/plugin-react | ^6.0 | Soporte JSX/React en Vite |
| tailwindcss | ^3.4 | Estilos CSS utilitarios |
| postcss | ^8.5 | Procesador CSS (requerido por Tailwind) |
| autoprefixer | ^10.5 | Prefijos CSS automáticos |
| eslint | ^10.2 | Linter de código |
| eslint-plugin-react-hooks | ^7.1 | Reglas de hooks de React |
| eslint-plugin-react-refresh | ^0.5 | Soporte para hot reload |

---

## Paso 5 — Compilar el frontend

El frontend se sirve como archivos estáticos desde el servidor Node. Hay que compilarlo:

```bash
cd frontend-react
npm run build
```

Esto genera la carpeta `frontend-react/dist/` que el servidor Express sirve automáticamente.

> Cada vez que se hagan cambios en el frontend, hay que volver a ejecutar `npm run build` y reiniciar el servidor.

---

## Paso 6 — Iniciar el servidor

Desde la raíz del proyecto:

```bash
# Producción
npm start

# Desarrollo (reinicio automático con nodemon)
npm run dev
```

El sistema queda disponible en: **http://localhost:3000**

---

## Resumen de comandos

```bash
# 1. Importar base de datos
mysql -u root -p < proyecto-dependencias/base-de-datos.sql

# 2. Instalar backend
npm install

# 3. Instalar y compilar frontend
cd frontend-react && npm install && npm run build && cd ..

# 4. Iniciar servidor
npm start
```

---

## Tablas de la base de datos

| Tabla | Descripción |
|-------|-------------|
| academic_years | Años lectivos |
| users | Administradores y docentes |
| students | Estudiantes |
| grades | Grados (1° a 11°) |
| groups | Grupos por grado (A, B, C…) |
| subjects | Asignaturas obligatorias |
| periods | Períodos académicos por año |
| enrollments | Matrículas de estudiantes |
| subject_assignments | Asignación docente-asignatura-grupo |
| grade_records | Notas por estudiante, período y asignatura |
| grade_audit_logs | Auditoría de cambios en calificaciones |
| head_teacher_reviews | Observaciones del director de grupo |
| elective_subjects | Catálogo de asignaturas electivas |
| elective_assignments | Ofertas de electivas por año |
| student_elective_enrollments | Inscripción de estudiantes en electivas |
