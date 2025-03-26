const validateRegistration = (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  const errors = [];

  if (!firstName) {
    errors.push('שם פרטי הוא שדה חובה');
  } else if (firstName.length < 2) {
    errors.push('שם פרטי חייב להכיל לפחות 2 תווים');
  } else if (firstName.length > 50) {
    errors.push('שם פרטי לא יכול להכיל יותר מ-50 תווים');
  }

  if (!lastName) {
    errors.push('שם משפחה הוא שדה חובה');
  } else if (lastName.length < 2) {
    errors.push('שם משפחה חייב להכיל לפחות 2 תווים');
  } else if (lastName.length > 50) {
    errors.push('שם משפחה לא יכול להכיל יותר מ-50 תווים');
  }

  if (!email) {
    errors.push('אימייל הוא שדה חובה');
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      errors.push('נא להזין כתובת אימייל תקינה');
    }
  }

  if (!password) {
    errors.push('סיסמה היא שדה חובה');
  } else if (password.length < 6) {
    errors.push('הסיסמה צריכה להכיל לפחות 6 תווים');
  } else if (password.length > 30) {
    errors.push('הסיסמה לא יכולה להכיל יותר מ-30 תווים');
  } else {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/;
    if (!passwordRegex.test(password)) {
      errors.push('הסיסמה חייבת להכיל אות גדולה, אות קטנה ומספר ');
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
    errors.push('אימייל הוא שדה חובה');
  }

  if (!password) {
    errors.push('סיסמה היא שדה חובה');
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