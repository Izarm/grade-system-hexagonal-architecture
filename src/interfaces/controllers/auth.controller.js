const jwt = require('jsonwebtoken');
const LoginUser = require('../../application/use-cases/auth/LoginUser');
const RegisterUser = require('../../application/use-cases/auth/RegisterUser');
const ForgotPassword = require('../../application/use-cases/auth/ForgotPassword');
const ResetPassword = require('../../application/use-cases/auth/ResetPassword');
const MySQLUserRepository = require('../../infrastructure/repositories/MySQLUserRepository');

const userRepo = new MySQLUserRepository();
const loginUser = new LoginUser(userRepo);
const registerUser = new RegisterUser(userRepo);

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
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
        // Ya no necesitamos currentUserRole
        const registerUser = new RegisterUser(userRepo);
        const newUser = await registerUser.execute(userData);
        res.status(201).json({ message: 'Usuario creado exitosamente', user: newUser });
    } catch (error) {

        res.status(400).json({ message: error.message });
    }
};
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;
        const forgotPassword = new ForgotPassword(userRepo);
        const result = await forgotPassword.execute(email);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.resetPassword = async (req, res) => {
    try {
        const { token, password } = req.body;
        const resetPassword = new ResetPassword(userRepo);
        const result = await resetPassword.execute(token, password);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};
// Obtener usuarios pendientes
exports.getPendingUsers = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const [users] = await pool.query(
            `SELECT id, name, document, email, phone, role, created_at 
             FROM users 
             WHERE status = 'pending' AND deleted_at IS NULL
             ORDER BY created_at DESC`
        );
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Aprobar usuario
exports.approveUser = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { userId } = req.params;
        await pool.query(
            `UPDATE users SET status = 'active' WHERE id = ?`,
            [userId]
        );
        res.json({ message: 'Usuario aprobado exitosamente' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Ver perfil propio
exports.getMe = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const [[user]] = await pool.query(
            `SELECT id, name, document, email, phone, role FROM users WHERE id = ? AND deleted_at IS NULL`,
            [req.user.id]
        );
        if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Actualizar perfil propio
exports.updateMe = async (req, res) => {
    try {
        const bcrypt = require('bcrypt');
        const pool = require('../../infrastructure/database/mysql');
        const { leerNombreDePeticion } = require('../../shared/personName');
        const { email, phone, currentPassword, newPassword } = req.body;

        // Apellidos y nombres por separado (acepta tambien el { name } antiguo).
        const nombre = leerNombreDePeticion(req.body);

        // Si quiere cambiar contraseña, verificar la actual
        if (newPassword) {
            const [[user]] = await pool.query(`SELECT password FROM users WHERE id = ?`, [req.user.id]);
            const valid = await bcrypt.compare(currentPassword || '', user.password);
            if (!valid) return res.status(400).json({ message: 'La contraseña actual es incorrecta' });
            const hashed = await bcrypt.hash(newPassword, 10);
            await pool.query(
                `UPDATE users SET last_name=?, first_name=?, email=?, phone=?, password=?
                 WHERE id=? AND deleted_at IS NULL`,
                [nombre.apellidos, nombre.nombres, email, phone || null, hashed, req.user.id]
            );
        } else {
            await pool.query(
                `UPDATE users SET last_name=?, first_name=?, email=?, phone=?
                 WHERE id=? AND deleted_at IS NULL`,
                [nombre.apellidos, nombre.nombres, email, phone || null, req.user.id]
            );
        }
        res.json({ message: 'Perfil actualizado correctamente' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Renovar token (refresh)
exports.refresh = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ message: 'Token no proporcionado' });
        const oldToken = authHeader.split(' ')[1];
        let payload;
        try {
            payload = jwt.verify(oldToken, process.env.JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') {
                payload = jwt.decode(oldToken);
                if (!payload || !payload.id || !payload.exp) {
                    return res.status(401).json({ message: 'Token inválido' });
                }
                // Solo se permite refrescar dentro de 1 hora después de expirar
                if (Date.now() / 1000 - payload.exp > 3600) {
                    return res.status(401).json({ message: 'Sesión expirada. Inicia sesión nuevamente.' });
                }
            } else {
                return res.status(401).json({ message: 'Token inválido' });
            }
        }
        const pool = require('../../infrastructure/database/mysql');
        const [[user]] = await pool.query(
            `SELECT id, name, email, role, status FROM users WHERE id = ? AND deleted_at IS NULL`,
            [payload.id]
        );
        if (!user || user.status !== 'active') return res.status(401).json({ message: 'Usuario inactivo' });
        const newToken = jwt.sign(
            { id: user.id, role: user.role, name: user.name, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '2h' }
        );
        res.json({ token: newToken, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Rechazar usuario (opcional)
exports.rejectUser = async (req, res) => {
    try {
        const pool = require('../../infrastructure/database/mysql');
        const { userId } = req.params;
        await pool.query(
            `UPDATE users SET status = 'rejected' WHERE id = ?`,
            [userId]
        );
        res.json({ message: 'Usuario rechazado' });
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};