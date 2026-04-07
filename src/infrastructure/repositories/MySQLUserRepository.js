<<<<<<< HEAD
// src/infrastructure/repositories/MySQLUserRepository.js
const pool = require('../database/mysql');

class MySQLUserRepository {
    /**
     * Busca un usuario activo por email (deleted_at IS NULL)
     */
    async findByEmail(email) {
        const [rows] = await pool.query(
            `SELECT id, name, document, email, phone, password, role, deleted_at
             FROM users
             WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        if (rows.length === 0) return null;
        return rows[0]; // objeto plano con todos los campos
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
                `INSERT INTO users (name, document, email, phone, password, role)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userData.name,
                    userData.document,
                    userData.email,
                    userData.phone || null,
                    userData.password,
                    userData.role
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
}

=======
const pool = require('../database/mysql');

class MySQLUserRepository {
    async findByEmail(email) {
        const [rows] = await pool.query(
            "SELECT id, name, email, password, role FROM users WHERE email = ? AND deleted_at IS NULL",
            [email]
        );
         console.log('Usuario encontrado:', rows[0]); // <-- Agrega esto
        return rows[0];
    }
}
>>>>>>> fe1278852119238c6138d527318cdc5874e656a9
module.exports = MySQLUserRepository;