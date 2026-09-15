# Sistema de Notas — Colegio San José de Tarbes

Aplicación web para la gestión académica del colegio: fichas de estudiantes,
matrículas, calificaciones, listados e informes.

- **Backend** — Node.js + Express, arquitectura hexagonal, MySQL.
- **Frontend** — React + Vite, compilado y servido por el propio backend.

En producción no hay dos servidores: Express sirve la API en `/api` y entrega
el frontend ya compilado para todo lo demás. Un solo proceso, un solo puerto.

---

## Requisitos

| | Versión |
|---|---|
| Node.js | 18 o superior |
| MySQL | 8.0 o superior |

MySQL 8 es obligatorio: el esquema usa **columnas calculadas**
(`GENERATED ALWAYS AS ... STORED`) para el nombre completo.

---

## Despliegue desde cero

### 1 · Base de datos

```bash
mysql -u root -p < schema.sql
mysql -u root -p sistema_notas < datos-iniciales.sql
```

El primero crea la estructura vacía (22 tablas). El segundo carga los datos del
colegio: 603 estudiantes, 43 usuarios y el histórico de matrículas.

> **`schema.sql` borra las tablas antes de crearlas.** No lo ejecute sobre una
> base que ya tenga información.

Si solo quiere la estructura, sin datos, omita el segundo comando.

### 2 · Variables de entorno

```bash
cp .env.example .env
```

Abra `.env` y complete los valores. Los obligatorios son `DB_HOST`, `DB_USER`,
`DB_NAME` y `JWT_SECRET`; sin ellos la aplicación se niega a arrancar y explica
cuál falta.

Para generar el `JWT_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

No hace falta tocar `ALLOWED_ORIGINS` para un despliegue normal: el servidor
acepta siempre su propia dirección, sea cual sea el dominio o el puerto. Solo
se añaden orígenes aquí cuando el frontend se sirve por separado —por ejemplo
el `npm run dev` de Vite en el puerto 5173— y consume esta API.

### 3 · Dependencias

```bash
npm install
cd frontend-react && npm install && cd ..
```

### 4 · Compilar el frontend

```bash
cd frontend-react && npm run build && cd ..
```

Genera `frontend-react/dist`, que es lo que Express entrega. **Repita este paso
cada vez que cambie algo del frontend**: el servidor sirve el compilado, no el
código fuente.

### 5 · Arrancar

```bash
npm start
```

La aplicación queda en `http://localhost:3000`.

---

## Entrar por primera vez

Los datos iniciales incluyen las cuentas del colegio. Si necesita una nueva,
regístrese desde la pantalla de entrada y pida a un administrador que la
apruebe en **Docentes › Pendientes**.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm start` | Arranca el servidor |
| `npm run dev` | Arranca con recarga automática (nodemon) |
| `npm test` | Ejecuta las 51 pruebas |

Las pruebas no necesitan base de datos: comprueban el manejo de nombres, el
orden de los grados, la regla del folio y la traducción de errores de MySQL.

---

## Estructura

```
app.js                  arranque del servidor y middleware
src/
  application/          casos de uso
  infrastructure/       repositorios, acceso a MySQL, constantes
  interfaces/           rutas, controladores, middleware de autenticación
  shared/               utilidades comunes (nombres, errores, orden de grados)
  jobs/                 cierre automático del año lectivo
frontend-react/
  src/                  código de la interfaz
  dist/                 compilado que sirve Express
migrations/             cambios de estructura posteriores al esquema base
tests/                  pruebas automáticas
schema.sql              estructura de la base
datos-iniciales.sql     datos del colegio
```

---

## Dos reglas del sistema que conviene conocer

**El nombre completo no se escribe.** `students.full_name` y `users.name` son
columnas que MySQL calcula a partir de `last_name` y `first_name`. Se leen con
normalidad, pero intentar escribirlas devuelve un error. Envíe siempre los
apellidos y los nombres por separado.

**El folio se numera por bloques**, no por curso: 1° a 5°, 6° a 9° y 10° a 11°.
Dentro de cada bloque la numeración es continua y vuelve a empezar en el
siguiente. Preescolar no lleva folio. Se recalcula solo al matricular,
trasladar, eliminar una matrícula o corregir unos apellidos.

---

## Antes de subir a un repositorio

`.env` y `node_modules/` ya están en `.gitignore`.

**`datos-iniciales.sql` contiene datos personales de estudiantes menores de
edad y de sus familias.** Si el repositorio va a ser público, añádalo a
`.gitignore` y haga llegar el archivo por otro medio.
