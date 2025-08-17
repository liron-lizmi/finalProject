const Guest = require('../models/Guest');
const Event = require('../models/Event');

const getEventGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId })
      .sort({ lastName: 1, firstName: 1 });
    
    res.json(guests);
  } catch (err) {
    console.error('Error fetching guests:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, phone, group, customGroup } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    let finalGroup = group || 'other';
    let finalCustomGroup = undefined;

    if (group === 'custom' || !['family', 'friends', 'work', 'other'].includes(group)) {
      if (customGroup && customGroup.trim()) {
        finalGroup = customGroup.trim();
        finalCustomGroup = customGroup.trim();
      } else if (!['family', 'friends', 'work', 'other'].includes(group)) {
        finalGroup = group;
        finalCustomGroup = group;
      } else {
        finalGroup = 'other';
      }
    }

    const guestData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      group: finalGroup,
      event: eventId,
      user: req.userId
    };

    if (finalCustomGroup) {
      guestData.customGroup = finalCustomGroup;
    }

    const newGuest = new Guest(guestData);
    const savedGuest = await newGuest.save();
    
    res.status(201).json(savedGuest);
  } catch (err) {
    console.error('Error adding guest:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: req.t('guests.errors.duplicateGuest')
      });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const deleteGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    await Guest.findByIdAndDelete(guestId);
    res.json({ message: req.t('guests.deleteSuccess') });
  } catch (err) {
    console.error('Error deleting guest:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { firstName, lastName, phone, group, customGroup } = req.body;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    if (firstName !== undefined) guest.firstName = firstName.trim();
    if (lastName !== undefined) guest.lastName = lastName.trim();
    if (phone !== undefined) guest.phone = phone.trim();
    
    if (group !== undefined) {
      let finalGroup = group || 'other';
      let finalCustomGroup = undefined;

      if (group === 'custom' || !['family', 'friends', 'work', 'other'].includes(group)) {
        if (customGroup && customGroup.trim()) {
          finalGroup = customGroup.trim();
          finalCustomGroup = customGroup.trim();
        } else if (!['family', 'friends', 'work', 'other'].includes(group)) {
          finalGroup = group;
          finalCustomGroup = group;
        } else {
          finalGroup = 'other';
        }
      }

      guest.group = finalGroup;
      guest.customGroup = finalCustomGroup;
    }

    const updatedGuest = await guest.save();
    res.json(updatedGuest);
  } catch (err) {
    console.error('Error updating guest:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuestRSVP = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { rsvpStatus, guestNotes } = req.body;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    if (rsvpStatus !== undefined) {
      guest.rsvpStatus = rsvpStatus;
      guest.rsvpReceivedAt = Date.now();
    }
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    const updatedGuest = await guest.save();
    res.json({
      message: req.t('guests.rsvpUpdateSuccess'),
      guest: updatedGuest
    });
  } catch (err) {
    console.error('Error updating guest RSVP:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getEventGroups = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId }, 'group customGroup');
    
    const groups = new Set();
    guests.forEach(guest => {
      if (['family', 'friends', 'work', 'other'].includes(guest.group)) {
        groups.add(guest.group);
      } else if (guest.customGroup) {
        groups.add(guest.customGroup);
      } else {
        groups.add(guest.group);
      }
    });

    res.json(Array.from(groups));
  } catch (err) {
    console.error('Error fetching event groups:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getGuestStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId });
    
    const stats = {
      total: guests.length,
      confirmed: guests.filter(g => g.rsvpStatus === 'confirmed').length,
      declined: guests.filter(g => g.rsvpStatus === 'declined').length,
      pending: guests.filter(g => g.rsvpStatus === 'pending').length,
      no_response: guests.filter(g => g.rsvpStatus === 'no_response').length,
      invitationsSent: guests.filter(g => g.invitationSent).length,
      byGroup: {}
    };

    guests.forEach(guest => {
      const group = guest.customGroup || guest.group;
      if (!stats.byGroup[group]) {
        stats.byGroup[group] = {
          total: 0,
          confirmed: 0,
          declined: 0,
          pending: 0,
          no_response: 0
        };
      }
      stats.byGroup[group].total++;
      stats.byGroup[group][guest.rsvpStatus]++;
    });

    res.json(stats);
  } catch (err) {
    console.error('Error fetching guest stats:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuestRSVPPublic = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, rsvpStatus, guestNotes, attendingCount } = req.body;
    
    // Find the guest by phone number and event
    const guest = await Guest.findOne({ 
      phone: phone.trim(), 
      event: eventId 
    });
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound') 
      });
    }

    // Update RSVP information
    guest.rsvpStatus = rsvpStatus;
    guest.rsvpReceivedAt = Date.now();
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }
    
    if (attendingCount !== undefined && attendingCount > 0) {
      guest.attendingCount = attendingCount;
    }

    const updatedGuest = await guest.save();
    
    res.json({
      message: req.t('guests.rsvpUpdateSuccess'),
      guest: {
        firstName: updatedGuest.firstName,
        lastName: updatedGuest.lastName,
        rsvpStatus: updatedGuest.rsvpStatus,
        attendingCount: updatedGuest.attendingCount
      }
    });
  } catch (err) {
    console.error('Error updating guest RSVP (public):', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getEventForRSVP = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId, 'eventName eventDate eventLocation');
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event for RSVP:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const checkGuestByPhone = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body;
    
    const guest = await Guest.findOne({ 
      phone: phone.trim(), 
      event: eventId 
    }, 'firstName lastName rsvpStatus attendingCount guestNotes');
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound') 
      });
    }

    res.json({
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        rsvpStatus: guest.rsvpStatus,
        attendingCount: guest.attendingCount || 1,
        guestNotes: guest.guestNotes || ''
      }
    });
  } catch (err) {
    console.error('Error checking guest by phone:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const generateRSVPLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Verify event exists and belongs to user
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const rsvpLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/rsvp/${eventId}`;
    
    res.json({ 
      rsvpLink,
      eventName: event.eventName 
    });
  } catch (err) {
    console.error('Error generating RSVP link:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getEventGuests,
  addGuest,
  updateGuest,
  deleteGuest,
  updateGuestRSVP,
  getEventGroups,
  getGuestStats,
  updateGuestRSVPPublic,
  getEventForRSVP,
  checkGuestByPhone,
  generateRSVPLink
};