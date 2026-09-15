const bcrypt = require('bcrypt');
const { leerNombreDePeticion } = require('../../../shared/personName');
const { ValidationError } = require('../../../shared/errors');

class RegisterUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(userData) { // ← Eliminamos el parámetro currentUserRole
        // Ya no validamos si es admin

        // Apellidos y nombres por separado (acepta tambien el { name } antiguo).
        const nombre = leerNombreDePeticion(userData);

        const email = String(userData.email ?? '').trim().toLowerCase();
        const phone = String(userData.phone ?? '').trim();
        const password = String(userData.password ?? '');

        if (email === '') throw new ValidationError('El correo es obligatorio', 'email');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            throw new ValidationError('El correo no tiene un formato válido', 'email');
        }
        if (password === '') throw new ValidationError('La contraseña es obligatoria', 'password');
        if (password.length < 8) {
            throw new ValidationError('La contraseña debe tener al menos 8 caracteres', 'password');
        }

        // Hash de la contraseña
        const hashedPassword = await bcrypt.hash(password, 10);

        // Crear usuario (solo se permite registrar docentes, no admins)
        // En el objeto newUser, agrega:
        // El rol NO se toma del cuerpo de la peticion: este es el registro
        // PUBLICO. Antes hacia `role: userData.role`, asi que cualquiera podia
        // enviar {"role":"admin"} y quedar en la cola como administrador.
        // Los administradores se crean desde el panel (POST /api/users/register).
        const newUser = {
            lastName: nombre.apellidos,
            firstName: nombre.nombres,
            email,
            phone: phone || null,
            password: hashedPassword,
            role: 'docente',
            status: 'pending'
        };

        const savedUser = await this.userRepository.create(newUser);

        // No devolver la contraseña
        const { password: _, ...userWithoutPassword } = savedUser;
        return userWithoutPassword;
    }
}

module.exports = RegisterUser;