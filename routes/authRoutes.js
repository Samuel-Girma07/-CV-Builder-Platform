const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);
router.put('/details', authLimiter, authMiddleware, authController.updateDetails);
router.put('/password', authLimiter, authMiddleware, authController.updatePassword);
router.delete('/me', authLimiter, authMiddleware, authController.deleteAccount);

module.exports = router;
