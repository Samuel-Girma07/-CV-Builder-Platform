const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const interviewController = require('../controllers/interviewController');

const router = express.Router();

router.use(authMiddleware);

router.post('/check-conflict', interviewController.checkConflict);
router.get('/:id/ics', interviewController.getIcs);

module.exports = router;
