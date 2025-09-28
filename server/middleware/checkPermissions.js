// server/middleware/checkPermissions.js
const Event = require('../models/Event');
const mongoose = require('mongoose');

//  Middleware to check if user has edit permission for an event
const checkEditPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: req.t('errors.invalidEventId') });
    }
    
    const ownedEvent = await Event.findOne({ _id: eventId, user: req.userId });
    if (ownedEvent && !ownedEvent.originalEvent) {
      req.canEdit = true;
      req.userPermission = 'edit';
      return next();
    }

    if (ownedEvent && ownedEvent.originalEvent) {
      const originalEvent = await Event.findOne({
        _id: ownedEvent.originalEvent,
        'sharedWith.userId': req.userId
      });

      if (originalEvent) {
        const shareInfo = originalEvent.sharedWith.find(
          share => share.userId?.toString() === req.userId
        );

        if (shareInfo) {
          req.canEdit = shareInfo.permission === 'edit';
          req.userPermission = shareInfo.permission;
          
          if (req.method !== 'GET' && !req.canEdit) {
            return res.status(403).json({ message: req.t('events.editDenied') });
          }
          
          return next();
        }
      }
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    console.error('Error checking permissions:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const checkViewPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: req.t('errors.invalidEventId') });
    }
    
    const ownedEvent = await Event.findOne({ _id: eventId, user: req.userId });
    if (ownedEvent && !ownedEvent.originalEvent) {
      req.canEdit = true;
      req.userPermission = 'edit';
      return next();
    }

    if (ownedEvent && ownedEvent.originalEvent) {
      const originalEvent = await Event.findOne({
        _id: ownedEvent.originalEvent,
        'sharedWith.userId': req.userId
      });

      if (originalEvent) {
        const shareInfo = originalEvent.sharedWith.find(
          share => share.userId?.toString() === req.userId
        );

        if (shareInfo) {
          req.canEdit = shareInfo.permission === 'edit';
          req.userPermission = shareInfo.permission;
          return next();
        }
      }
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    console.error('Error checking permissions:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = { 
  checkEditPermission,
  checkViewPermission 
};