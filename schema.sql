-- ==========================================
-- SCHEMA DEL SISTEMA DE GESTIÓN ACADÉMICA
-- Colegio San José de Tarbes
-- Actualizado: 11/06/2026
-- ==========================================

CREATE DATABASE IF NOT EXISTS sistema_notas;
USE sistema_notas;

-- ==========================================
-- ELIMINAR TABLAS (orden inverso por FK)
-- ==========================================
DROP TABLE IF EXISTS `grade_audit_logs`;
DROP TABLE IF EXISTS `grade_records`;
DROP TABLE IF EXISTS `head_teacher_reviews`;
DROP TABLE IF EXISTS `student_elective_enrollments`;
DROP TABLE IF EXISTS `elective_assignments`;
DROP TABLE IF EXISTS `elective_subjects`;
DROP TABLE IF EXISTS `subject_assignments`;
DROP TABLE IF EXISTS `enrollments`;
DROP TABLE IF EXISTS `periods`;
DROP TABLE IF EXISTS `subjects`;
DROP TABLE IF EXISTS `groups`;
DROP TABLE IF EXISTS `grades`;
DROP TABLE IF EXISTS `students`;
DROP TABLE IF EXISTS `users`;
DROP TABLE IF EXISTS `academic_years`;

-- ==========================================
-- TABLE: academic_years
-- ==========================================
CREATE TABLE `academic_years` (
  `id`         bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`       varchar(20) NOT NULL,
  `start_date` date NOT NULL COMMENT 'Fecha de inicio del año lectivo',
  `end_date`   date NOT NULL COMMENT 'Fecha de finalización del año lectivo',
  `active`     tinyint(1) NOT NULL DEFAULT '0' COMMENT 'Solo uno puede estar activo',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_academic_years_active` (`active`),
  KEY `idx_academic_years_dates` (`start_date`, `end_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Años lectivos';

-- ==========================================
-- TABLE: users
-- ==========================================
CREATE TABLE `users` (
  `id`                  bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`                varchar(100) NOT NULL COMMENT 'Nombre completo',
  `document`            varchar(20)  NOT NULL COMMENT 'Cédula o documento de identidad',
  `email`               varchar(100) NOT NULL COMMENT 'Correo institucional',
  `phone`               varchar(20)  DEFAULT NULL,
  `password`            varchar(255) NOT NULL COMMENT 'Contraseña cifrada con bcrypt',
  `role`                enum('admin','docente') NOT NULL DEFAULT 'docente',
  `status`              enum('pending','active','rejected') DEFAULT 'pending',
  `reset_token`         varchar(255) DEFAULT NULL,
  `reset_token_expires` timestamp NULL DEFAULT NULL,
  `deleted_at`          timestamp NULL DEFAULT NULL,
  `created_at`          timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`),
  KEY `idx_users_role_deleted` (`role`, `deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Usuarios del sistema (administradores y docentes)';

-- ==========================================
-- TABLE: students
-- ==========================================
CREATE TABLE `students` (
  `id`           bigint unsigned NOT NULL AUTO_INCREMENT,
  `full_name`    varchar(150) NOT NULL,
  `document`     varchar(20)  NOT NULL COMMENT 'Documento de identidad',
  `birth_date`   date DEFAULT NULL,
  `folio_number` varchar(20)  DEFAULT NULL COMMENT 'Número de folio único',
  `deleted_at`   timestamp NULL DEFAULT NULL,
  `created_at`   timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `document` (`document`),
  UNIQUE KEY `folio_number` (`folio_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Estudiantes';

-- ==========================================
-- TABLE: grades
-- ==========================================
CREATE TABLE `grades` (
  `id`              bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`            varchar(20) NOT NULL,
  `full_name`       varchar(20) DEFAULT NULL,
  `head_teacher_id` bigint unsigned DEFAULT NULL COMMENT 'Docente director de grado',
  `deleted_at`      timestamp NULL DEFAULT NULL,
  `created_at`      timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `head_teacher_id` (`head_teacher_id`),
  CONSTRAINT `grades_ibfk_1` FOREIGN KEY (`head_teacher_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Grados escolares (1° a 11°)';

-- ==========================================
-- TABLE: groups
-- ==========================================
CREATE TABLE `groups` (
  `id`         bigint unsigned NOT NULL AUTO_INCREMENT,
  `grade_id`   bigint unsigned NOT NULL COMMENT 'Grado al que pertenece',
  `name`       varchar(10) NOT NULL COMMENT 'Letra del grupo (A, B, C…)',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_group_per_grade` (`grade_id`, `name`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Grupos por grado';

-- ==========================================
-- TABLE: subjects
-- ==========================================
CREATE TABLE `subjects` (
  `id`         bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`       varchar(100) NOT NULL,
  `area`       varchar(100) NOT NULL COMMENT 'Área académica',
  `deleted_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Asignaturas obligatorias';

-- ==========================================
-- TABLE: periods
-- ==========================================
CREATE TABLE `periods` (
  `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
  `academic_year_id` bigint unsigned NOT NULL,
  `name`             varchar(50) NOT NULL COMMENT 'Ej: "Primer período"',
  `order`            tinyint unsigned NOT NULL COMMENT 'Orden: 1, 2, 3, 4',
  `start_date`       date NOT NULL,
  `end_date`         date NOT NULL,
  `percentage`       decimal(5,2) DEFAULT NULL,
  `status`           enum('open','closed') NOT NULL DEFAULT 'open',
  `closed_by`        bigint unsigned DEFAULT NULL COMMENT 'Usuario que cerró el período',
  `closed_at`        timestamp NULL DEFAULT NULL,
  `deleted_at`       timestamp NULL DEFAULT NULL,
  `created_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_period_order` (`academic_year_id`, `order`),
  KEY `idx_periods_academic_year` (`academic_year_id`),
  KEY `idx_periods_status` (`status`),
  KEY `idx_periods_dates` (`start_date`, `end_date`),
  KEY `closed_by` (`closed_by`),
  CONSTRAINT `periods_ibfk_1` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `periods_ibfk_2` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Períodos académicos';

-- ==========================================
-- TABLE: enrollments
-- ==========================================
CREATE TABLE `enrollments` (
  `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id`       bigint unsigned NOT NULL,
  `group_id`         bigint unsigned NOT NULL,
  `grade_id`         bigint unsigned DEFAULT NULL,
  `academic_year_id` bigint unsigned NOT NULL,
  `deleted_at`       timestamp NULL DEFAULT NULL COMMENT 'Soft delete: anulación de matrícula',
  `created_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_enrollment` (`student_id`, `group_id`, `academic_year_id`),
  KEY `idx_enrollments_student` (`student_id`),
  KEY `idx_enrollments_group` (`group_id`),
  KEY `idx_enrollments_year` (`academic_year_id`),
  KEY `idx_enrollments_student_year` (`student_id`, `academic_year_id`),
  CONSTRAINT `enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `enrollments_ibfk_2` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `enrollments_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Matrículas de estudiantes en grupos por año lectivo';

-- ==========================================
-- TABLE: subject_assignments
-- ==========================================
CREATE TABLE `subject_assignments` (
  `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
  `group_id`         bigint unsigned DEFAULT NULL,
  `grade_id`         bigint unsigned DEFAULT NULL,
  `subject_id`       bigint unsigned NOT NULL,
  `teacher_id`       bigint unsigned NOT NULL COMMENT 'Docente responsable',
  `academic_year_id` bigint unsigned NOT NULL,
  `is_elective`      tinyint(1) DEFAULT '0',
  `deleted_at`       timestamp NULL DEFAULT NULL,
  `created_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_subject_assignment` (`group_id`, `subject_id`, `academic_year_id`),
  KEY `idx_assignments_teacher` (`teacher_id`),
  KEY `idx_assignments_group` (`group_id`),
  KEY `idx_assignments_subject` (`subject_id`),
  KEY `idx_assignments_year` (`academic_year_id`),
  KEY `grade_id` (`grade_id`),
  CONSTRAINT `subject_assignments_ibfk_1` FOREIGN KEY (`group_id`) REFERENCES `groups` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_2` FOREIGN KEY (`subject_id`) REFERENCES `subjects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_3` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_4` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `subject_assignments_ibfk_5` FOREIGN KEY (`grade_id`) REFERENCES `grades` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Asignación de asignaturas y docentes a grupos por año';

-- ==========================================
-- TABLE: grade_records
-- ==========================================
CREATE TABLE `grade_records` (
  `id`                    bigint unsigned NOT NULL AUTO_INCREMENT,
  `enrollment_id`         bigint unsigned NOT NULL,
  `period_id`             bigint unsigned NOT NULL,
  `subject_assignment_id` bigint unsigned NOT NULL,
  `normal_note`           decimal(4,2) DEFAULT NULL COMMENT 'Nota normal (0.00 – 10.00)',
  `aptitudinal_note`      decimal(4,2) DEFAULT NULL COMMENT 'Nota aptitudinal (0.00 – 10.00)',
  `average`               decimal(4,2) DEFAULT NULL COMMENT '(normal + aptitudinal) / 2',
  `deleted_at`            timestamp NULL DEFAULT NULL,
  `created_at`            timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_grade_record` (`enrollment_id`, `period_id`, `subject_assignment_id`),
  KEY `idx_grades_enrollment` (`enrollment_id`),
  KEY `idx_grades_period` (`period_id`),
  KEY `idx_grades_subject_assignment` (`subject_assignment_id`),
  KEY `idx_grades_average` (`average`),
  CONSTRAINT `grade_records_ibfk_1` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_records_ibfk_2` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_records_ibfk_3` FOREIGN KEY (`subject_assignment_id`) REFERENCES `subject_assignments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Registro de notas por estudiante, período y asignatura';

-- ==========================================
-- TABLE: grade_audit_logs
-- ==========================================
CREATE TABLE `grade_audit_logs` (
  `id`                    bigint unsigned NOT NULL AUTO_INCREMENT,
  `teacher_id`            bigint unsigned NOT NULL COMMENT 'Docente que realizó el cambio',
  `enrollment_id`         bigint unsigned NOT NULL COMMENT 'Matrícula del estudiante afectado',
  `subject_assignment_id` bigint unsigned NOT NULL COMMENT 'Asignatura modificada',
  `period_id`             bigint unsigned NOT NULL COMMENT 'Período académico',
  `action`                enum('create','update') NOT NULL COMMENT 'create = registro nuevo, update = modificación',
  `field`                 varchar(50) NOT NULL COMMENT 'Campo modificado (normal_note, aptitudinal_note, etc.)',
  `old_value`             varchar(50) DEFAULT NULL COMMENT 'Valor anterior (NULL en creaciones)',
  `new_value`             varchar(50) DEFAULT NULL,
  `created_at`            timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_audit_teacher` (`teacher_id`),
  KEY `idx_audit_enrollment` (`enrollment_id`),
  KEY `idx_audit_period` (`period_id`),
  KEY `idx_audit_created` (`created_at`),
  CONSTRAINT `grade_audit_logs_ibfk_1` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_2` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_3` FOREIGN KEY (`subject_assignment_id`) REFERENCES `subject_assignments` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `grade_audit_logs_ibfk_4` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Auditoría de cambios en calificaciones realizados por docentes';

-- ==========================================
-- TABLE: head_teacher_reviews
-- ==========================================
CREATE TABLE `head_teacher_reviews` (
  `id`               bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id`       bigint unsigned NOT NULL,
  `period_id`        bigint unsigned DEFAULT NULL COMMENT 'NULL = observación anual (cierre de año)',
  `academic_year_id` bigint unsigned NOT NULL,
  `review`           text COMMENT 'Observación del director de grupo',
  `created_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_htr_student` (`student_id`),
  KEY `idx_htr_period` (`period_id`),
  KEY `idx_htr_year` (`academic_year_id`),
  CONSTRAINT `head_teacher_reviews_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `head_teacher_reviews_ibfk_2` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE SET NULL,
  CONSTRAINT `head_teacher_reviews_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Observaciones del director de grupo por estudiante y período';

-- ==========================================
-- TABLE: elective_subjects
-- ==========================================
CREATE TABLE `elective_subjects` (
  `id`          bigint unsigned NOT NULL AUTO_INCREMENT,
  `name`        varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `deleted_at`  timestamp NULL DEFAULT NULL,
  `created_at`  timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_elective_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Catálogo de asignaturas electivas';

-- ==========================================
-- TABLE: elective_assignments
-- ==========================================
CREATE TABLE `elective_assignments` (
  `id`                  bigint unsigned NOT NULL AUTO_INCREMENT,
  `elective_subject_id` bigint unsigned NOT NULL,
  `teacher_id`          bigint unsigned NOT NULL,
  `academic_year_id`    bigint unsigned NOT NULL,
  `period_id`           bigint unsigned DEFAULT NULL COMMENT 'NULL = oferta anual',
  `max_students`        int unsigned DEFAULT NULL,
  `start_date`          date DEFAULT NULL,
  `end_date`            date DEFAULT NULL,
  `deleted_at`          timestamp NULL DEFAULT NULL,
  `created_at`          timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`          timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_elective_offering` (`elective_subject_id`, `academic_year_id`, `period_id`),
  KEY `teacher_id` (`teacher_id`),
  KEY `academic_year_id` (`academic_year_id`),
  KEY `period_id` (`period_id`),
  CONSTRAINT `elective_assignments_ibfk_1` FOREIGN KEY (`elective_subject_id`) REFERENCES `elective_subjects` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_2` FOREIGN KEY (`teacher_id`) REFERENCES `users` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_3` FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `elective_assignments_ibfk_4` FOREIGN KEY (`period_id`) REFERENCES `periods` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Ofertas de electivas por año/período con docente';

-- ==========================================
-- TABLE: student_elective_enrollments
-- ==========================================
CREATE TABLE `student_elective_enrollments` (
  `id`                     bigint unsigned NOT NULL AUTO_INCREMENT,
  `student_id`             bigint unsigned NOT NULL,
  `elective_assignment_id` bigint unsigned NOT NULL,
  `enrollment_date`        date NOT NULL DEFAULT (curdate()),
  `status`                 enum('active','dropped') NOT NULL DEFAULT 'active',
  `deleted_at`             timestamp NULL DEFAULT NULL,
  `created_at`             timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`             timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_student_elective` (`student_id`, `elective_assignment_id`),
  KEY `elective_assignment_id` (`elective_assignment_id`),
  CONSTRAINT `student_elective_enrollments_ibfk_1` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `student_elective_enrollments_ibfk_2` FOREIGN KEY (`elective_assignment_id`) REFERENCES `elective_assignments` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Inscripción de estudiantes en electivas';

-- ==========================================
-- USUARIOS ADMINISTRADORES INICIALES
-- ==========================================
INSERT INTO `users` (`name`, `document`, `email`, `phone`, `password`, `role`, `status`) VALUES
('Fabian Realpe',  '1',  'fabianrealpe31@gmail.com', NULL, '$2b$10$nOMJK74UtmZAXAL15HR9n.d8mmiNK7M4MrDXvLk/ZWhEzddf4615W', 'admin', 'active'),
('Liz',            '2',  'liz@gmail.com',             NULL, '$2b$10$AY1dD.EA7QAqCPE6jIqLk.beu1Q5rd7exI5mefIJ5ZP1PTmAnhaNW', 'admin', 'active'),
('Zhamuel',        '3',  'zhamuel8@gmail.com',        NULL, '$2b$10$E9HaUaA/1YlPiHWIUr1dzOFT1URko58M9dqidrqvZslHcMP9Y7ij6', 'admin', 'active');
