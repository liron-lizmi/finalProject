// server/controllers/shareController.js
const Event = require('../models/Event');
const User = require('../models/User');

//  Share an event with another user via email
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

    // Find the original event
    const originalEvent = await Event.findOne({ _id: eventId, user: req.userId });
    if (!originalEvent) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    // Check if already shared with this email
    const existingShare = originalEvent.sharedWith.find(share => share.email === email);
    if (existingShare) {
      return res.status(400).json({ message: req.t('events.share.alreadyShared') });
    }

    // Find users
    const targetUser = await User.findOne({ email });
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    // Add to shared list in original event
    originalEvent.sharedWith.push({
      email,
      userId: targetUser ? targetUser._id : null,
      permission,
      accepted: false
    });
    originalEvent.isShared = true;
    await originalEvent.save();

    // If target user exists, create shared event copy and notification
    if (targetUser) {
      await createSharedEventCopy(originalEvent, targetUser._id, permission, req.userId);
      
      // Add notification to target user
      const sharerName = `${currentUser.firstName || ''} ${currentUser.lastName || ''}`.trim() || currentUser.email;
      targetUser.notifications.push({
        type: 'event_shared',
        message: req.t('notifications.eventShared', {
          sharer: sharerName,
          eventTitle: originalEvent.title
        }),
        eventId: originalEvent._id,
        sharedBy: req.userId,
        read: false
      });
      await targetUser.save();
      
      console.log(`Notification created for user ${targetUser.email} about event ${originalEvent.title}`);
    }

    res.json({ message: req.t('events.share.shareSuccess') });
  } catch (err) {
    console.error('Error sharing event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Create a shared copy of an event for target user
const createSharedEventCopy = async (originalEvent, targetUserId, permission, sharedByUserId) => {
  const sharedEventData = {
    ...originalEvent.toObject(),
    _id: undefined,
    user: targetUserId,
    originalEvent: originalEvent._id,
    isShared: true,
    sharedWith: [],
    createdAt: new Date(),
    updatedAt: new Date()
  };

  const sharedEvent = new Event(sharedEventData);
  await sharedEvent.save();

  return sharedEvent;
};

  // Accept a shared event invitation
const acceptShare = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userEmail = req.userEmail;

    // Find the original event where this user is in sharedWith
    const originalEvent = await Event.findById(eventId);
    if (!originalEvent) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const shareInfo = originalEvent.sharedWith.find(share => share.email === userEmail);
    if (!shareInfo) {
      return res.status(403).json({ message: req.t('events.share.notSharedWithUser') });
    }

    // Update accepted status
    shareInfo.accepted = true;
    shareInfo.userId = req.userId;
    await originalEvent.save();

    // Check if shared event already exists for this user
    const existingSharedEvent = await Event.findOne({
      user: req.userId,
      originalEvent: eventId
    });

    if (!existingSharedEvent) {
      await createSharedEventCopy(originalEvent, req.userId, shareInfo.permission);
    }

    res.json({ message: req.t('events.share.acceptSuccess') });
  } catch (err) {
    console.error('Error accepting share:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Get list of users an event is shared with
const getSharedUsers = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findOne({ _id: eventId, user: req.userId })
      .populate('sharedWith.userId', 'firstName lastName email');
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    res.json(event.sharedWith);
  } catch (err) {
    console.error('Error getting shared users:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

  // Remove sharing access for a user
const removeShare = async (req, res) => {
  try {
    const { eventId, shareId } = req.params;

    // Find and update original event
    const originalEvent = await Event.findOne({ _id: eventId, user: req.userId });
    if (!originalEvent) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const shareIndex = originalEvent.sharedWith.findIndex(
      share => share._id.toString() === shareId
    );

    if (shareIndex === -1) {
      return res.status(404).json({ message: req.t('events.share.shareNotFound') });
    }

    const removedShare = originalEvent.sharedWith[shareIndex];
    originalEvent.sharedWith.splice(shareIndex, 1);

    // Update isShared status
    if (originalEvent.sharedWith.length === 0) {
      originalEvent.isShared = false;
    }

    await originalEvent.save();

    // Remove shared event copy if user exists
    if (removedShare.userId) {
      await Event.findOneAndDelete({
        user: removedShare.userId,
        originalEvent: eventId
      });
    }

    res.json({ message: req.t('events.share.removeSuccess') });
  } catch (err) {
    console.error('Error removing share:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Update permission level for a shared user
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
    console.error('Error updating permission:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Sync changes from original event to all shared copies
const syncSharedEvents = async (originalEventId) => {
  try {
    const originalEvent = await Event.findById(originalEventId);
    if (!originalEvent || !originalEvent.isShared) return;

    // Find all shared copies
    const sharedEvents = await Event.find({ originalEvent: originalEventId });

    // Update each shared copy with original event data
    for (const sharedEvent of sharedEvents) {
      const updateData = {
        ...originalEvent.toObject(),
        _id: sharedEvent._id,
        user: sharedEvent.user,
        originalEvent: sharedEvent.originalEvent,
        isShared: sharedEvent.isShared,
        sharedWith: sharedEvent.sharedWith,
        createdAt: sharedEvent.createdAt,
        updatedAt: new Date()
      };

      await Event.findByIdAndUpdate(sharedEvent._id, updateData);
    }
  } catch (err) {
    console.error('Error syncing shared events:', err);
  }
};

module.exports = {
  shareEvent,
  acceptShare,
  getSharedUsers,
  removeShare,
  updateSharePermission,
  syncSharedEvents
};