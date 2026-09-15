-- Ejecutar una sola vez en la base de datos existente
-- Agrega el campo promotion_status a enrollments

ALTER TABLE `enrollments`
ADD COLUMN `promotion_status` ENUM('pending','promoted','held_back') NOT NULL DEFAULT 'pending'
AFTER `folio_number`;
