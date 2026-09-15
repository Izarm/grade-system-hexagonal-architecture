// src/infrastructure/repositories/MySQLUserRepository.js
const pool = require('../database/mysql');

// `name` es una columna GENERADA en la base de datos: apellidos + nombres.
// Se puede leer, pero NUNCA se escribe. Para guardar se usan `last_name` y
// `first_name` por separado.

class MySQLUserRepository {
    /**
     * Busca un usuario activo por email (deleted_at IS NULL)
     */
async findByEmail(email) {
    const [rows] = await pool.query(
        `SELECT id, last_name, first_name, name, document, email, phone, password, role, status, deleted_at
         FROM users
         WHERE email = ? AND deleted_at IS NULL`,
        [email]
    );
    return rows[0] || null;
}
    /**
     * Busca un usuario activo por ID
     */
    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, last_name, first_name, name, document, email, phone, password, role, deleted_at
             FROM users
             WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (rows.length === 0) return null;
        return rows[0];
    }

    /**
     * Crea un nuevo usuario (activo)
     * @param {Object} userData - { name, document, email, phone, password, role }
     * @returns {Promise<Object>} - usuario creado (sin contraseña)
     */
    async create(userData) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Liberar email de registros soft-deleted para que no bloqueen el INSERT
            const [deletedByEmail] = await connection.query(
                `SELECT id FROM users WHERE email = ? AND deleted_at IS NOT NULL`, [userData.email]
            );
            if (deletedByEmail.length > 0) {
                await connection.query(
                    `UPDATE users SET email = CONCAT('_del_', id, '_', email) WHERE id = ? AND deleted_at IS NOT NULL`,
                    [deletedByEmail[0].id]
                );
            }

            const [result] = await connection.query(
                `INSERT INTO users (last_name, first_name, email, phone, password, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userData.lastName,
                    userData.firstName,
                    userData.email,
                    userData.phone || null,
                    userData.password,
                    userData.role,
                    userData.status || 'pending'
                ]
            );
            await connection.commit();
            return {
                id: result.insertId,
                last_name: userData.lastName,
                first_name: userData.firstName,
                name: `${userData.lastName} ${userData.firstName}`.trim(),
                email: userData.email,
                phone: userData.phone,
                role: userData.role,
                deleted_at: null
            };
        } catch (error) {
            await connection.rollback();
            if (error.code === 'ER_DUP_ENTRY') {
                if (error.message.includes('document')) {
                    throw new Error('El documento ya está registrado');
                } else if (error.message.includes('email')) {
                    throw new Error('El correo ya está registrado');
                } else {
                    throw new Error('El usuario ya existe');
                }
            }
            throw error;
        } finally {
            connection.release();
        }
    }

    /**
     * Actualiza un usuario activo
     * @param {Object} user - debe contener id, name, document, email, phone, password, role
     * @returns {Promise<boolean>} true si se actualizó
     */
    async update(user) {
        const [result] = await pool.query(
            `UPDATE users
             SET last_name = ?, first_name = ?, email = ?, phone = ?, password = ?, role = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [
                user.lastName,
                user.firstName,
                user.email,
                user.phone,
                user.password,
                user.role,
                user.id
            ]
        );
        return result.affectedRows > 0;
    }

    /**
     * Eliminación lógica (soft delete) de un usuario
     */
    async softDelete(id) {
        const [result] = await pool.query(
            `UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    /**
     * Lista todos los usuarios activos (sin filtrar por rol)
     * @returns {Promise<Array>} - Lista de usuarios (sin contraseña)
     */
    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, last_name, first_name, name, document, email, phone, role FROM users WHERE deleted_at IS NULL`
        );
        return rows;
    }
    async findTeachersWithDetails() {
        const [teachers] = await pool.query(
            `SELECT id, last_name, first_name, name, document, email, phone, role
             FROM users
             WHERE role IN ('docente', 'admin') AND status IN ('active', 'approved') AND deleted_at IS NULL
             ORDER BY last_name ASC, first_name ASC`
        );
        const [directorships] = await pool.query(
            `SELECT grp.head_teacher_id AS teacher_id, grp.id AS grade_id,
                    CONCAT(g.name, ' ', grp.name) AS grade_name
             FROM \`groups\` grp
             JOIN grades g ON grp.grade_id = g.id
             WHERE grp.head_teacher_id IS NOT NULL AND grp.deleted_at IS NULL AND g.deleted_at IS NULL`
        );
        const [assignments] = await pool.query(
            `SELECT sa.teacher_id,
                    s.name AS subject_name,
                    g.name AS grade_name,
                    grp.name AS group_name,
                    sa.is_elective
             FROM subject_assignments sa
             JOIN subjects s ON sa.subject_id = s.id
             LEFT JOIN \`groups\` grp ON sa.group_id = grp.id
             LEFT JOIN grades g ON grp.grade_id = g.id
             WHERE sa.deleted_at IS NULL
             ORDER BY CAST(g.name AS UNSIGNED), grp.name, s.name`
        );
        const dirMap = {};
        for (const d of directorships) {
            if (!dirMap[d.teacher_id]) dirMap[d.teacher_id] = [];
            dirMap[d.teacher_id].push(d.grade_name);
        }
        const assignMap = {};
        for (const a of assignments) {
            if (!assignMap[a.teacher_id]) assignMap[a.teacher_id] = [];
            assignMap[a.teacher_id].push(a);
        }
        return teachers.map(t => ({
            ...t,
            director_grades: dirMap[t.id] || [],
            assignments: assignMap[t.id] || []
        }));
    }

    async updateTeacher(id, { lastName, firstName, email, phone, role }) {
        const [result] = await pool.query(
            `UPDATE users SET last_name = ?, first_name = ?, email = ?, phone = ?, role = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [lastName, firstName, email, phone || null, role, id]
        );
        return result.affectedRows > 0;
    }

    async deleteTeacherCascade(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            // Quitar director de grado
            await connection.query(
                `UPDATE grades SET head_teacher_id = NULL WHERE head_teacher_id = ?`, [id]
            );
            // Eliminar asignaciones (soft delete)
            await connection.query(
                `UPDATE subject_assignments SET deleted_at = NOW() WHERE teacher_id = ? AND deleted_at IS NULL`, [id]
            );
            // Soft delete del usuario
            await connection.query(
                `UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`, [id]
            );
            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    async replaceTeacher(oldTeacherId, newTeacherId, { transferDirectorship = false, deactivateOld = false } = {}) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Validar que ambos docentes existen
            const [[oldTeacher]] = await connection.query(
                `SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL`, [oldTeacherId]
            );
            if (!oldTeacher) throw new Error('Docente saliente no encontrado');

            const [[newTeacher]] = await connection.query(
                `SELECT id, name FROM users WHERE id = ? AND deleted_at IS NULL`, [newTeacherId]
            );
            if (!newTeacher) throw new Error('Docente entrante no encontrado');

            if (parseInt(oldTeacherId) === parseInt(newTeacherId)) {
                throw new Error('El docente entrante debe ser diferente al saliente');
            }

            // 2. Obtener asignaciones del docente saliente
            const [oldAssignments] = await connection.query(
                `SELECT sa.id, sa.group_id, sa.subject_id, sa.academic_year_id, sa.is_elective,
                        s.name as subject_name, g.name as grade_name
                 FROM subject_assignments sa
                 JOIN subjects s ON sa.subject_id = s.id
                 LEFT JOIN \`groups\` grp ON sa.group_id = grp.id
                 LEFT JOIN grades g ON grp.grade_id = g.id
                 WHERE sa.teacher_id = ? AND sa.deleted_at IS NULL`,
                [oldTeacherId]
            );

            if (oldAssignments.length === 0) throw new Error('El docente saliente no tiene asignaciones activas');

            // 3. Reasignar cada asignación al docente nuevo
            //    No hay riesgo de violación de UNIQUE porque la clave es (group_id, subject_id, academic_year_id)
            //    y simplemente cambiamos teacher_id en el mismo row.
            const [updateResult] = await connection.query(
                `UPDATE subject_assignments SET teacher_id = ? WHERE teacher_id = ? AND deleted_at IS NULL`,
                [newTeacherId, oldTeacherId]
            );
            const transferred = updateResult.affectedRows;

            // 4. Transferir director de grado si se solicitó
            let directorshipsTransferred = 0;
            if (transferDirectorship) {
                const [dirResult] = await connection.query(
                    `UPDATE grades SET head_teacher_id = ? WHERE head_teacher_id = ? AND deleted_at IS NULL`,
                    [newTeacherId, oldTeacherId]
                );
                directorshipsTransferred = dirResult.affectedRows;
            }

            // 5. Desactivar docente saliente si se solicitó
            if (deactivateOld) {
                await connection.query(
                    `UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
                    [oldTeacherId]
                );
            }

            // 6. Registrar el reemplazo en tabla de historial
            await connection.query(
                `CREATE TABLE IF NOT EXISTS teacher_replacement_logs (
                    id                       bigint unsigned NOT NULL AUTO_INCREMENT,
                    old_teacher_id           bigint unsigned NOT NULL,
                    new_teacher_id           bigint unsigned NOT NULL,
                    old_teacher_name         varchar(100) NOT NULL,
                    new_teacher_name         varchar(100) NOT NULL,
                    assignments_transferred  int unsigned NOT NULL DEFAULT 0,
                    directorships_transferred int unsigned NOT NULL DEFAULT 0,
                    old_teacher_deactivated  tinyint(1) NOT NULL DEFAULT 0,
                    replaced_at              timestamp NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`
            );

            await connection.query(
                `INSERT INTO teacher_replacement_logs
                 (old_teacher_id, new_teacher_id, old_teacher_name, new_teacher_name,
                  assignments_transferred, directorships_transferred, old_teacher_deactivated)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [oldTeacherId, newTeacherId, oldTeacher.name, newTeacher.name,
                 transferred, directorshipsTransferred, deactivateOld ? 1 : 0]
            );

            await connection.commit();

            return {
                success: true,
                oldTeacher: oldTeacher.name,
                newTeacher: newTeacher.name,
                assignmentsTransferred: transferred,
                directorshipsTransferred,
                oldTeacherDeactivated: deactivateOld,
                message: `${transferred} asignación(es) transferida(s) de ${oldTeacher.name} a ${newTeacher.name}`
            };
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    async saveResetToken(userId, token, expiresAt) {
        await pool.query(
            `UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?`,
            [token, expiresAt, userId]
        );
    }

    async findByResetToken(token) {
        const [rows] = await pool.query(
            `SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > NOW() AND deleted_at IS NULL`,
            [token]
        );
        return rows[0] || null;
    }

    async updatePassword(userId, hashedPassword) {
        await pool.query(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, userId]);
    }

    async clearResetToken(userId) {
        await pool.query(`UPDATE users SET reset_token = NULL, reset_token_expires = NULL WHERE id = ?`, [userId]);
    }
}


module.exports = MySQLUserRepository;