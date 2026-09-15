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
        const { leerNombreDePeticion } = require('../../shared/personName');

        const userData = req.body;
        const nombre = leerNombreDePeticion(userData);
        const hashed = await bcrypt.hash(userData.password, 10);

        // Aqui SI se respeta el rol: la ruta exige sesion de administrador.
        const user = await repo.create({
            ...userData,
            lastName: nombre.apellidos,
            firstName: nombre.nombres,
            password: hashed,
            status: 'active'
        });
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
        const { leerNombreDePeticion } = require('../../shared/personName');
        const nombre = leerNombreDePeticion(req.body);

        const updated = await repo.updateTeacher(req.params.id, {
            ...req.body,
            lastName: nombre.apellidos,
            firstName: nombre.nombres
        });
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

exports.replaceTeacher = async (req, res) => {
    try {
        const oldTeacherId = req.params.id;
        const { newTeacherId, transferDirectorship, deactivateOld } = req.body;
        if (!newTeacherId) return res.status(400).json({ message: 'Falta el docente entrante (newTeacherId)' });
        const result = await repo.replaceTeacher(oldTeacherId, newTeacherId, { transferDirectorship, deactivateOld });
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};