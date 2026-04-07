const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function hashAllPasswords() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Obtener todos los usuarios
        const [users] = await pool.query('SELECT id, password FROM users');

        for (const user of users) {
            // Si la contraseña ya parece un hash bcrypt (empieza con $2b$), la saltamos
            if (user.password && user.password.startsWith('$2b$')) {
                console.log(`Usuario ID ${user.id} ya tiene hash, omitido.`);
                continue;
            }

            // Generar hash de la contraseña actual (texto plano)
            const hash = await bcrypt.hash(user.password, 10);
            await pool.query('UPDATE users SET password = ? WHERE id = ?', [hash, user.id]);
            console.log(`Usuario ID ${user.id}: contraseña actualizada a hash.`);
        }

        console.log('✅ Proceso completado.');
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await pool.end();
    }
}

hashAllPasswords();
