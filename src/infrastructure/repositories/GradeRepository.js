const pool = require('../database/mysql');
const { leerNombreDePeticion } = require('../../shared/personName');
const { ValidationError } = require('../../shared/errors');
const { gradeBlock } = require('../constants/gradeRanges');

class GradeRepository {
    async create(name, academicYearId = null) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const [result] = await connection.query(
                `INSERT INTO grades (name, academic_year_id) VALUES (?, ?)`,
                [name, academicYearId]
            );
            const gradeId = result.insertId;
            await connection.query(
                `INSERT INTO \`groups\` (grade_id, name) VALUES (?, 'A')`,
                [gradeId]
            );
            await connection.commit();
            return { id: gradeId, name, academic_year_id: academicYearId };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
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

    async findAll(academicYearId = null) {
        try {
            const where = academicYearId
                ? 'WHERE deleted_at IS NULL AND academic_year_id = ?'
                : 'WHERE deleted_at IS NULL';
            const params = academicYearId ? [academicYearId] : [];
            const [rows] = await pool.query(
                `SELECT id, name, head_teacher_id, academic_year_id, takes_grades FROM grades ${where} ORDER BY CAST(name AS UNSIGNED) ASC, RIGHT(name, 1) ASC`,
                params
            );
            return rows;
        } catch (error) {
            console.error('Error en findAll:', error);
            throw error;
        }
    }

    async findByNameIncludeDeleted(name, academicYearId = null) {
        if (academicYearId) {
            const [rows] = await pool.query(
                `SELECT id, name, deleted_at FROM grades WHERE name = ? AND academic_year_id = ?`,
                [name, academicYearId]
            );
            return rows[0] || null;
        }
        const [rows] = await pool.query(
            `SELECT id, name, deleted_at FROM grades WHERE name = ? AND academic_year_id IS NULL`,
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

    async deleteGroupsByGrade(gradeId) {
        await pool.query(
            `UPDATE \`groups\` SET deleted_at = NOW() WHERE grade_id = ? AND deleted_at IS NULL`,
            [gradeId]
        );
    }

    async deleteAssignmentsByGrade(gradeId) {
        const [groups] = await pool.query(
            `SELECT id FROM \`groups\` WHERE grade_id = ?`,
            [gradeId]
        );
        const groupIds = groups.map(g => g.id);
        if (groupIds.length > 0) {
            await pool.query(
                `UPDATE subject_assignments SET deleted_at = NOW() WHERE group_id IN (?) AND deleted_at IS NULL`,
                [groupIds]
            );
        }
        await pool.query(
            `UPDATE subject_assignments SET deleted_at = NOW() WHERE grade_id = ? AND deleted_at IS NULL`,
            [gradeId]
        );
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
            } else {
                groupId = groups[0].id;
            }
            
            const studentIds = [];
            
            // Se valida TODA la lista antes de insertar nada. Antes las filas
            // malas se saltaban en silencio y el usuario creia que se habian
            // cargado todos los estudiantes.
            const validados = [];
            const errores = [];

            students.forEach((student, indice) => {
                const fila = indice + 1;
                const codigo = String(student.studentCode ?? '').trim();

                if (codigo === '') {
                    errores.push(`Fila ${fila}: falta el codigo del estudiante`);
                    return;
                }
                try {
                    // Acepta { lastName, firstName } y tambien el { fullName }
                    // de un solo campo (por ejemplo, una carga desde Excel).
                    const nombre = leerNombreDePeticion(student);
                    validados.push({ ...nombre, studentCode: codigo });
                } catch (error) {
                    errores.push(`Fila ${fila} (${codigo}): ${error.message}`);
                }
            });

            if (errores.length > 0) {
                throw new ValidationError(
                    'No se cargó ningún estudiante. Corrige estos datos:\n- ' + errores.join('\n- ')
                );
            }

            // `full_name` es columna generada: no se escribe.
            for (const estudiante of validados) {
                const [studentResult] = await connection.query(
                    `INSERT INTO students (last_name, first_name, student_code) VALUES (?, ?, ?)`,
                    [estudiante.apellidos, estudiante.nombres, estudiante.studentCode]
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
               FIELD(grp.name, 'A','B','C','D','E','F','G','H','I','J') ASC,
               s.full_name ASC`,
            [academicYearId]
        );
        
        if (rows.length === 0) return 0;

        // Solo los grados con número (1°, 2°, … 11°) llevan folio.
        // Preescolar (Materno, Pre-Jardín, Jardín, Transición) queda sin folio.
        const numbered   = rows.filter(r => r.grade_num > 0);
        const unnumbered = rows.filter(r => !(r.grade_num > 0));

        if (unnumbered.length > 0) {
            await useConnection.query(
                `UPDATE enrollments SET folio_number = NULL WHERE id IN (?)`,
                [unnumbered.map(r => r.id)]
            );
        }

        if (numbered.length === 0) return 0;

        let currentBlock = 0;
        let counter = 1;
        const cases = [];
        const ids = [];

        for (const row of numbered) {
            const block = gradeBlock(row.grade_num);
            if (block !== currentBlock) { currentBlock = block; counter = 1; }
            cases.push(`WHEN ${row.id} THEN ${counter}`);
            ids.push(row.id);
            counter++;
        }

        await useConnection.query(
            `UPDATE enrollments SET folio_number = CASE id ${cases.join(' ')} END WHERE id IN (?)`,
            [ids]
        );

        return numbered.length;
    }
}

module.exports = GradeRepository;