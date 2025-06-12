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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, phone, group } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const newGuest = new Guest({
      firstName,
      lastName,
      phone,
      group: group || 'other',
      event: eventId,
      user: req.userId
    });

    const savedGuest = await newGuest.save();
    res.status(201).json(savedGuest);
  } catch (err) {
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

    guest.rsvpStatus = rsvpStatus;
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }
    guest.rsvpReceivedAt = Date.now();

    const updatedGuest = await guest.save();
    res.json({
      message: req.t('guests.rsvpUpdateSuccess'),
      guest: updatedGuest
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getEventGuests,
  addGuest,
  deleteGuest,
  updateGuestRSVP
};