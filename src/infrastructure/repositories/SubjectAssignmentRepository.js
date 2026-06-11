const pool = require('../database/mysql');

class SubjectAssignmentRepository {
    async create(data) {
        const { groupId, gradeId, subjectId, teacherId, academicYearId, isElective, weeklyHours } = data;
        const [result] = await pool.query(
            `INSERT INTO subject_assignments
             (group_id, grade_id, subject_id, teacher_id, academic_year_id, is_elective, weekly_hours)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [groupId || null, gradeId || null, subjectId, teacherId, academicYearId, isElective || false, weeklyHours || null]
        );
        return { id: result.insertId, ...data };
    }

    async update(id, data) {
        const { groupId, subjectId, teacherId, academicYearId, isElective, weeklyHours } = data;
        const [result] = await pool.query(
            `UPDATE subject_assignments
             SET group_id = ?, subject_id = ?, teacher_id = ?, academic_year_id = ?, is_elective = ?, weekly_hours = ?
             WHERE id = ? AND deleted_at IS NULL`,
            [groupId, subjectId, teacherId, academicYearId, isElective || false, weeklyHours || null, id]
        );
        return result.affectedRows > 0;
    }

    async delete(id) {
        const [result] = await pool.query(
            `UPDATE subject_assignments SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL`,
            [id]
        );
        return result.affectedRows > 0;
    }

    async findById(id) {
        const [rows] = await pool.query(
            `SELECT sa.id, sa.group_id, sa.subject_id, sa.teacher_id, sa.academic_year_id, sa.grade_id, sa.is_elective, sa.weekly_hours
             FROM subject_assignments sa
             WHERE sa.id = ? AND sa.deleted_at IS NULL`,
            [id]
        );
        return rows[0] || null;
    }

    async findAll() {
    const [rows] = await pool.query(
        `SELECT sa.id, sa.group_id, sa.grade_id, sa.subject_id, sa.teacher_id,
                sa.academic_year_id, sa.is_elective, sa.weekly_hours,
                g.name as grade_name,
                grp.name as group_name,
                s.name as subject_name, 
                u.name as teacher_name,
                ay.name as academic_year_name
         FROM subject_assignments sa
         LEFT JOIN \`groups\` grp ON sa.group_id = grp.id
         LEFT JOIN grades g ON grp.grade_id = g.id
         LEFT JOIN subjects s ON sa.subject_id = s.id
         LEFT JOIN users u ON sa.teacher_id = u.id
         LEFT JOIN academic_years ay ON sa.academic_year_id = ay.id
         WHERE sa.deleted_at IS NULL
         ORDER BY 
             CAST(g.name AS UNSIGNED) ASC,
             FIELD(grp.name, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J') ASC,
             s.name ASC`
    );
    return rows;
}

    async findByAcademicYear(academicYearId) {
        const [rows] = await pool.query(
            `SELECT sa.id, sa.group_id, sa.grade_id, sa.subject_id, sa.teacher_id,
                    sa.academic_year_id, sa.is_elective, sa.weekly_hours,
                    g.name as grade_name,
                    grp.name as group_name,
                    s.name as subject_name, 
                    u.name as teacher_name,
                    ay.name as academic_year_name
             FROM subject_assignments sa
             LEFT JOIN \`groups\` grp ON sa.group_id = grp.id
             LEFT JOIN grades g ON grp.grade_id = g.id
             LEFT JOIN subjects s ON sa.subject_id = s.id
             LEFT JOIN users u ON sa.teacher_id = u.id
             LEFT JOIN academic_years ay ON sa.academic_year_id = ay.id
             WHERE sa.academic_year_id = ?
               AND sa.deleted_at IS NULL
             ORDER BY g.name, grp.name, s.name`,
            [academicYearId]
        );
        return rows;
    }

    async findByTeacherAndYear(teacherId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT sa.id, sa.group_id, sa.subject_id, sa.academic_year_id, sa.is_elective,
                    g.name as grade_name,
                    grp.name as group_name,
                    s.name as subject_name
             FROM subject_assignments sa
             LEFT JOIN \`groups\` grp ON sa.group_id = grp.id
             LEFT JOIN grades g ON grp.grade_id = g.id
             LEFT JOIN subjects s ON sa.subject_id = s.id
             WHERE sa.teacher_id = ? 
               AND sa.academic_year_id = ? 
               AND sa.deleted_at IS NULL
             ORDER BY g.name, grp.name, s.name`,
            [teacherId, academicYearId]
        );
        return rows;
    }

    async findByTeacherAndSubject(teacherId, subjectId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT id, teacher_id, subject_id, academic_year_id, is_elective
             FROM subject_assignments 
             WHERE teacher_id = ? AND subject_id = ? AND academic_year_id = ? 
             AND is_elective = 1 AND deleted_at IS NULL`,
            [teacherId, subjectId, academicYearId]
        );
        return rows;
    }

    async findUnique(groupId, subjectId, academicYearId) {
        const [rows] = await pool.query(
            `SELECT id FROM subject_assignments
             WHERE group_id = ? AND subject_id = ? AND academic_year_id = ? 
             AND (is_elective = 0 OR is_elective IS NULL) AND deleted_at IS NULL`,
            [groupId, subjectId, academicYearId]
        );
        return rows[0] || null;
    }
}

module.exports = SubjectAssignmentRepository;