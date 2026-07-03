const express = require('express');
const authMiddleware = require('../middlewares/authMiddleware');
const profileController = require('../controllers/profileController');
const { aiLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.use(authMiddleware);

router.get('/', profileController.getProfile);
router.put('/', profileController.saveProfile);
router.post('/upload', aiLimiter, profileController.upload.single('cvFile'), profileController.uploadProfile);
router.post('/summary', aiLimiter, profileController.generateSummary);
router.post('/lint', profileController.lintProfile);
router.put('/skill-levels', profileController.saveSkillLevels);
router.get('/cv.pdf', profileController.getCvPdf);

module.exports = router;
