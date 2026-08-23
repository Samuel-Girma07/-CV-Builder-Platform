const express = require('express');
const router = express.Router();
const mockInterviewController = require('../controllers/mockInterviewController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/:appId/start', mockInterviewController.start);
router.get('/:appId', mockInterviewController.listByApplication);
router.get('/session/:sessionId', mockInterviewController.detail);
router.post('/session/:sessionId/answer', mockInterviewController.answer);

module.exports = router;
