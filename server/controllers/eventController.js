// server/controllers/eventController.js
const Event = require('../models/Event');
const User = require('../models/User');
const { syncSharedEvents } = require('./shareController');

// Get all events for current user including shared events
const getUserEvents = async (req, res) => {
  try {
    const events = await Event.find({ user: req.userId })
      .populate('originalEvent', 'user title')
      .populate({
        path: 'originalEvent',
        populate: {
          path: 'user',
          select: 'firstName lastName email'
        }
      })
      .sort({ date: 1 });

    // Add original owner info for shared events
    const eventsWithOwnerInfo = events.map(event => {
      if (event.originalEvent && event.originalEvent.user) {
        return {
          ...event.toObject(),
          originalOwner: event.originalEvent.user
        };
      }
      return event;
    });

    res.json(eventsWithOwnerInfo);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};


// Create a new event
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
      isSeparatedSeating: Boolean(isSeparatedSeating), // ADDED: Support for separated seating
      user: req.userId
    });
    
    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    console.error('Error creating event:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Update an event and sync with shared copies
const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, type, guestCount, notes, venues, vendors, isSeparatedSeating } = req.body;
    
    // Check if user owns the event or has edit permission
    let event = await Event.findOne({ _id: id, user: req.userId });
    let isSharedEvent = false;
    let originalEventId = null;

    if (!event) {
      // Check if it's a shared event with edit permission
      const originalEvent = await Event.findOne({
        _id: id,
        'sharedWith.userId': req.userId
      });

      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }

      const shareInfo = originalEvent.sharedWith.find(
        share => share.userId?.toString() === req.userId
      );

      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.editDenied') });
      }

      // Find user's shared copy
      event = await Event.findOne({
        user: req.userId,
        originalEvent: id
      });

      if (!event) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }

      isSharedEvent = true;
      originalEventId = id;
      
      // Update the original event instead
      event = originalEvent;
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
    if (isSeparatedSeating !== undefined) event.isSeparatedSeating = Boolean(isSeparatedSeating); // ADDED
    
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
          console.error('Error parsing venues string:', parseError);
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
          console.error('Error parsing vendors string:', parseError);
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
    
    // Sync with shared events if this is an original event
    if (updatedEvent.isShared && !updatedEvent.originalEvent) {
      await syncSharedEvents(updatedEvent._id);
    }
    
    // If this was a shared event update, return the user's shared copy
    if (isSharedEvent) {
      const userSharedCopy = await Event.findOne({
        user: req.userId,
        originalEvent: originalEventId
      });
      return res.json(userSharedCopy || updatedEvent);
    }
    
    res.json(updatedEvent);
  } catch (err) {
    console.error('Error updating event:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Delete an event and its shared copies
const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    // If this is an original event with shares, delete all shared copies
    if (event.isShared && !event.originalEvent) {
      await Event.deleteMany({ originalEvent: id });
    }

    await Event.findByIdAndDelete(id);
    res.json({ message: req.t('events.deleteSuccess') });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Get event by ID with permission check for shared events
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;
    
    let event = await Event.findOne({ _id: id, user: req.userId });
    if (event && !event.originalEvent) {
      const eventData = event.toObject();
      eventData.userPermission = 'edit';
      eventData.canEdit = true;
      return res.json(eventData);
    }

    if (event && event.originalEvent) {
      const originalEvent = await Event.findOne({
        _id: event.originalEvent,
        'sharedWith.userId': req.userId
      });

      if (originalEvent) {
        const shareInfo = originalEvent.sharedWith.find(
          share => share.userId?.toString() === req.userId
        );

        if (shareInfo) {
          const eventData = event.toObject();
          eventData.userPermission = shareInfo.permission;
          eventData.canEdit = shareInfo.permission === 'edit';
          return res.json(eventData);
        }
      }
    }

    return res.status(404).json({ message: req.t('events.notFound') });
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

//  Check if user has edit permission for an event
const checkEditPermission = async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Event.findOne({ _id: id, user: req.userId });
    
    if (!event) {
      // Check if it's a shared event
      const originalEvent = await Event.findOne({
        _id: id,
        'sharedWith.userId': req.userId
      });
      
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      const shareInfo = originalEvent.sharedWith.find(
        share => share.userId?.toString() === req.userId
      );
      
      return res.json({ canEdit: shareInfo?.permission === 'edit' });
    }
    
    // User owns the event
    res.json({ canEdit: true });
  } catch (err) {
    console.error('Error checking edit permission:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

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
    console.error('Error fetching notifications:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

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
    console.error('Error marking notification as read:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

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
    
    const originalEvent = await Event.findById(notification.eventId);
    if (!originalEvent) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }
    
    const shareInfo = originalEvent.sharedWith.find(share => 
      share.email === user.email || 
      (share.userId && share.userId.toString() === req.userId)
    );
    
    if (!shareInfo) {
      return res.status(404).json({ message: req.t('events.share.shareNotFound') });
    }
    
    shareInfo.accepted = true;
    shareInfo.userId = req.userId;
    await originalEvent.save();
    
    notification.read = true;
    await user.save();
    
    res.json({ message: req.t('events.share.acceptSuccess') });
  } catch (err) {
    console.error('Error accepting notification and share:', err);
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