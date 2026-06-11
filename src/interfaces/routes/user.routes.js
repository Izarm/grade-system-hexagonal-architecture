const express = require('express');
const router = express.Router();
const controller = require('../controllers/user.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate, authorize(['admin']));
router.get('/', controller.list);
router.get('/teachers', controller.listTeachers);
router.post('/register', controller.registerByAdmin);
router.put('/:id', controller.updateTeacher);
router.delete('/:id', controller.deleteTeacher);

module.exports = router;