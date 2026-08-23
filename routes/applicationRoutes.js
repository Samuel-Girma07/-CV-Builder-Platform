const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const applicationController = require('../controllers/applicationController');
const { aiLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// Registered before authMiddleware: the SSE reader cannot send Authorization
// headers, so this endpoint authenticates with a 60s single-purpose ticket
// issued by POST /:id/cover-letter/stream-ticket instead.
router.get('/:id/cover-letter/stream', applicationController.streamCoverLetter);

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
router.post('/:id/cover-letter/stream-ticket', aiLimiter, applicationController.issueCoverLetterStreamTicket);
router.get('/:id/cover-letter.pdf', applicationController.getCoverLetterPdf);
router.post('/:id/tailor-cv', aiLimiter, applicationController.tailorCv);
router.get('/:id/tailored-cv.pdf', applicationController.downloadTailoredCvPdf);
router.post('/:id/interview-prep', aiLimiter, applicationController.generateInterviewPrep);
const interviewController = require('../controllers/interviewController');

router.get('/:appId/interviews', interviewController.getByApplication);
router.post('/:appId/interviews', interviewController.create);

const reminderController = require('../controllers/reminderController');
router.get('/:id/reminders', reminderController.listForApplication);
router.post('/:id/reminders', reminderController.create);

const logController = require('../controllers/logController');
router.get('/:id/contacts', logController.listContacts);
router.post('/:id/contacts', logController.addContact);
router.delete('/:id/contacts/:entryId', logController.deleteContact);
router.get('/:id/activities', logController.listActivities);
router.post('/:id/activities', logController.addActivity);
router.delete('/:id/activities/:entryId', logController.deleteActivity);

module.exports = router;
