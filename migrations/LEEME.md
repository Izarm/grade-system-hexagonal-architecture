# Migraciones de la base de datos

## Los dos archivos y para qué sirve cada uno

**`schema.sql`** (en la raíz del proyecto) crea la estructura completa desde
cero. Se usa para montar una instalación nueva. Está generado a partir de la
base en producción, así que refleja su estado exacto: 23 tablas.

**Esta carpeta** guarda los cambios de estructura que se aplicaron *después*,
para que una base ya existente pueda ponerse al día sin volver a crearse.

Una instalación nueva **no** necesita ejecutar nada de aquí: `schema.sql` ya
incluye todos estos cambios.

## Estado en producción

Al 15 de septiembre de 2026, las dos migraciones están aplicadas:

| Archivo | Qué hace | Estado |
|---|---|---|
| `add_promotion_status.sql` | Agrega `enrollments.promotion_status` | Aplicada |
| `2026-09-13-expedicion-documento.sql` | Agrega `students.document_issue_date` y `document_issue_place` | Aplicada |

**No volver a ejecutarlas.** Un `ALTER TABLE ... ADD COLUMN` sobre una columna
que ya existe falla con `ER_DUP_FIELDNAME`.

Para comprobar si una columna ya está antes de tocar nada:

```sql
SELECT COLUMN_NAME FROM information_schema.COLUMNS
 WHERE TABLE_SCHEMA = 'sistema_notas'
   AND TABLE_NAME   = 'students'
   AND COLUMN_NAME  = 'document_issue_date';
```

## Cambios que no tienen archivo aquí

Hay cambios de estructura que se hicieron con scripts de migración de datos, no
con archivos de esta carpeta. Están todos recogidos en `schema.sql`, pero
conviene dejar constancia de qué fueron:

- **`students.last_name` / `first_name`** y **`users.last_name` / `first_name`** —
  la división del nombre en dos campos. `students.full_name` y `users.name`
  pasaron a ser **columnas calculadas** (`GENERATED ALWAYS AS ... STORED`):
  se leen con normalidad pero **nunca se escriben**; MySQL las actualiza sola.
  Intentar escribirlas devuelve `ER_NON_DEFAULT_VALUE_FOR_GENERATED_COLUMN`.
- **`grades.takes_grades`** — marca los grados que no llevan notas (preescolar).
- **`groups.head_teacher_id`** — el director de grado del curso.
- **`students.documents`** — el listado de documentos entregados.
- Tablas **`enrollment_history`** y **`teacher_replacement_logs`**.

## Limpieza del 15 de septiembre de 2026

Se eliminó la tabla **`groups_backup`**, resto de una migración antigua. Antes
de borrarla se comprobó que tuviera 0 filas, que ninguna clave foránea la
relacionara y que ninguna vista la usara. La base pasó de 23 a 22 tablas y
`schema.sql` se regeneró.

## Cómo escribir una migración nueva

1. Nombre con fecha por delante, para que el orden se lea solo:
   `2026-10-02-descripcion-corta.sql`.
2. Una cabecera que diga qué cambia y por qué.
3. Al final, en comentario, cómo deshacerlo.
4. Aplicarla en producción y anotarla en la tabla de arriba.
5. Regenerar `schema.sql` para que vuelva a coincidir con la base.
