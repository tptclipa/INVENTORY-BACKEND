const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  adminLogin, 
  getMe, 
  logout,
  verifyEmail,
  resendVerification,
  forgotPassword,
  verifyResetCode,
  resetPassword
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Authentication routes
router.post('/register', register);
router.post('/login', login);
router.post('/admin-login', adminLogin);
router.post('/logout', protect, logout);
router.get('/me', protect, getMe);

// Email verification routes
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);

// Password reset routes
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-code', verifyResetCode);
router.post('/reset-password', resetPassword);

module.exports = router;
