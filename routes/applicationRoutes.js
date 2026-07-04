const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const applicationController = require('../controllers/applicationController');
const { aiLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.use(authMiddleware);

router.get('/stats', applicationController.getStats);
router.get('/table-preferences', applicationController.getTablePreferences);
router.put('/table-preferences', applicationController.updateTablePreferences);
router.get('/', applicationController.getList);
router.post('/', aiLimiter, applicationController.create);
router.patch('/bulk', applicationController.bulkAction);
router.get('/:id', applicationController.getOne);
router.patch('/:id', applicationController.updatePartial);
router.delete('/:id', applicationController.delete);
router.post('/:id/cover-letter', aiLimiter, applicationController.generateCoverLetter);
router.get('/:id/cover-letter.pdf', applicationController.getCoverLetterPdf);
router.post('/:id/tailor-cv', aiLimiter, applicationController.tailorCv);
router.get('/:id/tailored-cv.pdf', applicationController.downloadTailoredCvPdf);
router.post('/:id/interview-prep', aiLimiter, applicationController.generateInterviewPrep);
const interviewController = require('../controllers/interviewController');

router.get('/:appId/interviews', interviewController.getByApplication);
router.post('/:appId/interviews', interviewController.create);

module.exports = router;
