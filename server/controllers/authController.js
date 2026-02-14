/**
 * authController.js
 *
 * Controller for user authentication and account management.
 * Handles registration, login, password reset, OAuth authentication,
 * and user notifications.
 *
 * Main features:
 * - User registration (email/password and OAuth)
 * - Login (email/password and OAuth)
 * - Password reset flow with secure tokens
 * - JWT token generation and validation
 * - User notifications management
 */

const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Checks if a user exists by email address.
 * @route POST /api/auth/check-user
 */
const checkUserExists = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ message: req.t('errors.emailRequired'), exists: false });
    }
    
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    return res.json({ exists: !!user });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError'), exists: false });
  }
};

/**
 * Registers a new user with email and password.
 * Creates user, generates JWT token (1 day expiry), and returns email data for welcome email.
 * @route POST /api/auth/register
 */
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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Authenticates user with email and password.
 * Returns JWT token (1 day expiry) and user info on success.
 * @route POST /api/auth/login
 */
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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Returns current authenticated user's profile (without password).
 * @route GET /api/auth/me
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Initiates password reset flow.
 * Generates a secure reset token (SHA256 hashed), stores it with 10-minute expiry.
 * Returns token and email data for sending reset email.
 * @route POST /api/auth/forgot-password
 */
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
    
    if (user) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
    }
    
    res.status(500).json({ message: req.t('errors.resetError') });
  }
};

/**
 * Completes password reset using the token from email link.
 * Validates token hasn't expired, ensures new password differs from old.
 * Clears reset token and returns new JWT for auto-login.
 * @route POST /api/auth/reset-password/:token
 */
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
    res.status(500).json({ 
      message: req.t('errors.resetError'),
      code: 'SERVER_ERROR'
    });
  }
};

/**
 * Registers or links a user via OAuth provider (e.g., Google).
 * If user exists by email, updates OAuth info. Otherwise creates new user.
 * Handles race conditions with duplicate key errors.
 * @route POST /api/auth/oauth/register
 */
const registerOAuth = async (req, res) => {
  try {
    const { email, firstName, lastName, provider, providerId } = req.body;

    if (!email || !firstName) {
      return res.status(400).json({
        message: req.t('errors.incompleteOAuthData')
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists by email (primary identification)
    let existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      // User exists - update OAuth info and return token
      if (!existingUser.oauth || existingUser.oauth.providerId !== providerId) {
        existingUser.oauth = {
          provider,
          providerId
        };
        await existingUser.save();
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

    // User doesn't exist - create new user
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
    // Handle duplicate key error (race condition)
    if (err.code === 11000) {
      try {
        const { email, providerId, provider } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        let user = await User.findOne({ email: normalizedEmail });

        if (user) {
          // Update OAuth info
          if (!user.oauth || user.oauth.providerId !== providerId) {
            user.oauth = {
              provider,
              providerId
            };
            await user.save();
          }

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
        // Error finding existing user during duplicate handling
      }
    }

    res.status(500).json({
      message: req.t('errors.serverError')
    });
  }
};

/**
 * Authenticates user via OAuth provider.
 * Finds user by email, updates OAuth info if changed (providerId can change).
 * @route POST /api/auth/oauth/login
 */
const loginOAuth = async (req, res) => {
  try {
    const { email, provider, providerId } = req.body;

    if (!email) {
      return res.status(400).json({
        message: req.t('errors.missingOAuthData')
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find user by email (primary identification)
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        message: req.t('errors.userNotFound')
      });
    }

    // Update or set OAuth info (providerId can change when Appwrite user is recreated)
    if (!user.oauth || user.oauth.providerId !== providerId) {
      user.oauth = {
        provider,
        providerId
      };
      await user.save();
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
        name: `${user.firstName} ${user.lastName}`.trim()
      }
    });
  } catch (err) {
    res.status(500).json({
      message: req.t('errors.serverError')
    });
  }
};

/**
 * Returns all unread notifications for the current user.
 * Populates sharer name and event title from references.
 * @route GET /api/auth/notifications
 */
const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('notifications.sharedBy', 'firstName lastName')
      .populate('notifications.eventId', 'title');
    
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    
    const unreadNotifications = user.notifications
      .filter(n => !n.read)
      .map(notification => {
        const notifObj = notification.toObject();
        
        if (!notifObj.sharerName && notification.sharedBy) {
          notifObj.sharerName = `${notification.sharedBy.firstName || ''} ${notification.sharedBy.lastName || ''}`.trim();
        }
        
        if (!notifObj.eventTitle && notification.eventId) {
          notifObj.eventTitle = notification.eventId.title;
        }
        
        return notifObj;
      });
    
    res.json(unreadNotifications);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Marks a specific notification as read.
 * @route PUT /api/auth/notifications/:notificationId/read
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