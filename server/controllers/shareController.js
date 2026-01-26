// server/controllers/shareController.js
const Event = require('../models/Event');
const User = require('../models/User');

// Share an event with another user via email
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

// Accept a shared event invitation
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

// Get list of users an event is shared with
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

// Remove sharing access for a user
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

// Update permission level for a shared user
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