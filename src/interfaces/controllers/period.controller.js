const CreatePeriod = require('../../application/use-cases/period/CreatePeriod');
const UpdatePeriod = require('../../application/use-cases/period/UpdatePeriod');
const DeletePeriod = require('../../application/use-cases/period/DeletePeriod');
const ListPeriods = require('../../application/use-cases/period/ListPeriods');
const GetPeriod = require('../../application/use-cases/period/GetPeriod');
const PeriodRepository = require('../../infrastructure/repositories/PeriodRepository');
const ClosePeriod = require('../../application/use-cases/period/ClosePeriod');
const ReopenPeriod = require('../../application/use-cases/period/ReopenPeriod');

const repo = new PeriodRepository();
const create = new CreatePeriod(repo);
const update = new UpdatePeriod(repo);
const del = new DeletePeriod(repo);
const list = new ListPeriods(repo);
const get = new GetPeriod(repo);
const closePeriodUseCase = new ClosePeriod(repo);
const reopenPeriodUseCase = new ReopenPeriod(repo);

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
        const periods = await list.execute();
        res.json(periods);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const period = await get.execute(req.params.id);
        res.json(period);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};

exports.closePeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const result = await closePeriodUseCase.execute(id, userId);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.reopenPeriod = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await reopenPeriodUseCase.execute(id);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};