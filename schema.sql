-- ============================================================================
--  ESQUEMA DE LA BASE DE DATOS
--  Sistema de Notas - Colegio San Jose de Tarbes
--
--  Generado el 2026-09-15 a partir de la base de datos en produccion,
--  de modo que refleja exactamente su estado. No se edita a mano: si cambia
--  la base, se vuelve a generar.
--
--  Contiene 22 tablas. Crea la estructura vacia, sin datos.
--
--  Para montar una instalacion nueva:
--      mysql -u root -p < schema.sql
--
--  CUIDADO: este archivo borra las tablas antes de crearlas. No ejecutarlo
--  sobre una base con informacion.
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `sistema_notas`
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE `sistema_notas`;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------------
--  Se eliminan primero. Con las claves foraneas desactivadas el orden da igual.
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS `academic_year_logs`;
DROP TABLE IF EXISTS `academic_years`;
DROP TABLE IF EXISTS `elective_assignments`;
DROP TABLE IF EXISTS `elective_subjects`;
DROP TABLE IF EXISTS `enrollment_history`;
DROP TABLE IF EXISTS `enrollment_transfer_logs`;
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `extracurricular_activities`;
DROP TABLE IF EXISTS `grade_audit_logs`;
DROP TABLE IF EXISTS `grade_records`;
DROP TABLE IF EXISTS `grades`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `head_teacher_reviews`;
DROP TABLE IF EXISTS `pending_documents`;
DROP TABLE IF EXISTS `periods`;
DROP TABLE IF EXISTS `student_activities`;
DROP TABLE IF EXISTS `student_elective_enrollments`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `subject_assignments`;
DROP TABLE IF EXISTS `subjects`;
DROP TABLE IF EXISTS `teacher_replacement_logs`;
DROP TABLE IF EXISTS `users`;

