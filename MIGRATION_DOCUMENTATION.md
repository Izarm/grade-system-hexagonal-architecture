# Documentación de Procesos: Integración y Migración
**Proyecto:** Proyecto Final San José de Tarbes (Proyecto1 + Módulo Matrículas CJS)
**Fecha:** 2026-07-02
**Autor:** Antigravity AI

---

## 1. Introducción y Objetivos
Este documento describe los procesos de ingeniería de software implementados para integrar el módulo de matrículas y control extracurricular del sistema antiguo "San José de Tarbes" (base de datos `CJS`) en el nuevo sistema de gestión académica "Proyecto1" (base de datos `sistema_notas`).

Los objetivos principales de este proceso son:
1.  **Unificar** ambos sistemas bajo una única base de código mantenible en Node.js y React.
2.  **Garantizar** que el nuevo sistema sea 100% compatible con los datos históricos de producción que ya existen en el servidor.
3.  **Respetar** la arquitectura hexagonal de Proyecto1 sin alterar el funcionamiento del core académico (notas, asignaciones, etc.).

---

## 2. Arquitectura de Software de la Integración

El sistema Proyecto1 se rige bajo los principios de la **Arquitectura Hexagonal**, separando las reglas de negocio de los detalles de infraestructura. El módulo de Tarbes se adaptó a esta estructura:

```
src/
├── domain/                  <-- Capa de Dominio (Entidades de Negocio puras)
│   ├── ExtracurricularActivity.js
│   └── PendingDocument.js
├── application/             <-- Capa de Aplicación (Casos de Uso)
│   ├── extracurricularActivity/
│   │   ├── CreateExtracurricularActivity.js
│   │   ├── ListExtracurricularActivities.js
│   │   ├── DeleteExtracurricularActivity.js
│   │   ├── AddStudentToActivity.js
│   │   └── RemoveStudentFromActivity.js
│   └── pendingDocument/
│       ├── CreatePendingDocument.js
│       ├── ListPendingDocuments.js
│       └── DeletePendingDocument.js
├── infrastructure/          <-- Capa de Infraestructura (Persistencia MySQL)
│   └── repositories/
│       ├── ExtracurricularActivityRepository.js
│       └── PendingDocumentRepository.js
└── interfaces/              <-- Capa de Interfaces (Controladores HTTP y Rutas)
    ├── controllers/
    │   ├── extracurricularActivity.controller.js
    │   └── pendingDocument.controller.js
    └── routes/
        ├── extracurricularActivity.routes.js
        └── pendingDocument.routes.js
```

### Proceso de Flujo de Datos
1.  **Frontend (React):** Realiza llamadas HTTP a la API REST (ej: `/api/extracurricular-activities`).
2.  **Rutas y Controladores (Interfaces):** Validan la sesión del usuario (JWT) y dirigen los datos al controlador Express adecuado.
3.  **Casos de Uso (Application):** Ejecutan la lógica del negocio. Son independientes de MySQL.
4.  **Repositorios (Infrastructure):** Implementan las interfaces del dominio para guardar los datos en MySQL utilizando sentencias optimizadas y transacciones seguras.

---

## 3. Modificaciones en la Estructura de la Base de Datos

Para admitir los datos integrados del colegio, la base de datos `sistema_notas` se amplió mediante un esquema unificado (`schema.sql`):

### 3.1. Tabla `students`
Se agregaron 12 columnas para capturar la ficha de matrícula histórica de Tarbes:
*   `document_type` (ENUM): Tipo de documento (admite los formatos heredados como `T.I` y los del nuevo sistema `T.I.`).
*   `phone_landline`, `phone_mobile1`, `phone_mobile2`: Teléfonos fijos y celulares de contacto.
*   `email_father`, `email_mother`: Correos electrónicos de los acudientes.
*   `address`: Dirección física de residencia.
*   `guardian`: Nombre del acudiente legal.
*   `admission_date`, `withdrawal_date`, `withdrawal_reason`: Control de ingresos y retiros.
*   `observations`: Comentarios sobre la matrícula.

### 3.2. Tabla `enrollments`
*   `enrollment_value` (bigint unsigned): Almacena el costo financiero de la matrícula cobrada por período académico.

### 3.3. Nuevas Tablas del Módulo Tarbes
*   `extracurricular_activities`: Tabla catálogo para actividades extracurriculares (ej. Banda, Fútbol, Teatro).
*   `student_activities`: Tabla intermedia N:M para matricular alumnos en dichas actividades y relacionarlas a su año lectivo correspondiente.
*   `pending_documents`: Registra qué documentos físicos le faltan entregar al estudiante (como copia de registro civil, fotos, etc.) almacenando la lista en una columna nativa tipo `JSON`.

---

## 4. Proceso de Migración de Datos Históricos (CJS ➔ sistema_notas)

La migración se diseñó para ejecutarse directamente en la base de datos en el servidor de producción a través de un script de transformación inteligente (`data_migration_tarbes_to_proyecto1.sql`).

```
[Base de Datos Antigua CJS] 
       │
       ▼ (Proceso ETL mediante SQL)
 1. Unificar Nombres y Limpiar Documentos (personas + estudiantes)
 2. Generar IDs únicos para Docentes ('CJS-' + id_usuario)
 3. Mapear Cursos textuales a Grados numéricos y Grupos
 4. Relacionar Matrículas al Año Lectivo activo y capturar cobro
 5. Transferir Catálogo de Actividades Extracurriculares
 6. Mapear Inscripciones activas
 7. Convertir Documentos pendientes a JSON válido
       │
       ▼
[Base de Datos Nueva sistema_notas]
```

### Descripción de las Etapas:
1.  **Etapa de Limpieza:** Convierte los tipos de documento sin puntos (`R.C`, `T.I`) al estándar con puntos (`R.C.`, `T.I.`).
2.  **Etapa de Cuentas:** Migra las credenciales encriptadas en bcrypt de los docentes para garantizar que conserven la contraseña con la que venían trabajando.
3.  **Etapa de Grados:** Traduce "Primero A" en Tarbes a Grado `1`, Grupo `A` en el nuevo sistema.
4.  **Etapa de Transacciones:** Asigna folios automáticos ordenados de forma alfabética y conserva el historial económico de matrículas.
5.  **Etapa de Documentación:** Valida si el campo de documentos pendientes es un JSON válido; de lo contrario, lo encapsula automáticamente en un array para evitar errores en la aplicación de Node.js.

---

## 5. Pruebas y Control de Calidad (QA)

Para verificar la consistencia del sistema se diseñó un flujo de testing automático:
*   **Seed de Pruebas Integrado:** Genera 14 alumnos reales en la base de datos local con datos de matrícula completos, notas distribuidas en los cuatro períodos académicos e inscripciones a actividades de muestra.
*   **Pruebas de Cobertura de API:** Se programó un script (`api_test.js`) que hace solicitudes HTTP reales al servidor local para validar 26 endpoints del sistema integrado (login, reportes, documentos pendientes, actualizar estudiantes) garantizando que no haya caídas y que las reglas de negocio funcionen.
*   **Compilación del Frontend:** Se verifica mediante un build de producción (`npm run build` en el frontend React) la correcta importación de los nuevos componentes y estilos visuales.
