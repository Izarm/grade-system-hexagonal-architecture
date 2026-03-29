const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

class LoginUser {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(email, password) {
        const user = await this.userRepository.findByEmail(email);

        if (!user) throw new Error("Usuario no encontrado");

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) throw new Error("Contraseña incorrecta");

        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );

        // No devolvemos la contraseña
        delete user.password;
        return { token, user };
    }
}
module.exports = LoginUser;