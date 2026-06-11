const pool = require('../database/mysql');
const AuditRepository = require('./AuditRepository');
const auditRepo = new AuditRepository();

const FIELD_LABELS = {
    normal_note: 'Nota Normal',
    aptitudinal_note: 'Nota Actitudinal',
    absences: 'Faltas',
};

class GradeRecordRepository {
    async upsert(data) {
        const { enrollmentId, periodId, subjectAssignmentId, normalNote, aptitudinalNote, absences, average, isElective, teacherId } = data;
        const connection = await pool.getConnection();
        try {
            const [existing] = await connection.query(
                `SELECT id, normal_note, aptitudinal_note, absences FROM grade_records
                 WHERE enrollment_id = ? AND period_id = ? AND subject_assignment_id = ? AND deleted_at IS NULL`,
                [enrollmentId, periodId, subjectAssignmentId]
            );

            if (existing.length > 0) {
                const old = existing[0];
                const id = old.id;
                await connection.query(
                    `UPDATE grade_records
                     SET normal_note = ?, aptitudinal_note = ?, absences = ?, average = ?, is_elective = ?, updated_at = NOW()
                     WHERE id = ? AND deleted_at IS NULL`,
                    [normalNote, aptitudinalNote, absences, average, isElective || false, id]
                );

                // Registrar auditoría por cada campo que cambió
                if (teacherId) {
                    const checks = [
                        { field: 'normal_note',      oldVal: old.normal_note,      newVal: normalNote },
                        { field: 'aptitudinal_note', oldVal: old.aptitudinal_note, newVal: aptitudinalNote },
                        { field: 'absences',         oldVal: old.absences,         newVal: absences },
                    ];
                    for (const { field, oldVal, newVal } of checks) {
                        const ov = oldVal == null ? '' : String(oldVal);
                        const nv = newVal == null ? '' : String(newVal);
                        if (ov !== nv) {
                            await auditRepo.log({
                                teacherId,
                                enrollmentId,
                                subjectAssignmentId,
                                periodId,
                                action: 'update',
                                field: FIELD_LABELS[field] || field,
                                oldValue: ov || null,
                                newValue: nv || null,
                            });
                        }
                    }
                }

                return { id, ...data };
            } else {
                const [result] = await connection.query(
                    `INSERT INTO grade_records
                     (enrollment_id, period_id, subject_assignment_id, normal_note, aptitudinal_note, absences, average, is_elective, created_at, updated_at)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                    [enrollmentId, periodId, subjectAssignmentId, normalNote, aptitudinalNote, absences, average, isElective || false]
                );

                if (teacherId) {
                    const inserts = [
                        { field: 'normal_note',      val: normalNote },
                        { field: 'aptitudinal_note', val: aptitudinalNote },
                        { field: 'absences',         val: absences },
                    ];
                    for (const { field, val } of inserts) {
                        if (val != null && val !== '') {
                            await auditRepo.log({
                                teacherId,
                                enrollmentId,
                                subjectAssignmentId,
                                periodId,
                                action: 'create',
                                field: FIELD_LABELS[field] || field,
                                oldValue: null,
                                newValue: String(val),
                            });
                        }
                    }
                }

                return { id: result.insertId, ...data };
            }
        } finally {
            connection.release();
        }
    }

    async findByAssignmentAndPeriod(subjectAssignmentId, periodId) {
        const [rows] = await pool.query(
            `SELECT gr.id, gr.enrollment_id, gr.period_id, gr.subject_assignment_id,
                    gr.normal_note, gr.aptitudinal_note, gr.absences, gr.average, gr.is_elective,
                    e.student_id, s.full_name AS studentName, s.student_code
             FROM grade_records gr
             JOIN enrollments e ON gr.enrollment_id = e.id
             JOIN students s ON e.student_id = s.id
             WHERE gr.subject_assignment_id = ? AND gr.period_id = ? AND gr.deleted_at IS NULL
             ORDER BY s.full_name`,
            [subjectAssignmentId, periodId]
        );
        return rows;
    }

    async getStudentGradeReport(studentId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT gr.*, sa.subject_id, p.name AS periodName, p.order AS periodOrder, s.name AS subjectName
             FROM grade_records gr
             JOIN enrollments e ON gr.enrollment_id = e.id
             JOIN periods p ON gr.period_id = p.id
             JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
             JOIN subjects s ON sa.subject_id = s.id
             WHERE e.student_id = ? AND e.academic_year_id = ? AND gr.deleted_at IS NULL
             ORDER BY p.order, s.name`,
            [studentId, academicYearId]
        );
        return rows;
    }
}

module.exports = GradeRecordRepository;