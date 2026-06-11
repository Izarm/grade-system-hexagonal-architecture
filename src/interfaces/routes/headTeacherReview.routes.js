const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const reviewController = require('../controllers/headTeacherReview.controller');

router.get('/', authenticate, reviewController.getReviews);
router.post('/', authenticate, authorize(['docente']), reviewController.saveReview);

module.exports = router;