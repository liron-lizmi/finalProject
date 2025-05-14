const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET;

const checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: req.t('errors.emailRequired'), exists: false });
    }
    
    const user = await User.findOne({ email });
    return res.json({ exists: !!user });
  } catch (err) {
    console.error('Check user exists error:', err);
    res.status(500).json({ message: req.t('errors.serverError'), exists: false });
  }
};

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: req.t('errors.userExists') });
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
        emailData 
      });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      res.status(201).json({
        token,
        user: {
          id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email
        },
        emailError: req.t('email.sendError')
      });
    }
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: req.t('errors.invalidCredentials') });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: req.t('errors.invalidCredentials') });
    }

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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    res.json(user);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const forgotPassword = async (req, res) => {
  let user = null;
  
  try {
    const { email } = req.body;

    user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: req.t('errors.emailNotFound') });
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
    
    const emailData = {
      recipientEmail: email,
      recipientName: user.firstName ? `${user.firstName} ${user.lastName}` : email,
      resetToken: resetToken,
      resetURL: resetURL,
      emailType: 'passwordReset'
    };
    
    res.status(200).json({
      message: req.t('success.resetLinkSent'),
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
    
    res.status(500).json({ message: req.t('errors.resetError') });
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
        message: req.t('errors.resetTokenInvalid'),
        code: 'INVALID_TOKEN' 
      });
    }
    
    const isSamePassword = await user.comparePassword(password);
    if (isSamePassword) {
      return res.status(400).json({ 
        message: req.t('errors.samePassword'),
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
      message: req.t('success.passwordReset'),
      token
    });
    
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ 
      message: req.t('errors.resetError'),
      code: 'SERVER_ERROR'
    });
  }
};

const registerOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, provider, providerId } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
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

    const randomPassword = crypto.randomBytes(32).toString('hex');

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
    
    if (err.code === 11000 && err.keyPattern && err.keyPattern.email) {
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
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const loginOAuth = async (req, res) => {
  try {
    const { email, provider, providerId } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

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
    res.status(500).json({ message: req.t('errors.serverError') });
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