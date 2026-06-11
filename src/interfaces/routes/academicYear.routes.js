const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middlewares/auth.middleware');
const academicYearController = require('../controllers/academicYear.controller');

router.get('/', authenticate, academicYearController.list);
router.get('/paginated', authenticate, academicYearController.listPaginated);
router.get('/active', authenticate, academicYearController.getActive);
router.get('/active/current', authenticate, academicYearController.getActive);
router.get('/:id', authenticate, academicYearController.getById);
router.post('/', authenticate, authorize(['admin']), academicYearController.create);
router.put('/:id', authenticate, authorize(['admin']), academicYearController.update);
router.delete('/:id', authenticate, authorize(['admin']), academicYearController.delete);
router.post('/:id/close', authenticate, authorize(['admin']), academicYearController.closeYear);
router.post('/:id/reopen', authenticate, authorize(['admin']), academicYearController.reopenYear);

module.exports = router;