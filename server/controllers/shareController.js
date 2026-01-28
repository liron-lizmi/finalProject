/**
 * shareController.js
 *
 * Controller for managing event sharing between users.
 * Handles sharing events with other users, accepting invitations,
 * and managing share permissions.
 *
 * Main features:
 * - Share event with user by email (view or edit permission)
 * - Accept/decline share invitations
 * - View shared users list
 * - Update share permissions
 * - Remove share access
 */

const Event = require('../models/Event');
const User = require('../models/User');

/**
 * Shares an event with another user by email.
 * Creates notification for target user. Only owner can share.
 * @route POST /api/events/:eventId/share
 */
const shareEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { email, permission } = req.body;

    if (!email || !permission) {
      return res.status(400).json({ message: req.t('validation.missingParameters') });
    }

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({ message: req.t('validation.invalidPermission') });
    }

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const existingShare = event.sharedWith.find(share => share.email === email);
    if (existingShare) {
      return res.status(400).json({ message: req.t('events.share.alreadyShared') });
    }

    const targetUser = await User.findOne({ email });
    const currentUser = await User.findById(req.userId);

    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    if (!targetUser) {
      return res.status(404).json({ message: req.t('errors.userNotInSystem') });
    }

    event.sharedWith.push({
      email,
      userId: targetUser._id,
      permission,
      accepted: false
    });
    
    await event.save();

    const sharerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;
    targetUser.notifications.push({
      type: 'event_shared',
      eventId: event._id,
      sharedBy: req.userId,
      read: false,
      sharerName: sharerName,
      eventTitle: event.title
    });
    await targetUser.save();

    res.json({ message: req.t('events.share.shareSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Accepts a share invitation. Links userId to share entry.
 * @route POST /api/events/:eventId/share/accept
 */
const acceptShare = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userEmail = req.userEmail;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const shareInfo = event.sharedWith.find(share => share.email === userEmail);
    if (!shareInfo) {
      return res.status(403).json({ message: req.t('events.share.notSharedWithUser') });
    }

    shareInfo.accepted = true;
    shareInfo.userId = req.userId;
    await event.save();

    res.json({ message: req.t('events.share.acceptSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Returns list of users the event is shared with.
 * Accessible by owner and shared users.
 * @route GET /api/events/:eventId/share
 */
const getSharedUsers = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({
      $or: [
        { _id: eventId, user: req.userId },
        { _id: eventId, 'sharedWith.userId': req.userId }
      ]
    }).populate('sharedWith.userId', 'firstName lastName email');
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    
    res.json({
      sharedWith: event.sharedWith,
      isOwner: isOwner
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Removes share access for a user. Only owner can remove.
 * @route DELETE /api/events/:eventId/share/:shareId
 */
const removeShare = async (req, res) => {
  try {
    const { eventId, shareId } = req.params;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const shareIndex = event.sharedWith.findIndex(
      share => share._id.toString() === shareId
    );

    if (shareIndex === -1) {
      return res.status(404).json({ message: req.t('events.share.shareNotFound') });
    }

    event.sharedWith.splice(shareIndex, 1);
    await event.save();

    res.json({ message: req.t('events.share.removeSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Updates share permission (view/edit) for a user. Only owner can update.
 * @route PUT /api/events/:eventId/share/:shareId
 */
const updateSharePermission = async (req, res) => {
  try {
    const { eventId, shareId } = req.params;
    const { permission } = req.body;

    if (!['view', 'edit'].includes(permission)) {
      return res.status(400).json({ message: req.t('validation.invalidPermission') });
    }

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const share = event.sharedWith.id(shareId);
    if (!share) {
      return res.status(404).json({ message: req.t('events.share.shareNotFound') });
    }

    share.permission = permission;
    await event.save();

    res.json({ message: req.t('events.share.permissionUpdated') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  shareEvent,
  acceptShare,
  getSharedUsers,
  removeShare,
  updateSharePermission
};