const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function hashAndUpdate() {
  // Configura la conexión usando las variables del .env
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  // Datos del usuario que quieres actualizar
  const email = 'admin@example.com';   // Cambia por el email real
  const plainPassword = '123456';      // La contraseña en texto plano que tienes en la BD

  // Genera el hash con bcrypt (10 es el costo, puedes usar entre 8 y 12)
  const hash = await bcrypt.hash(plainPassword, 10);

  // Actualiza la base de datos
  const [result] = await pool.query(
    'UPDATE users SET password = ? WHERE email = ?',
    [hash, email]
  );

  if (result.affectedRows > 0) {
    console.log(`✅ Contraseña actualizada para ${email}`);
    console.log(`Nuevo hash: ${hash}`);
  } else {
    console.log(`❌ No se encontró ningún usuario con email: ${email}`);
  }

  await pool.end();
}

hashAndUpdate().catch(console.error);