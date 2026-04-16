const CreateSubject = require('../../application/use-cases/subject/CreateSubject');
const UpdateSubject = require('../../application/use-cases/subject/UpdateSubject');
const DeleteSubject = require('../../application/use-cases/subject/DeleteSubject');
const ListSubjects = require('../../application/use-cases/subject/ListSubjects');
const GetSubject = require('../../application/use-cases/subject/GetSubject');
const SubjectRepository = require('../../infrastructure/repositories/SubjectRepository');

const repo = new SubjectRepository();
const create = new CreateSubject(repo);
const update = new UpdateSubject(repo);
const del = new DeleteSubject(repo);
const list = new ListSubjects(repo);
const get = new GetSubject(repo);

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
        const subjects = await list.execute();
        res.json(subjects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const subject = await get.execute(req.params.id);
        res.json(subject);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};