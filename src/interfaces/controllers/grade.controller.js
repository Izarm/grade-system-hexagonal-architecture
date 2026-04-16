const CreateGrade = require('../../application/use-cases/grade/CreateGrade');
const UpdateGrade = require('../../application/use-cases/grade/UpdateGrade');
const DeleteGrade = require('../../application/use-cases/grade/DeleteGrade');
const ListGrades = require('../../application/use-cases/grade/ListGrades');
const GetGrade = require('../../application/use-cases/grade/GetGrade');
const GradeRepository = require('../../infrastructure/repositories/GradeRepository');

const repo = new GradeRepository();
const create = new CreateGrade(repo);
const update = new UpdateGrade(repo);
const del = new DeleteGrade(repo);
const list = new ListGrades(repo);
const get = new GetGrade(repo);

exports.create = async (req, res) => {
    try {
        const result = await create.execute(req.body.name);
        res.status(201).json(result);
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
        const grades = await list.execute();
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