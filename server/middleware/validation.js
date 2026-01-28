/**
 * validation.js - Request Validation Middleware
 *
 * Validates request body for registration and login.
 *
 * Functions:
 * - validateRegistration: Validates name (at least one required), email format,
 *   password length (6-30) and complexity (uppercase, lowercase, digit).
 * - validateLogin: Validates email and password presence.
 *
 * Returns 400 with comma-separated error messages on failure.
 */

const validateRegistration = (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  const errors = [];

  // *** עדכון: לפחות שם פרטי או משפחה נדרש, לא חובה שניהם ***
  if (!firstName && !lastName) {
    errors.push(req.t('validation.nameRequired') || 'Either first name or last name is required');
  }

  // בדיקת אורך שמות (אם קיימים)
  if (firstName && firstName.length < 2) {
    errors.push(req.t('validation.firstNameMin'));
  } else if (firstName && firstName.length > 50) {
    errors.push(req.t('validation.firstNameMax'));
  }

  if (lastName && lastName.length < 2) {
    errors.push(req.t('validation.lastNameMin'));
  } else if (lastName && lastName.length > 50) {
    errors.push(req.t('validation.lastNameMax'));
  }

  if (!email) {
    errors.push(req.t('validation.emailRequired'));
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push(req.t('validation.emailInvalid'));
    }
  }

  if (!password) {
    errors.push(req.t('validation.passwordRequired'));
  } else if (password.length < 6) {
    errors.push(req.t('validation.passwordMin'));
  } else if (password.length > 30) {
    errors.push(req.t('validation.passwordMax'));
  } else {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z\d]/;
    if (!passwordRegex.test(password)) {
      errors.push(req.t('validation.passwordComplexity'));
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(', ') });
  }

  next();
};

const validateLogin = (req, res, next) => {
  const { email, password } = req.body;
  const errors = [];

  if (!email) {
    errors.push(req.t('validation.emailRequired'));
  }

  if (!password) {
    errors.push(req.t('validation.passwordRequired'));
  }

  if (errors.length > 0) {
    return res.status(400).json({ message: errors.join(', ') });
  }

  next();
};

module.exports = {
  validateRegistration,
  validateLogin
};