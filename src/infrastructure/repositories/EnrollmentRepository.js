const pool = require('../database/mysql');
const { gradeBlock } = require('../constants/gradeRanges');

class EnrollmentRepository {
    async create(data) {
        const { studentId, groupId, academicYearId, enrollmentValue } = data;
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // Validar que el estudiante no esté ya matriculado en ningún grupo de este año
            const [activeEnrollment] = await connection.query(
                `SELECT id, group_id FROM enrollments
                 WHERE student_id = ? AND academic_year_id = ? AND deleted_at IS NULL`,
                [studentId, academicYearId]
            );
            if (activeEnrollment.length > 0) {
                if (activeEnrollment[0].group_id === parseInt(groupId)) {
                    throw new Error('El estudiante ya está matriculado en este grupo para el año lectivo actual');
                } else {
                    throw new Error('El estudiante ya está matriculado en otro grupo para este año lectivo. Use la opción de traslado.');
                }
            }

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
                    `INSERT INTO enrollments (student_id, group_id, academic_year_id, enrollment_value) VALUES (?, ?, ?, ?)`,
                    [studentId, groupId, academicYearId, enrollmentValue || null]
                );
                insertId = result.insertId;
            }

            await this.recalculateFolioNumbers(academicYearId, connection);
            await connection.commit();

            // Fetch the actual folio assigned after recalculation
            const [folioRow] = await pool.query(
                `SELECT folio_number FROM enrollments WHERE id = ?`, [insertId]
            );
            return { id: insertId, ...data, folio_number: folioRow[0]?.folio_number };
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
            // Cascade: soft-delete grade_records linked to this enrollment
            await connection.query(
                `UPDATE grade_records SET deleted_at = NOW() WHERE enrollment_id = ? AND deleted_at IS NULL`,
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
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number, e.enrollment_value,
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

    async findAll(academicYearId = null) {
        const where = academicYearId
            ? 'WHERE e.deleted_at IS NULL AND e.academic_year_id = ?'
            : 'WHERE e.deleted_at IS NULL';
        const params = academicYearId ? [academicYearId] : [];
        const [rows] = await pool.query(
            `SELECT e.id, e.student_id, e.group_id, e.academic_year_id, e.folio_number, e.enrollment_value,
                    s.full_name as student_name, s.student_code,
                    g.name as grade_name,
                    grp.name as group_letter,
                    ay.name as academic_year_name
             FROM enrollments e
             JOIN students s ON e.student_id = s.id
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON COALESCE(e.grade_id, grp.grade_id) = g.id
             JOIN academic_years ay ON e.academic_year_id = ay.id
             ${where}
             ORDER BY
               CAST(g.name AS UNSIGNED) ASC,
               grp.name ASC,
               e.folio_number ASC`,
            params
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

    async transfer(enrollmentId, targetGroupId) {
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            // 1. Obtener matrícula actual con info del grupo
            const [enrollmentRows] = await connection.query(
                `SELECT e.id, e.student_id, e.group_id, e.academic_year_id,
                        s.full_name as student_name,
                        grp.name as current_group_name
                 FROM enrollments e
                 JOIN students s ON e.student_id = s.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 WHERE e.id = ? AND e.deleted_at IS NULL`,
                [enrollmentId]
            );
            if (enrollmentRows.length === 0) throw new Error('Matrícula no encontrada');
            const enrollment = enrollmentRows[0];

            if (enrollment.group_id === parseInt(targetGroupId)) {
                throw new Error('El estudiante ya pertenece a ese grupo');
            }

            // 2. Verificar que el grupo destino existe
            const [targetGroupRows] = await connection.query(
                `SELECT id, name FROM \`groups\` WHERE id = ? AND deleted_at IS NULL`,
                [targetGroupId]
            );
            if (targetGroupRows.length === 0) throw new Error('Grupo destino no encontrado');
            const targetGroup = targetGroupRows[0];

            // 3. Verificar que el estudiante no esté ya matriculado en el grupo destino
            const [duplicate] = await connection.query(
                `SELECT id FROM enrollments
                 WHERE student_id = ? AND group_id = ? AND academic_year_id = ? AND deleted_at IS NULL`,
                [enrollment.student_id, targetGroupId, enrollment.academic_year_id]
            );
            if (duplicate.length > 0) {
                throw new Error('El estudiante ya está matriculado en el grupo destino para este año lectivo');
            }

            // 4. Obtener todas las notas de esta matrícula
            const [gradeRecords] = await connection.query(
                `SELECT gr.id, gr.subject_assignment_id, gr.period_id,
                        sa.subject_id, sub.name as subject_name, sa.is_elective
                 FROM grade_records gr
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN subjects sub ON sa.subject_id = sub.id
                 WHERE gr.enrollment_id = ? AND gr.deleted_at IS NULL`,
                [enrollmentId]
            );

            // 5. Reasignar notas al equivalente en el grupo destino
            const warnings = [];
            for (const gr of gradeRecords) {
                if (gr.is_elective) continue; // las electivas no dependen del grupo

                const [targetSa] = await connection.query(
                    `SELECT id FROM subject_assignments
                     WHERE group_id = ? AND subject_id = ? AND academic_year_id = ?
                       AND (is_elective = 0 OR is_elective IS NULL) AND deleted_at IS NULL
                     LIMIT 1`,
                    [targetGroupId, gr.subject_id, enrollment.academic_year_id]
                );

                if (targetSa.length > 0) {
                    // Evitar duplicado si ya existe una nota para esa combinación
                    const [existing] = await connection.query(
                        `SELECT id FROM grade_records
                         WHERE enrollment_id = ? AND period_id = ? AND subject_assignment_id = ? AND deleted_at IS NULL`,
                        [enrollmentId, gr.period_id, targetSa[0].id]
                    );
                    if (existing.length === 0) {
                        await connection.query(
                            `UPDATE grade_records SET subject_assignment_id = ? WHERE id = ?`,
                            [targetSa[0].id, gr.id]
                        );
                    }
                } else {
                    warnings.push(gr.subject_name);
                }
            }

            // 6. Actualizar el grupo en la matrícula
            await connection.query(
                `UPDATE enrollments SET group_id = ?, updated_at = NOW() WHERE id = ?`,
                [targetGroupId, enrollmentId]
            );

            // 7. Registrar el traslado en la tabla de historial
            await connection.query(
                `INSERT INTO enrollment_transfer_logs
                 (enrollment_id, student_id, from_group_id, to_group_id, from_group_name, to_group_name, academic_year_id, warnings)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    enrollmentId,
                    enrollment.student_id,
                    enrollment.group_id,
                    targetGroupId,
                    enrollment.current_group_name,
                    targetGroup.name,
                    enrollment.academic_year_id,
                    warnings.length > 0 ? warnings.join(', ') : null
                ]
            );

            // 8. Recalcular folios para todo el año
            await this.recalculateFolioNumbers(enrollment.academic_year_id, connection);

            await connection.commit();

            return {
                success: true,
                studentName: enrollment.student_name,
                fromGroup: enrollment.current_group_name,
                toGroup: targetGroup.name,
                warnings,
                message: warnings.length > 0
                    ? `Traslado realizado. ${warnings.length} asignatura(s) sin docente en el grupo destino: ${warnings.join(', ')}`
                    : 'Traslado realizado exitosamente'
            };
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async recalculateFolioNumbers(academicYearId, connection = null) {
        const useConnection = connection || pool;

        const [rows] = await useConnection.query(
            `SELECT e.id, CAST(g.name AS UNSIGNED) as grade_num, s.full_name
             FROM enrollments e
             JOIN \`groups\` grp ON e.group_id = grp.id
             JOIN grades g ON grp.grade_id = g.id
             JOIN students s ON e.student_id = s.id
             WHERE e.academic_year_id = ? AND e.deleted_at IS NULL
             ORDER BY
               CASE
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 1 AND 5  THEN 1
                 WHEN CAST(g.name AS UNSIGNED) BETWEEN 6 AND 9  THEN 2
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

module.exports = EnrollmentRepository;