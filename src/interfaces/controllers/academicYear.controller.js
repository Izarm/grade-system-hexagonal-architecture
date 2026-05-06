const CreateAcademicYear = require('../../application/use-cases/academicYear/CreateAcademicYear');
const UpdateAcademicYear = require('../../application/use-cases/academicYear/UpdateAcademicYear');
const DeleteAcademicYear = require('../../application/use-cases/academicYear/DeleteAcademicYear');
const ListAcademicYears = require('../../application/use-cases/academicYear/ListAcademicYears');
const GetAcademicYear = require('../../application/use-cases/academicYear/GetAcademicYear');
const AcademicYearRepository = require('../../infrastructure/repositories/AcademicYearRepository');

const repo = new AcademicYearRepository();
const create = new CreateAcademicYear(repo);
const update = new UpdateAcademicYear(repo);
const del = new DeleteAcademicYear(repo);
const list = new ListAcademicYears(repo);
const get = new GetAcademicYear(repo);

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
        const years = await list.execute();
        res.json(years);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const year = await get.execute(req.params.id);
        res.json(year);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};