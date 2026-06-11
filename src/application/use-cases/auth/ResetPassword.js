const bcrypt = require('bcrypt');

class ResetPassword {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(token, newPassword) {
        const user = await this.userRepository.findByResetToken(token);
        if (!user) {
            throw new Error('Token inválido o expirado');
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await this.userRepository.updatePassword(user.id, hashedPassword);
        await this.userRepository.clearResetToken(user.id);

        return { message: 'Contraseña actualizada exitosamente' };
    }
}

module.exports = ResetPassword;