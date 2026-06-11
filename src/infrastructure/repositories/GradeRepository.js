const pool = require('../database/mysql');

class GradeRepository {
    async create(name) {
        const [result] = await pool.query(
            `INSERT INTO grades (name) VALUES (?)`,
            [name]
        );
        const gradeId = result.insertId;
        // Crear automáticamente el grupo con el mismo nombre del grado
        await pool.query(
            `INSERT INTO \`groups\` (grade_id, name) VALUES (?, ?)`,
            [gradeId, name]
        );
        return { id: gradeId, name };
    }

    async update(id, name) {
        const [result] = await pool.query(
            `UPDATE grades SET name = ? WHERE id = ? AND deleted_at IS NULL`,
            [name, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE grades SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT id, name, head_teacher_id, deleted_at AS deletedAt 
             FROM grades WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
        try {
            const [rows] = await pool.query(
                `SELECT id, name, head_teacher_id FROM grades WHERE deleted_at IS NULL ORDER BY CAST(name AS UNSIGNED) ASC, RIGHT(name, 1) ASC`
            );
            return rows;
        } catch (error) {
            console.error('Error en findAll:', error);
            throw error;
        }
    }

    async findByNameIncludeDeleted(name) {
        const [rows] = await pool.query(
            `SELECT id, name, deleted_at FROM grades WHERE name = ?`,
            [name]
        );
        return rows[0] || null;
    }

    async reactivate(id) {
        const [result] = await pool.query(
            `UPDATE grades SET deleted_at = NULL WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async deletePhysical(id) {
        const [result] = await pool.query(
            `DELETE FROM grades WHERE id = ?`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async updateHeadTeacher(gradeId, teacherId) {
        const [result] = await pool.query(
            `UPDATE grades SET head_teacher_id = ? WHERE id = ? AND deleted_at IS NULL`,
            [teacherId || null, gradeId]
        );
        return result.affectedRows > 0;
    }

    async getGradeWithHeadTeacher(gradeId) {
        const [rows] = await pool.query(
            `SELECT g.id, g.name, g.head_teacher_id, u.name as head_teacher_name, u.email as head_teacher_email
             FROM grades g
             LEFT JOIN users u ON g.head_teacher_id = u.id
             WHERE g.id = ? AND g.deleted_at IS NULL`,
            [gradeId]
        );
        return rows[0] || null;
    }

    async deleteEnrollmentsByGrade(gradeId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            const [groups] = await connection.query(
                `SELECT id FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL`,
                [gradeId]
            );
            
            const groupIds = groups.map(g => g.id);
            
            if (groupIds.length > 0) {
                await connection.query(
                    `UPDATE enrollments SET deleted_at = NOW() WHERE group_id IN (?) AND deleted_at IS NULL`,
                    [groupIds]
                );
            }
            
            await connection.commit();
            return true;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async createStudentsAndEnrollments(gradeId, students) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            
            const [activeYear] = await connection.query(
                `SELECT id FROM academic_years WHERE active = 1 LIMIT 1`
            );
            const academicYearId = activeYear[0]?.id;
            
            if (!academicYearId) {
                throw new Error('No hay un año lectivo activo');
            }
            
            let [groups] = await connection.query(
                `SELECT id, name FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL LIMIT 1`,
                [gradeId]
            );
            
            let groupId;
            let groupName = 'A';
            
            if (groups.length === 0) {
                const [existingGroups] = await connection.query(
                    `SELECT name FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL ORDER BY name DESC LIMIT 1`,
                    [gradeId]
                );
                
                if (existingGroups.length > 0) {
                    const lastLetter = existingGroups[0].name;
                    const nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
                    groupName = nextLetter;
                }
                
                const [newGroup] = await connection.query(
                    `INSERT INTO \`groups\` (grade_id, name) VALUES (?, ?)`,
                    [gradeId, groupName]
                );
                groupId = newGroup.insertId;
                console.log(`Grupo "${groupName}" creado automáticamente para grado ${gradeId}`);
            } else {
                groupId = groups[0].id;
            }
            
            const studentIds = [];
            
            for (const student of students) {
                if (!student.fullName || !student.studentCode) continue;
                
                const [studentResult] = await connection.query(
                    `INSERT INTO students (full_name, student_code) VALUES (?, ?)`,
                    [student.fullName, student.studentCode]
                );
                studentIds.push(studentResult.insertId);
            }
            
            for (const studentId of studentIds) {
                await connection.query(
                    `INSERT INTO enrollments (student_id, group_id, academic_year_id)
                     VALUES (?, ?, ?)`,
                    [studentId, groupId, academicYearId]
                );
            }
            
            await this.recalculateFolioNumbers(academicYearId, connection);
            
            await connection.commit();
            return studentIds.length;
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
    
    async recalculateFolioNumbers(academicYearId, connection) {
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

module.exports = GradeRepository;