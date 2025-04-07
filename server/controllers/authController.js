const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET;

const checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: 'נדרש אימייל', exists: false });
    }
    
    const user = await User.findOne({ email });
    return res.json({ exists: !!user });
  } catch (err) {
    console.error('Check user exists error:', err);
    res.status(500).json({ message: 'שגיאת שרת', exists: false });
  }
};

// Register a new user
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים במערכת' });
    }

    const user = new User({
      firstName,
      lastName,
      email,
      password
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    try {
      const emailData = {
        recipientEmail: email,
        recipientName: `${firstName} ${lastName}`,
        userToken: token,
        emailType: 'registration'
      };

      res.status(201).json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        emailData // שליחת המידע הדרוש לשליחת אימייל
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // ממשיכים למרות שגיאה בשליחת האימייל - הרישום הושלם בהצלחה
      res.status(201).json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        emailError: 'אירעה שגיאה בשליחת אימייל אישור, אך הרישום הושלם בהצלחה'
      });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא נמצא' });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const forgotPassword = async (req, res) => {
  let user = null;
  
  try {
    const { email } = req.body;

    user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'לא נמצא משתמש עם אימייל זה' });
    }

    const resetToken = crypto.randomBytes(20).toString('hex');
    
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');
      
    user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    
    await user.save();

    const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
    console.log('Reset URL (Dev Only):', resetURL);
    
    // מידע לשליחת אימייל
    const emailData = {
      recipientEmail: email,
      recipientName: user.firstName ? `${user.firstName} ${user.lastName}` : email,
      resetToken: resetToken,
      resetURL: resetURL,
      emailType: 'passwordReset'
    };
    
    res.status(200).json({
      message: 'קישור לאיפוס סיסמה נשלח לאימייל שלך',
      resetToken: resetToken,
      emailData
    });
    
  } catch (err) {
    console.error('Forgot password error:', err);
    
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
    }
    
    res.status(500).json({ message: 'אירעה שגיאה בתהליך איפוס הסיסמה' });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token: resetTokenParam } = req.params;
    const { password } = req.body;
    
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetTokenParam)
      .digest('hex');
      
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpires: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({ 
        message: 'הטוקן אינו תקף או שפג תוקפו',
        code: 'INVALID_TOKEN' 
      });
    }
    
    // בדיקה שהסיסמה החדשה שונה מהסיסמה הנוכחית
    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: 'לא ניתן לאפס את הסיסמה לסיסמה הנוכחית. אנא בחר סיסמה חדשה',
        code: 'SAME_PASSWORD'
      });
    }
    
    user.password = password;
    
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    
    await user.save();
    
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );
    
    res.status(200).json({
      message: 'הסיסמה עודכנה בהצלחה',
      token
    });
    
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ 
      message: 'אירעה שגיאה בתהליך איפוס הסיסמה',
      code: 'SERVER_ERROR'
    });
  }
};

// רישום משתמש מ-OAuth (גוגל)
// רישום משתמש מ-OAuth (גוגל)
const registerOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, provider, providerId } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // המשתמש כבר קיים, נחזיר נתונים עליו
      const token = jwt.sign(
        { userId: existingUser._id },
        JWT_SECRET,
        { expiresIn: '1d' }
      );

      return res.status(200).json({
        token,
        user: {
          id: existingUser._id,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          email: existingUser.email,
          name: `${existingUser.firstName} ${existingUser.lastName}`
        }
      });
    }

    // יוצר סיסמה רנדומלית ארוכה לחשבון מגוגל (לא ישתמשו בה בפועל)
    const randomPassword = crypto.randomBytes(32).toString('hex');

    // Create a new user
    const user = new User({
      firstName,
      lastName,
      email,
      password: randomPassword,
      oauth: {
        provider,
        providerId
      }
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.status(201).json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      }
    });
  } catch (err) {
    console.error('OAuth Register error:', err);
    
    // Check if this is a duplicate key error
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
      // Try to get the existing user and return their info instead
      try {
        const email = err.keyValue.email;
        const user = await User.findOne({ email });
        
        if (user) {
          const token = jwt.sign(
            { userId: user._id },
            JWT_SECRET,
            { expiresIn: '1d' }
          );
          
          return res.status(200).json({
            token,
            user: {
              id: user._id,
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              name: `${user.firstName} ${user.lastName}`
            }
          });
        }
      } catch (findError) {
        console.error('Error finding existing user:', findError);
      }
    }
    
    res.status(500).json({ message: 'שגיאת שרת בתהליך ההרשמה' });
  }
};

// התחברות משתמש מ-OAuth (גוגל)
const loginOAuth = async (req, res) => {
  try {
    const { email, provider, providerId } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'משתמש לא קיים במערכת' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      token,
      user: {
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`
      }
    });
  } catch (err) {
    console.error('OAuth Login error:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
  checkUserExists,
  registerOAuth,
  loginOAuth
};
