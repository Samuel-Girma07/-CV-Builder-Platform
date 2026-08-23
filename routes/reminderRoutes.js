const express = require('express');
const router = express.Router();
const reminderController = require('../controllers/reminderController');
const authMiddleware = require('../middlewares/authMiddleware');

router.use(authMiddleware);

router.post('/:id/dismiss', reminderController.dismiss);

module.exports = router;
