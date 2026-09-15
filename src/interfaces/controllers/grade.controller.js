const CreateGrade = require('../../application/use-cases/grade/CreateGrade');
const UpdateGrade = require('../../application/use-cases/grade/UpdateGrade');
const DeleteGrade = require('../../application/use-cases/grade/DeleteGrade');
const ListGrades = require('../../application/use-cases/grade/ListGrades');
const GetGrade = require('../../application/use-cases/grade/GetGrade');
const GradeRepository = require('../../infrastructure/repositories/GradeRepository');
const pool = require('../../infrastructure/database/mysql');

const repo = new GradeRepository();
const create = new CreateGrade(repo);
const update = new UpdateGrade(repo);
const del = new DeleteGrade(repo);
const list = new ListGrades(repo);
const get = new GetGrade(repo);

exports.create = async (req, res) => {
    try {
        const { name, students, academicYearId } = req.body;
        const grade = await create.execute(name, students || [], academicYearId || null);
        res.status(201).json(grade);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const result = await update.execute(req.params.id, req.body.name);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.list = async (req, res) => {
    try {
        const { academicYearId } = req.query;
        const grades = await repo.findAll(academicYearId || null);
        res.json(grades);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const grade = await get.execute(req.params.id);
        res.json(grade);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.assignHeadTeacher = async (req, res) => {
    try {
        const { id } = req.params;
        const { teacherId } = req.body;
        const result = await repo.updateHeadTeacher(id, teacherId);
        res.json({ success: result });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getHeadTeacherReport = async (req, res) => {
    try {
        const teacherId = req.user.id;
        
        const [grades] = await pool.query(
            `SELECT id, name FROM grades WHERE head_teacher_id = ? AND deleted_at IS NULL`,
            [teacherId]
        );
        
        if (grades.length === 0) {
            return res.status(403).json({ message: 'No eres director de ningún grado' });
        }
        
        const [activeYear] = await pool.query(
            `SELECT id FROM academic_years WHERE active = 1 LIMIT 1`
        );
        const academicYearId = activeYear[0]?.id || 1;
        
        const [periods] = await pool.query(
            `SELECT id, name, \`order\`, percentage 
             FROM periods 
             WHERE academic_year_id = ? AND deleted_at IS NULL
             ORDER BY \`order\``,
            [academicYearId]
        );
        
        const gradeIds = grades.map(g => g.id);

        const [[allStudents], [allSubjects], [allGradesData]] = await Promise.all([
            pool.query(
                `SELECT DISTINCT s.id, s.full_name, s.student_code, grp.grade_id
                 FROM enrollments e
                 JOIN students s ON e.student_id = s.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 WHERE grp.grade_id IN (?) AND e.academic_year_id = ?
                   AND e.deleted_at IS NULL AND s.deleted_at IS NULL AND grp.deleted_at IS NULL
                 ORDER BY s.full_name`,
                [gradeIds, academicYearId]
            ),
            pool.query(
                `SELECT DISTINCT sub.id, sub.name, sub.area, grp.grade_id
                 FROM subject_assignments sa
                 JOIN subjects sub ON sa.subject_id = sub.id
                 JOIN \`groups\` grp ON sa.group_id = grp.id
                 WHERE grp.grade_id IN (?) AND sa.deleted_at IS NULL AND grp.deleted_at IS NULL
                 ORDER BY sub.name`,
                [gradeIds]
            ),
            pool.query(
                `SELECT gr.enrollment_id, gr.subject_assignment_id, gr.period_id,
                        gr.normal_note, gr.aptitudinal_note, gr.average,
                        e.student_id, sa.subject_id, grp.grade_id
                 FROM grade_records gr
                 JOIN enrollments e ON gr.enrollment_id = e.id
                 JOIN subject_assignments sa ON gr.subject_assignment_id = sa.id
                 JOIN \`groups\` grp ON e.group_id = grp.id
                 WHERE grp.grade_id IN (?) AND e.academic_year_id = ?
                   AND gr.deleted_at IS NULL AND grp.deleted_at IS NULL
                 GROUP BY gr.id`,
                [gradeIds, academicYearId]
            ),
        ]);

        const reports = grades.map((grade) => ({
            gradeId: grade.id,
            gradeName: grade.name,
            students: allStudents.filter(s => s.grade_id === grade.id),
            subjects: allSubjects.filter(s => s.grade_id === grade.id),
            grades: allGradesData.filter(g => g.grade_id === grade.id),
            periods,
        }));
        
        res.json({
            reports,
            currentTeacherId: teacherId,
            academicYearId
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};