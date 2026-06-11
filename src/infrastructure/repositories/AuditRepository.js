const pool = require('../database/mysql');

class AuditRepository {
    async log({ teacherId, enrollmentId, subjectAssignmentId, periodId, action, field, oldValue, newValue }) {
        await pool.query(
            `INSERT INTO grade_audit_logs
             (teacher_id, enrollment_id, subject_assignment_id, period_id, action, field, old_value, new_value)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [teacherId, enrollmentId, subjectAssignmentId, periodId, action, field, oldValue ?? null, newValue ?? null]
        );
    }

    async findAll({ teacherId, studentId, periodId, limit = 200, offset = 0 } = {}) {
        let query = `
            SELECT
                al.id,
                al.action,
                al.field,
                al.old_value,
                al.new_value,
                al.created_at,
                u.name  AS teacher_name,
                s.full_name AS student_name,
                sub.name AS subject_name,
                p.name  AS period_name,
                grp.name AS group_name
            FROM grade_audit_logs al
            JOIN users u ON al.teacher_id = u.id
            JOIN enrollments e ON al.enrollment_id = e.id
            JOIN students s ON e.student_id = s.id
            JOIN subject_assignments sa ON al.subject_assignment_id = sa.id
            JOIN subjects sub ON sa.subject_id = sub.id
            JOIN periods p ON al.period_id = p.id
            JOIN \`groups\` grp ON e.group_id = grp.id
            WHERE 1=1
        `;
        const params = [];

        if (teacherId) { query += ` AND al.teacher_id = ?`; params.push(teacherId); }
        if (studentId) { query += ` AND e.student_id = ?`; params.push(studentId); }
        if (periodId)  { query += ` AND al.period_id = ?`;  params.push(periodId); }

        query += ` ORDER BY al.created_at DESC LIMIT ? OFFSET ?`;
        params.push(Number(limit), Number(offset));

        const [rows] = await pool.query(query, params);
        return rows;
    }

    async count({ teacherId, studentId, periodId } = {}) {
        let query = `
            SELECT COUNT(*) AS total
            FROM grade_audit_logs al
            JOIN enrollments e ON al.enrollment_id = e.id
            WHERE 1=1
        `;
        const params = [];
        if (teacherId) { query += ` AND al.teacher_id = ?`; params.push(teacherId); }
        if (studentId) { query += ` AND e.student_id = ?`;  params.push(studentId); }
        if (periodId)  { query += ` AND al.period_id = ?`;  params.push(periodId); }
        const [[{ total }]] = await pool.query(query, params);
        return total;
    }
}

module.exports = AuditRepository;
