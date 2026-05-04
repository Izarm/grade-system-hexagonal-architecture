const CreateOrUpdateGradeRecord = require('../../application/use-cases/gradeRecord/CreateOrUpdateGradeRecord');
const GetGradesByAssignmentAndPeriod = require('../../application/use-cases/gradeRecord/GetGradesByAssignmentAndPeriod');
const GetTeacherAssignments = require('../../application/use-cases/gradeRecord/GetTeacherAssignments');
const GetStudentGradeReport = require('../../application/use-cases/gradeRecord/GetStudentGradeReport');
const GradeRecordRepository = require('../../infrastructure/repositories/GradeRecordRepository');
const PeriodRepository = require('../../infrastructure/repositories/PeriodRepository');
const SubjectAssignmentRepository = require('../../infrastructure/repositories/SubjectAssignmentRepository');

const gradeRepo = new GradeRecordRepository();
const periodRepo = new PeriodRepository();
const assignmentRepo = new SubjectAssignmentRepository();

const upsert = new CreateOrUpdateGradeRecord(gradeRepo, periodRepo);
const getGrades = new GetGradesByAssignmentAndPeriod(gradeRepo, periodRepo);
const getAssignments = new GetTeacherAssignments(assignmentRepo);
const getReport = new GetStudentGradeReport(gradeRepo);

exports.saveGrade = async (req, res) => {
    try {
        const result = await upsert.execute(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getGrades = async (req, res) => {
    try {
        const { subjectAssignmentId, periodId } = req.query;
        const result = await getGrades.execute(subjectAssignmentId, periodId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getTeacherAssignments = async (req, res) => {
    try {
        const teacherId = req.user.id; // viene del middleware
        const { academicYearId } = req.query;
        const result = await getAssignments.execute(teacherId, academicYearId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.getStudentReport = async (req, res) => {
    try {
        const { studentId, academicYearId } = req.query;
        const result = await getReport.execute(studentId, academicYearId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};