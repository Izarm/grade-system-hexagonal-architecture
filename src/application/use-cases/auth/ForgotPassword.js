const crypto = require('crypto');
const nodemailer = require('nodemailer');

class ForgotPassword {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }

    async execute(email) {
        const user = await this.userRepository.findByEmail(email);
        if (!user) {
            throw new Error('No existe un usuario con ese correo');
        }

        // Generar token único
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1); // Válido por 1 hora

        // Guardar token en la base de datos
        await this.userRepository.saveResetToken(user.id, resetToken, expiresAt);

        // Configurar transporte de correo (ajusta con tus credenciales)
        const transporter = nodemailer.createTransport({
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.EMAIL_PORT) || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });

        // Enviar correo
        const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
        await transporter.sendMail({
            to: email,
            subject: 'Recuperación de contraseña - San José de Tarbes',
            html: `
                <h1>Recuperación de contraseña</h1>
                <p>Haz clic en el siguiente enlace para restablecer tu contraseña:</p>
                <a href="${resetUrl}">${resetUrl}</a>
                <p>Este enlace expirará en 1 hora.</p>
                <p>Si no solicitaste este cambio, ignora este mensaje.</p>
            `
        });

        return { message: 'Correo de recuperación enviado' };
    }
}

module.exports = ForgotPassword;