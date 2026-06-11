const pool = require('../database/mysql');

class StudentRepository {
    async create(data) {
        const { fullName, studentCode, birthDate, folioNumber } = data;
        const [result] = await pool.query(
            `INSERT INTO students (full_name, student_code, birth_date, folio_number)
             VALUES (?, ?, ?, ?)`,
            [fullName, studentCode, birthDate || null, folioNumber || null]
        );
        return { id: result.insertId, full_name: fullName, student_code: studentCode, birth_date: birthDate, folio_number: folioNumber };
    }

    async update(id, data) {
        const { fullName, studentCode, birthDate, folioNumber } = data;
        const [result] = await pool.query(
            `UPDATE students 
             SET full_name = ?, student_code = ?, birth_date = ?, folio_number = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [fullName, studentCode, birthDate || null, folioNumber || null, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE students SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, full_name, student_code, birth_date, folio_number
             FROM students WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT id, full_name, student_code, birth_date, folio_number
             FROM students WHERE deleted_at IS NULL ORDER BY full_name`
        );
        return rows;
    }
}

module.exports = StudentRepository;