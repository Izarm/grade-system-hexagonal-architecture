const bcrypt = require('bcrypt');

class RegisterUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(userData) { // ← Eliminamos el parámetro currentUserRole
        // Ya no validamos si es admin

        const { name, document, email, phone, password, role } = userData;

        // Validar campos obligatorios
        if (!name || !document || !email || !password) {
            throw new Error('Faltan campos obligatorios: nombre, documento, email y contraseña');
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario (solo se permite registrar docentes, no admins)
        // En el objeto newUser, agrega:
        const newUser = {
            name,
            document,
            email,
            phone: phone || null,
            password: hashedPassword,
            role: role || 'docente',
            status: 'pending'  // ← Agregar esta línea
        };

        const savedUser = await this.userRepository.create(newUser);

        // No devolver la contraseña
        const { password: _, ...userWithoutPassword } = savedUser;
        return userWithoutPassword;
    }
}

module.exports = RegisterUser;