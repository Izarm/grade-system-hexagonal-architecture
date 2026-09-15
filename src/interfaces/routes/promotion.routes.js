const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const ctrl = require('../controllers/promotion.controller');

router.use(authenticate, authorize(['admin']));

// Clasificación de estudiantes
router.get('/history/:yearId',  ctrl.getHistory);
router.get('/:yearId',          ctrl.getStudentsForPromotion);
router.put('/status',           ctrl.updateStatus);
router.post('/execute',         ctrl.execute);

module.exports = router;
