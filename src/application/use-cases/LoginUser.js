const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class LoginUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(email, password) {
        // Cambiado: usar findByEmail (que ya filtra por deleted_at IS NULL)
        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error('Credenciales inválidas');
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            throw new Error('Credenciales inválidas');
        }

        const token = jwt.sign(
            { id: user.id, role: user.role, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // Eliminar la contraseña antes de devolver el usuario
        const { password: _, ...userWithoutPassword } = user;

        return { token, user: userWithoutPassword };
    }
}

module.exports = LoginUser;