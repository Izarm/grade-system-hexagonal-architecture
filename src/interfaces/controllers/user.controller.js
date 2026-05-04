const MySQLUserRepository = require('../../infrastructure/repositories/MySQLUserRepository');
const repo = new MySQLUserRepository();

exports.list = async (req, res) => {
    try {
        const users = await repo.findAll();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};