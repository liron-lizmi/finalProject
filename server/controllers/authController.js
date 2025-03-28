// const User = require('../models/User');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const JWT_SECRET = process.env.JWT_SECRET;

// // Register a new user
// const register = async (req, res) => {
//   try {
//     const { firstName, lastName, email, password } = req.body;

//     // Check if user already exists
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים במערכת' });
//     }

//     // Create a new user
//     const user = new User({
//       firstName,
//       lastName,
//       email,
//       password
//     });

//     await user.save();

//     // Generate JWT token
//     const token = jwt.sign(
//       { userId: user._id },
//       JWT_SECRET,
//       { expiresIn: '1d' }
//     );

//     res.status(201).json({
//       token,
//       user: {
//         id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email
//       }
//     });
//   } catch (err) {
//     console.error('Register error:', err);
//     res.status(500).json({ message: 'שגיאת שרת' });
//   }
// };

// // Login user
// const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Check if user exists
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
//     }

//     // Check if password is correct
//     const isMatch = await user.comparePassword(password);
//     if (!isMatch) {
//       return res.status(400).json({ message: 'שם משתמש או סיסמה שגויים' });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       { userId: user._id },
//       JWT_SECRET,
//       { expiresIn: '1d' }
//     );

//     res.json({
//       token,
//       user: {
//         id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         email: user.email
//       }
//     });
//   } catch (err) {
//     console.error('Login error:', err);
//     res.status(500).json({ message: 'שגיאת שרת' });
//   }
// };

// // Get current user
// const getCurrentUser = async (req, res) => {
//   try {
//     const user = await User.findById(req.userId).select('-password');
//     if (!user) {
//       return res.status(404).json({ message: 'משתמש לא נמצא' });
//     }
//     res.json(user);
//   } catch (err) {
//     console.error('Get user error:', err);
//     res.status(500).json({ message: 'שגיאת שרת' });
//   }
// };

// const forgotPassword = async (req, res) => {
//   let user = null;
  
//   try {
//     const { email } = req.body;

//     user = await User.findOne({ email });
//     if (!user) {
//       return res.status(404).json({ message: 'לא נמצא משתמש עם אימייל זה' });
//     }

//     const resetToken = crypto.randomBytes(20).toString('hex');
    
//     user.resetPasswordToken = crypto
//       .createHash('sha256')
//       .update(resetToken)
//       .digest('hex');
      
//     user.resetPasswordExpires = Date.now() + 10 * 60 * 1000;
    
//     await user.save();

//     const resetURL = `${req.protocol}://${req.get('host')}/reset-password/${resetToken}`;
//     console.log('Reset URL (Dev Only):', resetURL);
    
//     res.status(200).json({
//       message: 'קישור לאיפוס סיסמה נשלח לאימייל שלך',
//       resetToken: resetToken 
//     });
    
//   } catch (err) {
//     console.error('Forgot password error:', err);
    
//     if (user) {
//       user.resetPasswordToken = undefined;
//       user.resetPasswordExpires = undefined;
//       await user.save();
//     }
    
//     res.status(500).json({ message: 'אירעה שגיאה בתהליך איפוס הסיסמה' });
//   }
// };

// const resetPassword = async (req, res) => {
//   try {
//     const { token: resetTokenParam } = req.params;
//     const { password } = req.body;
    
//     const resetPasswordToken = crypto
//       .createHash('sha256')
//       .update(resetTokenParam)
//       .digest('hex');
      
//     const user = await User.findOne({
//       resetPasswordToken,
//       resetPasswordExpires: { $gt: Date.now() }
//     });
    
//     if (!user) {
//       return res.status(400).json({ 
//         message: 'הטוקן אינו תקף או שפג תוקפו',
//         code: 'INVALID_TOKEN' 
//       });
//     }
    
//     // בדיקה שהסיסמה החדשה שונה מהסיסמה הנוכחית
//     const isSamePassword = await user.comparePassword(password);
//     if (isSamePassword) {
//       return res.status(400).json({ 
//         message: 'לא ניתן לאפס את הסיסמה לסיסמה הנוכחית. אנא בחר סיסמה חדשה',
//         code: 'SAME_PASSWORD'
//       });
//     }
    
//     user.password = password;
    
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
    
//     await user.save();
    
//     const token = jwt.sign(
//       { userId: user._id },
//       JWT_SECRET,
//       { expiresIn: '1d' }
//     );
    
//     res.status(200).json({
//       message: 'הסיסמה עודכנה בהצלחה',
//       token
//     });
    
//   } catch (err) {
//     console.error('Reset password error:', err);
//     res.status(500).json({ 
//       message: 'אירעה שגיאה בתהליך איפוס הסיסמה',
//       code: 'SERVER_ERROR'
//     });
//   }
// };

// module.exports = {
//   register,
//   login,
//   getCurrentUser,
//   forgotPassword,
//   resetPassword
// };

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET;

// Register a new user
const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'משתמש עם אימייל זה כבר קיים במערכת' });
    }

    // Create a new user
    const user = new User({
      firstName,
      lastName,
      email,
      password
    });

    await user.save();

    // Generate JWT token
    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    // שליחת אימייל אישור רישום
    try {
      // נשלח מידע על האימייל לצורך שליחה בצד הקליינט
      const emailData = {
        recipientEmail: email,
        recipientName: `${firstName} ${lastName}`,
        userToken: token,
        emailType: 'registration' // מזהה לצורך טיפול בלוגיקת האימייל בצד הקליינט
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

// Get current user
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

module.exports = {
  register,
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword
};