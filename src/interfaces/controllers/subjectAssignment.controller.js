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
        const assignments = await list.execute();
        res.json(assignments);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getById = async (req, res) => {
    try {
        const assignment = await get.execute(req.params.id);
        res.json(assignment);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};