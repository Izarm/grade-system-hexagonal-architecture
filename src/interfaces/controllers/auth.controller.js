const LoginUser = require('../../application/use-cases/LoginUser');
const MySQLUserRepository = require('../../infrastructure/repositories/MySQLUserRepository');

const userRepo = new MySQLUserRepository();
const loginUser = new LoginUser(userRepo);

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const result = await loginUser.execute(email, password);
        res.json(result);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};