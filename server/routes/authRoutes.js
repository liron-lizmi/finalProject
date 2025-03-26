const express = require('express');
const router = express.Router();
const { register, login, getCurrentUser } = require('../controllers/authController');
const { validateRegistration, validateLogin } = require('../middleware/validation');
const auth = require('../middleware/auth');

// Register route
router.post('/register', register);

// Login route
router.post('/login', login);

// Get current user route (protected)
router.get('/userID', auth, getCurrentUser);

module.exports = router;