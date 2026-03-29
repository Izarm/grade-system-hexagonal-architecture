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
module.exports = MySQLUserRepository;