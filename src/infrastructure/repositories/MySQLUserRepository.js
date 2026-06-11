// src/infrastructure/repositories/MySQLUserRepository.js
const pool = require('../database/mysql');

class MySQLUserRepository {
    /**
     * Busca un usuario activo por email (deleted_at IS NULL)
     */
async findByEmail(email) {
    const [rows] = await pool.query(
        `SELECT id, name, document, email, phone, password, role, status, deleted_at
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
            `SELECT id, name, document, email, phone, password, role, deleted_at
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
            const [result] = await connection.query(
                `INSERT INTO users (name, document, email, phone, password, role, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    userData.name,
                    userData.document,
                    userData.email,
                    userData.phone || null,
                    userData.password,
                    userData.role,
                    userData.status || 'pending'
                ]
            );
            // Devolver el usuario creado (sin la contraseña)
            return {
                id: result.insertId,
                name: userData.name,
                document: userData.document,
                email: userData.email,
                phone: userData.phone,
                role: userData.role,
                deleted_at: null
            };
        } catch (error) {
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
             SET name = ?, document = ?, email = ?, phone = ?, password = ?, role = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [
                user.name,
                user.document,
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
            `SELECT id, name, document, email, phone, role FROM users WHERE deleted_at IS NULL`
        );
        return rows;
    }
    async findTeachersWithDetails() {
        const [teachers] = await pool.query(
            `SELECT id, name, document, email, phone
             FROM users
             WHERE role = 'docente' AND status IN ('active', 'approved') AND deleted_at IS NULL
             ORDER BY name ASC`
        );
        const [directorships] = await pool.query(
            `SELECT head_teacher_id AS teacher_id, id AS grade_id, name AS grade_name
             FROM grades
             WHERE head_teacher_id IS NOT NULL AND deleted_at IS NULL`
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

    async updateTeacher(id, { name, document, email, phone, role }) {
        const [result] = await pool.query(
            `UPDATE users SET name = ?, document = ?, email = ?, phone = ?, role = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [name, document, email, phone || null, role, id]
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