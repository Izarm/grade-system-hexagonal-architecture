const express = require('express');
const router = express.Router();
const controller = require('../controllers/grade.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate);

router.get('/', authorize(['admin', 'docente']), controller.list);
router.get('/:id', authorize(['admin', 'docente']), controller.getById);
router.post('/', authorize(['admin']), controller.create);
router.put('/:id', authorize(['admin']), controller.update);
router.delete('/:id', authorize(['admin']), controller.delete);
router.put('/:id/head-teacher', authorize(['admin']), controller.assignHeadTeacher);
router.get('/head-teacher/report', authenticate, authorize(['docente']), controller.getHeadTeacherReport);

module.exports = router;