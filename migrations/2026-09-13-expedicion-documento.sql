-- ============================================================================
--  Datos de expedición del documento de identidad
--  Fecha: 2026-09-13
--
--  Agrega dos campos a la ficha del estudiante (Datos Complementarios):
--    document_issue_date  - fecha de expedición del documento
--    document_issue_place - lugar de expedición (ciudad / municipio)
--
--  Ambos aceptan NULL: los estudiantes que ya existen quedan sin el dato
--  hasta que alguien lo complete. No se modifica ningún registro.
-- ============================================================================

ALTER TABLE `students`
  ADD COLUMN `document_issue_date`  DATE         DEFAULT NULL COMMENT 'Fecha de expedición del documento'  AFTER `document_type`,
  ADD COLUMN `document_issue_place` VARCHAR(120) DEFAULT NULL COMMENT 'Lugar de expedición del documento' AFTER `document_issue_date`;

-- Para deshacerlo:
-- ALTER TABLE `students` DROP COLUMN `document_issue_date`, DROP COLUMN `document_issue_place`;
