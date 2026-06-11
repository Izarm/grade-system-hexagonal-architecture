const CreateEnrollment = require('../../application/use-cases/enrollment/CreateEnrollment');
const UpdateEnrollment = require('../../application/use-cases/enrollment/UpdateEnrollment');
const DeleteEnrollment = require('../../application/use-cases/enrollment/DeleteEnrollment');
const ListEnrollments = require('../../application/use-cases/enrollment/ListEnrollments');
const GetEnrollment = require('../../application/use-cases/enrollment/GetEnrollment');
const EnrollmentRepository = require('../../infrastructure/repositories/EnrollmentRepository');

const repo = new EnrollmentRepository();
const create = new CreateEnrollment(repo);
const update = new UpdateEnrollment(repo);
const del = new DeleteEnrollment(repo);
const list = new ListEnrollments(repo);
const get = new GetEnrollment(repo);

exports.create = async (req, res) => {
    try {
        const result = await create.execute(req.body);
        res.status(201).json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.update = async (req, res) => {
    try {
        const result = await update.execute(req.params.id, req.body);
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
        const { studentId, groupId, gradeId, academicYearId } = req.query;
        let enrollments;
        
        if (studentId) {
            enrollments = await repo.findByStudent(studentId);
        } else if (gradeId) {
            // Filtrar por grado (ID del grade)
            enrollments = await repo.findByGrade(gradeId, academicYearId);
        } else if (groupId && academicYearId) {
            enrollments = await repo.findByGroupAndYear(groupId, academicYearId);
        } else {
            enrollments = await list.execute();
        }
        
        res.json(enrollments);
    } catch (error) {
        console.error('Error en list enrollments:', error);
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const enrollment = await get.execute(req.params.id);
        res.json(enrollment);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};