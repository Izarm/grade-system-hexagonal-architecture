const express = require('express');
const router = express.Router();
const controller = require('../controllers/grade.controller');
const { authenticate, authorize } = require('../middlewares/auth.middleware');

router.use(authenticate, authorize(['admin']));

router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);
router.get('/', controller.list);
router.get('/:id', controller.getById);

module.exports = router;