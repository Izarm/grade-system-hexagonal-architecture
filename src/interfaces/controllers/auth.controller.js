// src/interfaces/controllers/auth.controller.js
const LoginUser = require('../../application/use-cases/LoginUser');
const RegisterUser = require('../../application/use-cases/RegisterUser');
const MySQLUserRepository = require('../../infrastructure/repositories/MySQLUserRepository');

const userRepo = new MySQLUserRepository();
const loginUser = new LoginUser(userRepo);
const registerUser = new RegisterUser(userRepo);

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
        }

        const result = await loginUser.execute(email, password);
        res.json(result);
    } catch (error) {
        const status = error.message === 'Credenciales inválidas' ? 401 : 400;
        res.status(status).json({ message: error.message });
    }
};

exports.register = async (req, res) => {
    try {
        const userData = req.body;
        const currentUserRole = req.user.role; // viene del middleware

        const newUser = await registerUser.execute(userData, currentUserRole);
        res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};