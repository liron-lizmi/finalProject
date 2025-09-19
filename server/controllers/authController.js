// server/controllers/authController.js
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
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    console.log(`Checking if user exists for email: ${email}, found: ${!!user}`);
    return res.json({ exists: !!user });
  } catch (err) {
    console.error('Check user exists error:', err);
    res.status(500).json({ message: req.t('errors.serverError'), exists: false });
  }
};

const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({ message: req.t('errors.userExists') });
    }

    const user = new User({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.toLowerCase().trim(),
      password
    });

    await user.save();
    console.log('New user registered:', user.email);

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

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(400).json({ message: req.t('errors.invalidCredentials') });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: req.t('errors.invalidCredentials') });
    }

    console.log('User logged in successfully:', user.email);

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

    user = await User.findOne({ email: email.toLowerCase().trim() });
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
    
    console.log('OAuth Register request received:', { 
      email, 
      firstName, 
      lastName, 
      provider, 
      providerId 
    });

    if (!email || !firstName || !providerId) {
      console.error('Missing required OAuth data:', { email, firstName, providerId });
      return res.status(400).json({ 
        message: req.t('errors.incompleteOAuthData') || 'Missing required data for OAuth registration'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    console.log('Searching for existing user with email:', normalizedEmail, 'and providerId:', providerId);
    
    let existingUser = await User.findOne({ 
      'oauth.provider': provider,
      'oauth.providerId': providerId 
    });
    
    if (!existingUser) {
      existingUser = await User.findOne({ email: normalizedEmail });
      
      if (existingUser && existingUser.oauth && existingUser.oauth.providerId && existingUser.oauth.providerId !== providerId) {
        console.error('Email exists but with different OAuth ID:', {
          existingProviderId: existingUser.oauth.providerId,
          newProviderId: providerId
        });
        return res.status(400).json({ 
          message: req.t('errors.emailExistsWithDifferentProvider') || 'Email already exists with different OAuth account'
        });
      }
    }
    
    if (existingUser) {
      console.log('Existing user found, updating OAuth info if needed:', {
        id: existingUser._id,
        email: existingUser.email,
        currentProviderId: existingUser.oauth?.providerId,
        newProviderId: providerId
      });
      
      if (!existingUser.oauth || existingUser.oauth.providerId !== providerId) {
        existingUser.oauth = {
          provider,
          providerId
        };
        await existingUser.save();
        console.log('Updated existing user with OAuth info');
      }
      
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
          name: `${existingUser.firstName} ${existingUser.lastName}`.trim()
        }
      });
    }

    const randomPassword = crypto.randomBytes(32).toString('hex');

    let userFirstName = firstName?.trim() || '';
    let userLastName = lastName?.trim() || '';
    
    if (!userFirstName && !userLastName) {
      const emailParts = normalizedEmail.split('@')[0].split('.');
      userFirstName = emailParts[0] || 'User';
      userLastName = emailParts[1] || '';
    }
    
    if (!userFirstName && userLastName) {
      userFirstName = userLastName;
      userLastName = '';
    }

    const user = new User({
      firstName: userFirstName,
      lastName: userLastName,
      email: normalizedEmail,
      password: randomPassword,
      oauth: {
        provider,
        providerId 
      }
    });

    await user.save();
    console.log('New OAuth user created successfully:', {
      id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      providerId: user.oauth.providerId
    });

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
        name: `${user.firstName} ${user.lastName}`.trim()
      }
    });
  } catch (err) {
    console.error('OAuth Register error:', err);
    
    if (err.code === 11000) {
      try {
        const { email, providerId } = req.body;
        
        let user = await User.findOne({ 
          'oauth.provider': 'google',
          'oauth.providerId': providerId 
        });
        
        if (!user && email) {
          user = await User.findOne({ email: email.toLowerCase().trim() });
        }
        
        if (user) {
          console.log('Duplicate key error, returning existing user:', {
            email: user.email,
            providerId: user.oauth?.providerId
          });
          
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
              name: `${user.firstName} ${user.lastName}`.trim()
            }
          });
        }
      } catch (findError) {
        console.error('Error finding existing user during duplicate handling:', findError);
      }
    }
    
    res.status(500).json({ 
      message: req.t('errors.serverError') || 'Server error occurred during OAuth registration'
    });
  }
};

const loginOAuth = async (req, res) => {
  try {
    const { email, provider, providerId } = req.body;
    
    console.log('OAuth Login request received:', { email, provider, providerId });

    if (!email || !providerId) {
      return res.status(400).json({ 
        message: req.t('errors.missingOAuthData') || 'Email and provider ID are required'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('Searching for user with providerId:', providerId, 'and email:', normalizedEmail);
    
    let user = await User.findOne({ 
      'oauth.provider': provider,
      'oauth.providerId': providerId 
    });
    
    if (!user) {
      user = await User.findOne({ email: normalizedEmail });
      
      if (user) {
        if (!user.oauth || !user.oauth.providerId) {
          user.oauth = {
            provider,
            providerId
          };
          await user.save();
          console.log('Updated existing user with OAuth info');
        } else if (user.oauth.providerId !== providerId) {
          console.error('User found with same email but different OAuth ID:', {
            existingProviderId: user.oauth.providerId,
            newProviderId: providerId
          });
          return res.status(404).json({ 
            message: req.t('errors.userNotFound') || 'User not found'
          });
        }
      }
    }
    
    if (!user) {
      console.log('User not found for OAuth login with providerId:', providerId);
      return res.status(404).json({ 
        message: req.t('errors.userNotFound') || 'User not found'
      });
    }

    console.log('OAuth login successful for user:', {
      id: user._id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      providerId: user.oauth?.providerId
    });

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
        name: `${user.firstName} ${user.lastName}`.trim()
      }
    });
  } catch (err) {
    console.error('OAuth Login error:', err);
    res.status(500).json({ 
      message: req.t('errors.serverError') || 'Server error occurred during OAuth login'
    });
  }
};

/**
 * Get user notifications
 */
const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('notifications.sharedBy', 'firstName lastName')
      .populate('notifications.eventId', 'title');
    
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    
    const unreadNotifications = user.notifications.filter(n => !n.read);
    res.json(unreadNotifications);
  } catch (err) {
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Mark notification as read
 */
const markNotificationAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    
    const notification = user.notifications.id(notificationId);
    if (notification) {
      notification.read = true;
      await user.save();
      res.json({ message: 'Notification marked as read', success: true });
    } else {
      res.status(404).json({ message: 'Notification not found' });
    }
  } catch (err) {
    console.error('Error marking notification as read:', err);
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
  loginOAuth,
  getNotifications,
  markNotificationAsRead
};