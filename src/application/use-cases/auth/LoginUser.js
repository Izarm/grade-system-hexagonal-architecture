const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class LoginUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(email, password) {
        const user = await this.userRepository.findByEmail(email);

        if (!user) {
            throw new Error('Credenciales inválidas');
        }

        // Verificar si el usuario está aprobado
        if (user.status !== 'active') {
            throw new Error('Tu cuenta está pendiente de aprobación por el administrador');
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

        const { password: _, ...userWithoutPassword } = user;
        return { token, user: userWithoutPassword };
    }
}

module.exports = LoginUser;