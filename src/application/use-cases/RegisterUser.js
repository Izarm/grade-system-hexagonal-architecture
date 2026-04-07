// src/application/use-cases/RegisterUser.js
const bcrypt = require('bcrypt');

class RegisterUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(userData, currentUserRole) {
        // Solo admin puede registrar
        if (currentUserRole !== 'admin') {
            throw new Error('No autorizado');
        }

        // Validar datos requeridos
        if (!userData.name || !userData.document || !userData.email || !userData.password) {
            throw new Error('Faltan campos obligatorios: nombre, documento, email y contraseña');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(userData.password, 10);

        // Crear objeto con los datos del usuario
        const newUser = {
            name: userData.name,
            document: userData.document,
            email: userData.email,
            phone: userData.phone || null,
            password: hashedPassword,
            role: userData.role || 'docente' // por defecto docente
        };

        // Guardar en repositorio
        const savedUser = await this.userRepository.create(newUser);

        // No devolver la contraseña
        const { password: _, ...userWithoutPassword } = savedUser;
        return userWithoutPassword;
    }
}

module.exports = RegisterUser;