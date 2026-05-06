const express = require('express');
const router = express.Router();
const controller = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate, authorize(['admin']));
router.get('/', controller.list);

module.exports = router;