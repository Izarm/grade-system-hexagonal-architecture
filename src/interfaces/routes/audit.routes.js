const express = require('express');
const router = express.Router();
const controller = require('../controllers/audit.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);
router.get('/', authorize(['admin']), controller.list);

module.exports = router;
