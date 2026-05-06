const CreateGroup = require('../../application/use-cases/group/CreateGroup');
const UpdateGroup = require('../../application/use-cases/group/UpdateGroup');
const DeleteGroup = require('../../application/use-cases/group/DeleteGroup');
const ListGroups = require('../../application/use-cases/group/ListGroups');
const GetGroup = require('../../application/use-cases/group/GetGroup');
const GroupRepository = require('../../infrastructure/repositories/GroupRepository');

const repo = new GroupRepository();
const create = new CreateGroup(repo);
const update = new UpdateGroup(repo);
const del = new DeleteGroup(repo);
const list = new ListGroups(repo);
const get = new GetGroup(repo);

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
        const groups = await list.execute();
        res.json(groups);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getById = async (req, res) => {
    try {
        const group = await get.execute(req.params.id);
        res.json(group);
    } catch (error) {
        res.status(404).json({ message: error.message });
    }
};