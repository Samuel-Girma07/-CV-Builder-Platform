const express = require('express');
const authController = require('../controllers/authController');
const authMiddleware = require('../middlewares/authMiddleware');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/me', authMiddleware, authController.me);
router.put('/details', authLimiter, authMiddleware, authController.updateDetails);
router.post('/update-password', authLimiter, authMiddleware, authController.updatePassword);
router.delete('/me', authLimiter, authMiddleware, authController.deleteAccount);
router.post('/forgot-password', authLimiter, authController.forgotPassword);
router.post('/reset-password', authLimiter, authController.resetPassword);
router.post('/temp-password', authLimiter, authController.issueTempPassword);


module.exports = router;
