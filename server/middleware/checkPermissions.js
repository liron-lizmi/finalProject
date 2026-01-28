/**
 * checkPermissions.js - Permission Checking Middleware
 *
 * Middleware functions to verify user access to events.
 * Sets req.canEdit, req.userPermission, req.isEventOwner for downstream use.
 *
 * Functions:
 * - checkEditPermission: Allows owner and users with 'edit' permission.
 *   Blocks non-GET requests for view-only users.
 * - checkViewPermission: Allows owner and any shared user (view or edit).
 * - checkIsEventOwner: Only allows the event owner (for sharing operations).
 *
 * All functions return 404 (not 403) for non-accessible events to avoid
 * revealing event existence to unauthorized users.
 */

const Event = require('../models/Event');
const User = require('../models/User');
const mongoose = require('mongoose');

const checkEditPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: req.t('errors.invalidEventId') });
    }
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    if (event.user.toString() === req.userId) {
      req.canEdit = true;
      req.userPermission = 'owner';
      req.isEventOwner = true;
      return next();
    }

    const shareInfo = event.sharedWith.find(
      share => (share.userId && share.userId.toString() === req.userId) ||
               share.email === currentUser.email
    );

    if (shareInfo) {
      req.canEdit = shareInfo.permission === 'edit';
      req.userPermission = shareInfo.permission;
      req.isEventOwner = false;
      
      if (req.method !== 'GET' && !req.canEdit) {
        return res.status(403).json({ message: req.t('events.editDenied') });
      }
      
      return next();
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const checkViewPermission = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: req.t('errors.invalidEventId') });
    }
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    if (event.user.toString() === req.userId) {
      req.canEdit = true;
      req.userPermission = 'owner';
      req.isEventOwner = true;
      return next();
    }
    const shareInfo = event.sharedWith.find(
      share => (share.userId && share.userId.toString() === req.userId) ||
               share.email === currentUser.email
    );

    if (shareInfo) {
      req.canEdit = shareInfo.permission === 'edit';
      req.userPermission = shareInfo.permission;
      req.isEventOwner = false;
      return next();
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const checkIsEventOwner = async (req, res, next) => {
  try {
    const eventId = req.params.eventId || req.params.id;
    
    if (!eventId || !mongoose.Types.ObjectId.isValid(eventId)) {
      return res.status(400).json({ message: req.t('errors.invalidEventId') });
    }
    
    const event = await Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    if (event.user.toString() !== req.userId) {
      return res.status(403).json({ message: req.t('events.onlyOwnerCanShare') });
    }
    
    req.isEventOwner = true;
    return next();
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = { 
  checkEditPermission,
  checkViewPermission,
  checkIsEventOwner
};