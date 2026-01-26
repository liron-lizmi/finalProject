// server/controllers/eventController.js
const Event = require('../models/Event');
const User = require('../models/User');

const getUserEvents = async (req, res) => {
  try {
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    const ownedEvents = await Event.find({ 
      user: req.userId
    }).sort({ date: 1 });

    const sharedEvents = await Event.find({ 
      user: { $ne: req.userId },
      $or: [
        { 'sharedWith.userId': req.userId },
        { 'sharedWith.email': currentUser.email }
      ]
    })
      .populate('user', 'firstName lastName email')
      .sort({ date: 1 });

    const ownedEventsWithMeta = ownedEvents.map(event => ({
      ...event.toObject(),
      isOwner: true,
      permission: 'owner',
      canEdit: true
    }));

    const sharedEventsWithMeta = sharedEvents.map(event => {
      const shareInfo = event.sharedWith.find(
        share => (share.userId && share.userId.toString() === req.userId) || 
                 share.email === currentUser.email
      );
      
      return {
        ...event.toObject(),
        isOwner: false,
        permission: shareInfo?.permission || 'view',
        canEdit: shareInfo?.permission === 'edit',
        originalOwner: event.user,
        accepted: shareInfo?.accepted || false
      };
    });

    const allEvents = [...ownedEventsWithMeta, ...sharedEventsWithMeta]
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    res.json(allEvents);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, date, time, type, guestCount, notes, venues, vendors, isSeparatedSeating } = req.body;
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const validTime = time && timeRegex.test(time) ? time : '18:00';
    
    const newEvent = new Event({
      title,
      date,
      time: validTime,  
      type: type || 'other',
      guestCount: guestCount || 0,
      notes,
      venues: venues || [],
      vendors: vendors || [],
      isSeparatedSeating: Boolean(isSeparatedSeating),
      user: req.userId
    });
    
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Update an event
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, type, guestCount, notes, venues, vendors, isSeparatedSeating } = req.body;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    let canEdit = isOwner;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
      
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      if (shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.editDenied') });
      }
      
      canEdit = true;
    }

    if (!canEdit) {
      return res.status(403).json({ message: req.t('events.editDenied') });
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    let validTime = event.time;  
    
    if (time) {
      validTime = timeRegex.test(time) ? time : event.time;
    }
    
    if (title !== undefined) event.title = title;
    if (date !== undefined) event.date = date;
    if (time !== undefined) event.time = validTime;
    if (type !== undefined) event.type = type;
    if (guestCount !== undefined) event.guestCount = guestCount;
    if (notes !== undefined) event.notes = notes;
    if (isSeparatedSeating !== undefined) event.isSeparatedSeating = Boolean(isSeparatedSeating);
    
    if (venues !== undefined) {
      if (venues === null) {
        event.venues = [];
      } else if (Array.isArray(venues)) {
        const processedVenues = venues.map(venue => ({
          name: venue.name || '',
          address: venue.address || '',
          phone: venue.phone || '',
          website: venue.website || ''
        }));
        event.venues = processedVenues;
      } else if (typeof venues === 'string') {
        try {
          const parsedVenues = JSON.parse(venues);
          event.venues = parsedVenues;
        } catch (parseError) {
          return res.status(400).json({ message: req.t('errors.invalidFormat') });
        }
      }
    }

    if (vendors !== undefined) {
      if (typeof vendors === 'string') {
        try {
          const parsedVendors = JSON.parse(vendors);
          event.vendors = parsedVendors;
        } catch (parseError) {
          return res.status(400).json({ message: req.t('errors.invalidFormat') });
        }
      } else if (Array.isArray(vendors)) {
        const processedVendors = vendors.map(vendor => ({
          name: vendor.name || 'Unknown',
          category: vendor.category || 'other',
          phone: vendor.phone || '000-000-0000',
          notes: vendor.notes || ''
        }));
        event.vendors = processedVendors;
      } else if (!vendors || vendors.length === 0) {
        event.vendors = [];
      }
    }
    
    const updatedEvent = await event.save();
    res.json(updatedEvent);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Delete an event
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findOne({ _id: id, user: req.userId });
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    await Event.findByIdAndDelete(id);
    res.json({ message: req.t('events.deleteSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Get event by ID with permission check
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    
    if (isOwner) {
      const eventData = event.toObject();
      eventData.userPermission = 'owner';
      eventData.canEdit = true;
      eventData.isOwner = true;
      return res.json(eventData);
    }

    const shareInfo = event.sharedWith.find(
      share => (share.userId && share.userId.toString() === req.userId) ||
               share.email === currentUser.email
    );

    if (shareInfo) {
      const eventData = event.toObject();
      eventData.userPermission = shareInfo.permission;
      eventData.canEdit = shareInfo.permission === 'edit';
      eventData.isOwner = false;
      return res.json(eventData);
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Check if user has edit permission for an event
const checkEditPermission = async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }
    
    if (event.user.toString() === req.userId) {
      return res.json({ canEdit: true });
    }
    
    const shareInfo = event.sharedWith.find(
      share => share.userId && share.userId.toString() === req.userId
    );
    
    return res.json({ canEdit: shareInfo?.permission === 'edit' });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Get notifications
const getNotifications = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('notifications.eventId', 'title')
      .populate('notifications.sharedBy', 'firstName lastName');
    
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    
    const unreadNotifications = user.notifications.filter(n => !n.read);
    res.json(unreadNotifications);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Mark notification as read
const markNotificationRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const user = await User.findOneAndUpdate(
      { _id: req.userId, 'notifications._id': notificationId },
      { $set: { 'notifications.$.read': true } },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ message: req.t('errors.notificationNotFound') });
    }
    
    res.json({ message: req.t('notifications.markedAsRead') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Accept notification and share
const acceptNotificationAndShare = async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: req.t('errors.userNotFound') });
    }
    
    const notification = user.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ message: req.t('errors.notificationNotFound') });
    }
    
    if (notification.type !== 'event_shared') {
      return res.status(400).json({ message: req.t('errors.invalidNotificationType') });
    }
    
    const event = await Event.findById(notification.eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }
    
    const shareInfo = event.sharedWith.find(share => 
      share.email === user.email || 
      (share.userId && share.userId.toString() === req.userId)
    );
    
    if (!shareInfo) {
      return res.status(404).json({ message: req.t('events.share.shareNotFound') });
    }
    
    shareInfo.accepted = true;
    shareInfo.userId = req.userId;
    await event.save();
    
    notification.read = true;
    await user.save();
    
    res.json({ message: req.t('events.share.acceptSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  checkEditPermission,
  getNotifications,
  markNotificationRead,
  acceptNotificationAndShare
};