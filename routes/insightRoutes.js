const express = require('express');
const router = express.Router();
const insightController = require('../controllers/insightController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.get('/skill-gaps', insightController.getSkillGaps);

module.exports = router;
