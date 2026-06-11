const MySQLUserRepository = require('../../infrastructure/repositories/MySQLUserRepository');
const repo = new MySQLUserRepository();

exports.list = async (req, res) => {
    try {
        const users = await repo.findAll();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.registerByAdmin = async (req, res) => {
    try {
        const bcrypt = require('bcrypt');
        const userData = req.body;
        const hashed = await bcrypt.hash(userData.password, 10);
        const user = await repo.create({ ...userData, password: hashed, status: 'active' });
        res.status(201).json({ message: 'Usuario registrado exitosamente', user });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.listTeachers = async (req, res) => {
    try {
        const teachers = await repo.findTeachersWithDetails();
        res.json(teachers);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.updateTeacher = async (req, res) => {
    try {
        const updated = await repo.updateTeacher(req.params.id, req.body);
        if (!updated) return res.status(404).json({ message: 'Docente no encontrado' });
        res.json({ message: 'Docente actualizado exitosamente' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.deleteTeacher = async (req, res) => {
    try {
        await repo.deleteTeacherCascade(req.params.id);
        res.json({ message: 'Docente eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};