const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/authMiddleware');
const xrayController = require('../controllers/xrayController');
const { createCvUpload } = require('../config/upload');

const upload = createCvUpload();

// Registered before router.use(authMiddleware): the <iframe> preview cannot
// send Authorization headers, so this endpoint authenticates with a 60s
// single-purpose ticket issued by POST /:id/pdf-ticket instead.
router.get('/:id/pdf', xrayController.getPdf);

router.use(authMiddleware);

router.post('/upload', upload.single('cvFile'), xrayController.uploadXray);
router.post('/:id/pdf-ticket', xrayController.issuePdfTicket);
router.get('/', xrayController.listVersions);
router.delete('/:id', xrayController.deleteVersion);

module.exports = router;
