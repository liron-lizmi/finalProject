/**
 * auth.js - Authentication Middleware
 *
 * Verifies JWT token from request headers and extracts userId.
 * Supports both 'x-auth-token' header and 'Authorization: Bearer <token>' format.
 *
 * On success: Sets req.userId and calls next()
 * On failure: Returns 401 with error message
 */

const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  let token = req.header('x-auth-token');
  
  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '');
    }
  }

  if (!token) {
    return res.status(401).json({ message: req.t('auth.noToken') });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: req.t('auth.invalidToken') });
  }
};