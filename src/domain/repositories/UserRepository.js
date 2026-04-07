// repositories/UserRepository.js
const mysql = require('mysql2/promise');
const User = require('../domain/User');

class UserRepository {
    constructor(pool) {
        this.pool = pool; // pool de conexiones
    }

    /**
     * Busca un usuario activo por email (deleted_at IS NULL)
     * @param {string} email 
     * @returns {Promise<User|null>}
     */
    async findByEmail(email) {
        const [rows] = await this.pool.query(
            `SELECT id, name, document, email, phone, password, role, deleted_at
             FROM users
             WHERE email = ? AND deleted_at IS NULL`,
            [email]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return new User(
            row.id,
            row.name,
            row.document,
            row.email,
            row.phone,
            row.password,
            row.role,
            row.deleted_at
        );
    }

    /**
     * Crea un nuevo usuario (activo)
     * @param {User} user - debe contener name, document, email, phone, password, role
     * @returns {Promise<User>} - usuario con id asignado
     * @throws {Error} si ya existe documento o email
     */
    async create(user) {
        const connection = await this.pool.getConnection();
        try {
            const [result] = await connection.query(
                `INSERT INTO users (name, document, email, phone, password, role)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    user.name,
                    user.document,
                    user.email,
                    user.phone || null,
                    user.password,
                    user.role
                ]
            );
            user.id = result.insertId;
            return user;
        } catch (error) {
            if (error.code === 'ER_DUP_ENTRY') {
                // Determinar qué campo causó el duplicado
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

    // Otros métodos útiles (opcionales)
    async findById(id) {
        const [rows] = await this.pool.query(
            `SELECT id, name, document, email, phone, password, role, deleted_at
             FROM users
             WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        if (rows.length === 0) return null;
        const row = rows[0];
        return new User(
            row.id,
            row.name,
            row.document,
            row.email,
            row.phone,
            row.password,
            row.role,
            row.deleted_at
        );
    }

    async update(user) {
        const [result] = await this.pool.query(
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

    async softDelete(id) {
        const [result] = await this.pool.query(
            `UPDATE users SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }
}

module.exports = UserRepository;