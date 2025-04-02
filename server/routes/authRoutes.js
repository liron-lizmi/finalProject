// routes/auth.js
const express = require('express');
const router = express.Router();
const { 
  register, 
  login, 
  getCurrentUser,
  forgotPassword,
  resetPassword,
  checkUserExists,
  registerOAuth,
  loginOAuth
} = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const auth = require('../middleware/auth');

// Register route with validation
router.post('/register', validateRegistration, register);

// Login route with validation
router.post('/login', validateLogin, login);

// Get current user route (protected)
router.get('/userID', auth, getCurrentUser);

// Forgot password route
router.post('/forgot-password', forgotPassword);

// Reset password route
router.post('/reset-password/:token', resetPassword);

// Check if user exists route
router.post('/check-user-exists', checkUserExists);

router.post('/register-oauth', registerOAuth);

router.post('/login-oauth', loginOAuth);

module.exports = router;