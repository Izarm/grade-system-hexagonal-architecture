const CreateAssignment = require('../../application/use-cases/subjectAssignment/CreateSubjectAssignment');
const UpdateAssignment = require('../../application/use-cases/subjectAssignment/UpdateSubjectAssignment');
const DeleteAssignment = require('../../application/use-cases/subjectAssignment/DeleteSubjectAssignment');
const ListAssignments = require('../../application/use-cases/subjectAssignment/ListSubjectAssignments');
const GetAssignment = require('../../application/use-cases/subjectAssignment/GetSubjectAssignment');
const SubjectAssignmentRepository = require('../../infrastructure/repositories/SubjectAssignmentRepository');

const repo = new SubjectAssignmentRepository();
const create = new CreateAssignment(repo);
const update = new UpdateAssignment(repo);
const del = new DeleteAssignment(repo);
const list = new ListAssignments(repo);
const get = new GetAssignment(repo);

exports.create = async (req, res) => {
    try {
        const result = await create.execute(req.body);
        res.status(201).json(result);
    } catch (error) {
        console.error('Error en create subjectAssignment:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const result = await update.execute(req.params.id, req.body);
        res.json(result);
    } catch (error) {
        console.error('Error en update subjectAssignment:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.delete = async (req, res) => {
    try {
        await del.execute(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error en delete subjectAssignment:', error);
        res.status(400).json({ message: error.message });
    }
};

exports.list = async (req, res) => {
    try {
        const { academicYearId, isElective } = req.query;
        let assignments;

        if (academicYearId) {
            assignments = await repo.findByAcademicYear(parseInt(academicYearId));
        } else {
            assignments = await list.execute();
        }

        // Si el usuario es docente, solo devolver sus propias asignaciones
        if (req.user && req.user.role === 'docente') {
            assignments = assignments.filter(a => a.teacher_id === req.user.id);
        }

        if (isElective === 'true') {
            assignments = assignments.filter(a => a.is_elective === 1);
        } else if (isElective === 'false') {
            assignments = assignments.filter(a => a.is_elective === 0);
        }

        res.json(assignments);
    } catch (error) {
        console.error('Error en list subjectAssignments:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.listByGrade = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { gradeId } = req.params;
        const { academicYearId } = req.query;

        // Verify the requesting docente is head teacher of this grade
        if (req.user.role === 'docente') {
            const [rows] = await pool.query(
                `SELECT id FROM grades WHERE id = ? AND head_teacher_id = ? AND deleted_at IS NULL`,
                [gradeId, req.user.id]
            );
            if (rows.length === 0) {
                return res.status(403).json({ message: 'No eres director de este grado' });
            }
        }

        let assignments = academicYearId
            ? await repo.findByAcademicYear(parseInt(academicYearId))
            : await list.execute();

        // Filter to this grade's groups + electives, no teacher filter
        const [groups] = await pool.query(
            `SELECT id FROM \`groups\` WHERE grade_id = ? AND deleted_at IS NULL`,
            [gradeId]
        );
        const groupIdSet = new Set(groups.map(g => g.id));

        assignments = assignments.filter(a =>
            (a.is_elective === 1) || groupIdSet.has(a.group_id)
        );

        res.json(assignments);
    } catch (error) {
        console.error('Error en listByGrade:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const assignment = await get.execute(req.params.id);
        res.json(assignment);
    } catch (error) {
        console.error('Error en getById subjectAssignment:', error);
        res.status(404).json({ message: error.message });
    }
};