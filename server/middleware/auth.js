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
    return res.status(401).json({ message: req.t ? req.t('auth.noToken') : 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (err) {
    res.status(401).json({ message: req.t ? req.t('auth.invalidToken') : 'Invalid token' });
  }
};