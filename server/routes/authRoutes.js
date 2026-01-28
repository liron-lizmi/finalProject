/**
 * authRoutes.js - Authentication Routes
 *
 * Handles all authentication-related endpoints for user registration,
 * login, password management, and OAuth authentication.
 *
 * Public Routes:
 * - POST /register: User registration with validation
 * - POST /login: User login with validation
 * - POST /forgot-password: Request password reset email
 * - POST /reset-password/:token: Reset password with token
 * - POST /check-user-exists: Check if email is registered
 * - POST /register-oauth: Register via OAuth (Google)
 * - POST /login-oauth: Login via OAuth (Google)
 *
 * Protected Routes (requires auth middleware):
 * - GET /userID: Get current authenticated user's data
 *
 * Middleware:
 * - validateRegistration: Validates registration input
 * - validateLogin: Validates login input
 * - auth: JWT authentication for protected routes
 */

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