-- ---------------------------------------------------------------------------
--  academic_year_logs
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `academic_year_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `academic_year_id` bigint unsigned NOT NULL,
  `action` enum('opened','closed','reopened','auto_closed') NOT NULL,
  `user_id` bigint unsigned DEFAULT NULL,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_year` (`academic_year_id`),
  KEY `idx_action` (`action`),
  KEY `fk_logs_user` (`user_id`),
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `fk_logs_year` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
--  academic_years
--  En produccion tiene 2 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `academic_years` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(20) NOT NULL,
  `start_date` date NOT NULL COMMENT 'Fecha de inicio del a??o lectivo',
  `end_date` date NOT NULL COMMENT 'Fecha de finalizaci??n del a??o lectivo',
  `active` tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Solo uno puede estar activo',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_academic_years_active` (`active`),
  KEY `idx_academic_years_dates` (`start_date`,`end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='A??os lectivos';

-- ---------------------------------------------------------------------------
--  elective_assignments
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `elective_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `elective_subject_id` bigint unsigned NOT NULL,
  `teacher_id` bigint unsigned NOT NULL,
  `academic_year_id` bigint unsigned NOT NULL,
  `period_id` bigint unsigned DEFAULT NULL,
  `max_students` int unsigned DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_elective_offering` (`elective_subject_id`,`academic_year_id`,`period_id`),
  KEY `elective_assignments_ibfk_2` (`teacher_id`),
  KEY `elective_assignments_ibfk_3` (`academic_year_id`),
  KEY `elective_assignments_ibfk_4` (`period_id`),
  CONSTRAINT `elective_assignments_ibfk_1` FOREIGN KEY (`elective_subject_id`) REFERENCES `elective_subjects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_4` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Asignaci??n de docentes a electivas';

-- ---------------------------------------------------------------------------
--  elective_subjects
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `elective_subjects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_elective_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Asignaturas electivas';

-- ---------------------------------------------------------------------------
--  enrollment_history
--  En produccion tiene 2128 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `enrollment_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_code` varchar(50) DEFAULT NULL,
  `student_name` varchar(255) DEFAULT NULL,
  `grade_name` varchar(50) DEFAULT NULL,
  `group_name` varchar(10) DEFAULT NULL,
  `academic_year` int DEFAULT NULL,
  `enrollment_value` decimal(10,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
--  enrollment_transfer_logs
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `enrollment_transfer_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `enrollment_id` bigint unsigned NOT NULL,
  `student_id` bigint unsigned NOT NULL,
  `from_group_id` bigint unsigned NOT NULL,
  `to_group_id` bigint unsigned NOT NULL,
  `from_group_name` varchar(50) NOT NULL,
  `to_group_name` varchar(50) NOT NULL,
  `academic_year_id` bigint unsigned NOT NULL,
  `warnings` text,
  `transferred_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_etl_enrollment` (`enrollment_id`),
  KEY `idx_etl_student` (`student_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
--  enrollments
--  En produccion tiene 1005 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `enrollments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint unsigned NOT NULL,
  `group_id` bigint unsigned NOT NULL,
  `grade_id` bigint unsigned DEFAULT NULL,
  `academic_year_id` bigint unsigned NOT NULL,
  `enrollment_value` bigint unsigned DEFAULT NULL COMMENT 'Valor econ??mico de la matr??cula',
  `folio_number` int unsigned DEFAULT NULL COMMENT 'N??mero de folio secuencial asignado',
  `promotion_status` enum('pending','promoted','held_back') NOT NULL DEFAULT 'pending',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_enrollment` (`student_id`,`group_id`,`academic_year_id`),
  KEY `idx_enrollments_student` (`student_id`),
  KEY `idx_enrollments_group` (`group_id`),
  KEY `idx_enrollments_year` (`academic_year_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `enrollments_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Matr??culas por a??o lectivo';

-- ---------------------------------------------------------------------------
--  extracurricular_activities
--  En produccion tiene 10 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `extracurricular_activities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `activity_code` varchar(50) NOT NULL COMMENT 'C??digo de actividad ??nico',
  `activity_name` varchar(100) NOT NULL COMMENT 'Nombre de la actividad',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_activity_code` (`activity_code`),
  UNIQUE KEY `unique_activity_name` (`activity_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Cat??logo de actividades extracurriculares';

-- ---------------------------------------------------------------------------
--  grade_audit_logs
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `grade_audit_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `teacher_id` bigint unsigned NOT NULL,
  `enrollment_id` bigint unsigned NOT NULL,
  `subject_assignment_id` bigint unsigned NOT NULL,
  `period_id` bigint unsigned NOT NULL,
  `action` enum('create','update') NOT NULL,
  `field` varchar(50) NOT NULL,
  `old_value` varchar(50) DEFAULT NULL,
  `new_value` varchar(50) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `grade_audit_logs_ibfk_1` (`teacher_id`),
  KEY `grade_audit_logs_ibfk_2` (`enrollment_id`),
  KEY `grade_audit_logs_ibfk_3` (`subject_assignment_id`),
  KEY `grade_audit_logs_ibfk_4` (`period_id`),
  CONSTRAINT `grade_audit_logs_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_2` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_3` FOREIGN KEY (`subject_assignment_id`) REFERENCES `subject_assignments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_4` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Auditor??a de calificaciones';

-- ---------------------------------------------------------------------------
--  grade_records
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `grade_records` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `enrollment_id` bigint unsigned NOT NULL,
  `period_id` bigint unsigned NOT NULL,
  `subject_assignment_id` bigint unsigned NOT NULL,
  `normal_note` text,
  `aptitudinal_note` decimal(4,2) DEFAULT NULL,
  `absences` int DEFAULT '0',
  `is_elective` tinyint(1) DEFAULT '0',
  `average` decimal(4,2) DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_grade_record` (`enrollment_id`,`period_id`,`subject_assignment_id`),
  KEY `grade_records_ibfk_2` (`period_id`),
  KEY `grade_records_ibfk_3` (`subject_assignment_id`),
  CONSTRAINT `grade_records_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_records_ibfk_2` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_records_ibfk_3` FOREIGN KEY (`subject_assignment_id`) REFERENCES `subject_assignments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Registro de notas por per??odo y asignatura';

-- ---------------------------------------------------------------------------
--  grades
--  En produccion tiene 30 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `grades` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `full_name` varchar(200) DEFAULT NULL,
  `head_teacher_id` bigint unsigned DEFAULT NULL COMMENT 'Docente director de grado',
  `is_elective` tinyint(1) DEFAULT '0',
  `academic_year_id` bigint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `takes_grades` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `head_teacher_id` (`head_teacher_id`),
  CONSTRAINT `grades_ibfk_1` FOREIGN KEY (`head_teacher_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Grados escolares';

-- ---------------------------------------------------------------------------
--  groups
--  En produccion tiene 52 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `groups` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `grade_id` bigint unsigned NOT NULL COMMENT 'Grado al que pertenece',
  `name` varchar(100) NOT NULL COMMENT 'Letra del grupo (A, B, C???)',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `head_teacher_id` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_group_per_grade` (`grade_id`,`name`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Grupos por grado';

-- ---------------------------------------------------------------------------
--  head_teacher_reviews
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `head_teacher_reviews` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint unsigned NOT NULL,
  `period_id` bigint unsigned DEFAULT NULL,
  `academic_year_id` bigint unsigned NOT NULL,
  `review` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `head_teacher_reviews_ibfk_1` (`student_id`),
  KEY `head_teacher_reviews_ibfk_2` (`period_id`),
  KEY `head_teacher_reviews_ibfk_3` (`academic_year_id`),
  CONSTRAINT `head_teacher_reviews_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `head_teacher_reviews_ibfk_2` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE SET NULL,
  CONSTRAINT `head_teacher_reviews_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Observaciones del director de grado';

-- ---------------------------------------------------------------------------
--  pending_documents
--  En produccion tiene 130 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `pending_documents` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint unsigned NOT NULL,
  `document_code` varchar(50) NOT NULL,
  `document_names` json NOT NULL COMMENT 'Array JSON con la lista de documentos',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_document_code` (`document_code`),
  KEY `pd_ibfk_student` (`student_id`),
  CONSTRAINT `pd_ibfk_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Documentos f??sicos pendientes de estudiantes';

-- ---------------------------------------------------------------------------
--  periods
--  En produccion tiene 8 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `periods` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `academic_year_id` bigint unsigned NOT NULL,
  `name` varchar(50) NOT NULL,
  `order` tinyint unsigned NOT NULL COMMENT 'Orden del per??odo',
  `start_date` date DEFAULT NULL,
  `end_date` date DEFAULT NULL,
  `percentage` decimal(5,2) DEFAULT NULL,
  `status` enum('open','closed') NOT NULL DEFAULT 'open',
  `closed_by` bigint unsigned DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period_order` (`academic_year_id`,`order`),
  KEY `idx_periods_academic_year` (`academic_year_id`),
  KEY `idx_periods_status` (`status`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `periods_ibfk_1` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `periods_ibfk_2` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Per??odos acad??micos';

-- ---------------------------------------------------------------------------
--  student_activities
--  En produccion tiene 297 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `student_activities` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint unsigned NOT NULL,
  `activity_id` bigint unsigned NOT NULL,
  `enrollment_id` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_activity` (`student_id`,`activity_id`),
  KEY `sa_ibfk_activity` (`activity_id`),
  KEY `sa_ibfk_enrollment` (`enrollment_id`),
  CONSTRAINT `sa_ibfk_activity` FOREIGN KEY (`activity_id`) REFERENCES `extracurricular_activities` (`id`) ON DELETE CASCADE,
  CONSTRAINT `sa_ibfk_enrollment` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE SET NULL,
  CONSTRAINT `sa_ibfk_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Estudiantes inscritos en actividades extracurriculares';

-- ---------------------------------------------------------------------------
--  student_elective_enrollments
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `student_elective_enrollments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id` bigint unsigned NOT NULL,
  `elective_assignment_id` bigint unsigned NOT NULL,
  `enrollment_date` date NOT NULL DEFAULT (curdate()),
  `status` enum('active','dropped') NOT NULL DEFAULT 'active',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_elective` (`student_id`,`elective_assignment_id`),
  KEY `student_elective_enrollments_ibfk_2` (`elective_assignment_id`),
  CONSTRAINT `student_elective_enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `student_elective_enrollments_ibfk_2` FOREIGN KEY (`elective_assignment_id`) REFERENCES `elective_assignments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Inscripci??n de estudiantes en electivas';

-- ---------------------------------------------------------------------------
--  students
--  Columna calculada por MySQL: full_name.
--  No se escribe nunca: se actualiza sola al cambiar las columnas de origen.
--  En produccion tiene 603 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `students` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `last_name` varchar(80) NOT NULL DEFAULT '' COMMENT 'Apellidos',
  `first_name` varchar(80) NOT NULL DEFAULT '' COMMENT 'Nombres',
  `full_name` varchar(161) GENERATED ALWAYS AS (trim(concat(`last_name`,_utf8mb4' ',`first_name`))) STORED COMMENT 'Calculado: apellidos + nombres. No se escribe.',
  `student_code` varchar(20) NOT NULL,
  `document_number` varchar(30) DEFAULT NULL,
  `document_type` enum('R.C.','T.I.','C.C.','P.E.','NIT','R.C','T.I','C.C') DEFAULT NULL COMMENT 'Tipo de documento',
  `document_issue_date` date DEFAULT NULL COMMENT 'Fecha de expedición del documento',
  `document_issue_place` varchar(120) DEFAULT NULL COMMENT 'Lugar de expedición del documento',
  `phone_landline` varchar(20) DEFAULT NULL COMMENT 'Tel??fono fijo',
  `phone_mobile1` varchar(20) DEFAULT NULL COMMENT 'Celular principal',
  `phone_mobile2` varchar(20) DEFAULT NULL COMMENT 'Celular secundario',
  `email_father` varchar(100) DEFAULT NULL COMMENT 'Correo del padre',
  `email_mother` varchar(100) DEFAULT NULL COMMENT 'Correo de la madre',
  `address` varchar(255) DEFAULT NULL COMMENT 'Direcci??n',
  `guardian` varchar(150) DEFAULT NULL COMMENT 'Nombre del acudiente',
  `birth_date` date DEFAULT NULL COMMENT 'Fecha de nacimiento',
  `admission_date` date DEFAULT NULL COMMENT 'Fecha de ingreso',
  `withdrawal_date` date DEFAULT NULL COMMENT 'Fecha de retiro',
  `withdrawal_reason` text COMMENT 'Motivo de retiro',
  `observations` text COMMENT 'Observaciones generales del alumno',
  `documents` json DEFAULT NULL COMMENT 'Documentos entregados (lista de códigos)',
  `folio_number` varchar(20) DEFAULT NULL COMMENT 'N??mero de folio ??nico secuencial',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `student_code` (`student_code`),
  UNIQUE KEY `folio_number` (`folio_number`),
  KEY `idx_students_orden_nombre` (`last_name`,`first_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Estudiantes';

-- ---------------------------------------------------------------------------
--  subject_assignments
--  En produccion tiene 1 fila al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `subject_assignments` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id` bigint unsigned DEFAULT NULL,
  `grade_id` bigint unsigned DEFAULT NULL,
  `subject_id` bigint unsigned NOT NULL,
  `teacher_id` bigint unsigned NOT NULL COMMENT 'Docente asignado',
  `academic_year_id` bigint unsigned NOT NULL,
  `is_elective` tinyint(1) DEFAULT '0',
  `weekly_hours` tinyint unsigned DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_subject_assignment` (`group_id`,`subject_id`,`academic_year_id`),
  KEY `subject_assignments_ibfk_2` (`subject_id`),
  KEY `subject_assignments_ibfk_3` (`teacher_id`),
  KEY `subject_assignments_ibfk_4` (`academic_year_id`),
  KEY `subject_assignments_ibfk_5` (`grade_id`),
  CONSTRAINT `subject_assignments_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_2` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_3` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_4` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_5` FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Asignaci??n de asignaturas y docentes a grupos';

-- ---------------------------------------------------------------------------
--  subjects
--  En produccion tiene 22 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `subjects` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `area` varchar(100) NOT NULL COMMENT '??rea acad??mica',
  `is_elective` tinyint(1) DEFAULT '0',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Asignaturas';

-- ---------------------------------------------------------------------------
--  teacher_replacement_logs
--  En produccion tiene 0 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `teacher_replacement_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `old_teacher_id` bigint unsigned NOT NULL,
  `new_teacher_id` bigint unsigned NOT NULL,
  `old_teacher_name` varchar(100) NOT NULL,
  `new_teacher_name` varchar(100) NOT NULL,
  `assignments_transferred` int unsigned NOT NULL DEFAULT '0',
  `directorships_transferred` int unsigned NOT NULL DEFAULT '0',
  `old_teacher_deactivated` tinyint(1) NOT NULL DEFAULT '0',
  `replaced_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------------
--  users
--  Columna calculada por MySQL: name.
--  No se escribe nunca: se actualiza sola al cambiar las columnas de origen.
--  En produccion tiene 43 filas al generar este archivo.
-- ---------------------------------------------------------------------------
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `last_name` varchar(80) NOT NULL DEFAULT '' COMMENT 'Apellidos',
  `first_name` varchar(80) NOT NULL DEFAULT '' COMMENT 'Nombres',
  `name` varchar(161) GENERATED ALWAYS AS (trim(concat(`last_name`,_utf8mb4' ',`first_name`))) STORED COMMENT 'Calculado: apellidos + nombres. No se escribe.',
  `document` varchar(50) DEFAULT NULL,
  `email` varchar(100) NOT NULL COMMENT 'Correo institucional o personal',
  `phone` varchar(20) DEFAULT NULL,
  `password` varchar(255) NOT NULL COMMENT 'Contrase??a cifrada con bcrypt',
  `role` enum('admin','docente') NOT NULL DEFAULT 'docente',
  `status` enum('pending','active','rejected') DEFAULT 'pending',
  `reset_token` varchar(255) DEFAULT NULL,
  `reset_token_expires` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `document` (`document`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role_deleted` (`role`,`deleted_at`),
  KEY `idx_users_orden_nombre` (`last_name`,`first_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Usuarios del sistema (administradores y docentes)';

SET FOREIGN_KEY_CHECKS = 1;
