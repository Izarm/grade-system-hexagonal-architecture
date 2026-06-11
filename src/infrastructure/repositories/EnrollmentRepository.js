const pool = require('../database/mysql');

class EnrollmentRepository {
    async create(data) {
        const { studentId, groupId, academicYearId } = data;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Si existe un registro soft-deleted para la misma combinación, reactivarlo
            const [existing] = await connection.query(
                `SELECT id FROM enrollments WHERE student_id = ? AND group_id = ? AND academic_year_id = ? AND deleted_at IS NOT NULL`,
                [studentId, groupId, academicYearId]
            );

            let insertId;
            if (existing.length > 0) {
                await connection.query(
                    `UPDATE enrollments SET deleted_at = NULL, updated_at = NOW() WHERE id = ?`,
                    [existing[0].id]
                );
                insertId = existing[0].id;
            } else {
                const [result] = await connection.query(
                    `INSERT INTO enrollments (student_id, group_id, academic_year_id) VALUES (?, ?, ?)`,
                    [studentId, groupId, academicYearId]
                );
                insertId = result.insertId;
            }

            await this.recalculateFolioNumbers(academicYearId, connection);
            await connection.commit();
            return { id: insertId, ...data };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async update(id, data) {
        const { studentId, groupId, academicYearId } = data;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                `UPDATE enrollments 
                 SET student_id = ?, group_id = ?, academic_year_id = ?
                 WHERE id = ? AND deleted_at IS NULL`,
                [studentId, groupId, academicYearId, id]
            );
            await this.recalculateFolioNumbers(academicYearId, connection);
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async delete(id) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [enrollment] = await connection.query(
                `SELECT academic_year_id FROM enrollments WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            if (enrollment.length === 0) return false;
            const academicYearId = enrollment[0].academic_year_id;

            const [result] = await connection.query(
                `UPDATE enrollments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
                [id]
            );
            await this.recalculateFolioNumbers(academicYearId, connection);
            await connection.commit();
            return result.affectedRows > 0;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number,
                    s.full_name as student_name, s.student_code,
                    g.name as group_name,
                    ay.name as academic_year_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             WHERE e.id = ? AND e.deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        const [rows] = await pool.query(
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number,
                    s.full_name as student_name, s.student_code,
                    g.name as group_name,
                    ay.name as academic_year_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             WHERE e.deleted_at IS NULL
             ORDER BY 
               CASE 
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 1 AND 5 THEN 1
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 6 AND 9 THEN 2
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 10 AND 11 THEN 3
                 ELSE 0
               END ASC,
               CAST(g.name AS UNSIGNED) ASC,
               RIGHT(g.name, 1) ASC,
               e.folio_number ASC`
        );
        return rows;
    }

    async findByStudent(studentId) {
        const [rows] = await pool.query(
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number,
                    s.full_name as student_name, s.student_code,
                    grp.name as group_name, grp.grade_id,
                    g.name as grade_name,
                    ay.name as academic_year_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             WHERE e.student_id = ? AND e.deleted_at IS NULL
             ORDER BY 
               CASE 
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 1 AND 5 THEN 1
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 6 AND 9 THEN 2
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 10 AND 11 THEN 3
                 ELSE 0
               END ASC,
               CAST(g.name AS UNSIGNED) ASC,
               RIGHT(g.name, 1) ASC,
               e.folio_number ASC`,
            [studentId]
        );
        return rows;
    }

    async findByGroupAndYear(groupId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number,
                    s.full_name as student_name, s.student_code,
                    g.name as group_name,
                    ay.name as academic_year_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             WHERE e.group_id = ? AND e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY e.folio_number ASC`,
            [groupId, academicYearId]
        );
        return rows;
    }

    async findByGrade(gradeId, academicYearId = null) {
        let query = `
            SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number,
                   s.full_name as student_name, s.student_code,
                   g.name as group_name,
                   ay.name as academic_year_name
            FROM enrollments e
            JOIN students s ON e.student_id = s.id
            JOIN \`groups\` grp ON e.group_id = grp.id
            JOIN grades g ON grp.grade_id = g.id
            JOIN academic_years ay ON e.academic_year_id = ay.id
            WHERE grp.id = ? AND e.deleted_at IS NULL
        `;
        const params = [gradeId];

        if (academicYearId) {
            query += ` AND e.academic_year_id = ?`;
            params.push(academicYearId);
        }

        query += ` ORDER BY e.folio_number ASC`;

        const [rows] = await pool.query(query, params);
        return rows;
    }

    async recalculateFolioNumbers(academicYearId, connection = null) {
        const useConnection = connection || pool;

        const [rows] = await useConnection.query(
            `SELECT e.id, e.student_id, e.group_id, s.full_name, 
                    g.name as grade_name,
                    CAST(g.name AS UNSIGNED) as grade_num,
                    RIGHT(g.name, 1) as grade_letter
             FROM enrollments e
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN students s ON e.student_id = s.id
             WHERE e.academic_year_id = ? 
               AND e.deleted_at IS NULL
             ORDER BY 
               CASE 
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 1 AND 5 THEN 1
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 6 AND 9 THEN 2
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 10 AND 11 THEN 3
                 ELSE 0
               END ASC,
               CAST(g.name AS UNSIGNED) ASC,
               RIGHT(g.name, 1) ASC,
               s.full_name ASC`,
            [academicYearId]
        );

        let currentBlock = 0;
        let counter = 1;

        for (let i = 0; i < rows.length; i++) {
            let block = 0;
            const gradeNum = rows[i].grade_num;
            if (gradeNum >= 1 && gradeNum <= 5) block = 1;
            else if (gradeNum >= 6 && gradeNum <= 9) block = 2;
            else if (gradeNum >= 10 && gradeNum <= 11) block = 3;
            
            if (block !== currentBlock) {
                currentBlock = block;
                counter = 1;
            }
            
            await useConnection.query(
                `UPDATE enrollments SET folio_number = ? WHERE id = ?`,
                [counter, rows[i].id]
            );
            counter++;
        }

        return rows.length;
    }
}

module.exports = EnrollmentRepository;