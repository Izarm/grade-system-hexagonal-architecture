const mysql = require('mysql2/promise');
require('dotenv').config();

const isTest = process.env.NODE_ENV === 'test';
const database = isTest ? 'sistema_notas_test' : process.env.DB_NAME;

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;