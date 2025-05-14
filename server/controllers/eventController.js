const Event = require('../models/Event');

const getUserEvents = async (req, res) => {
  try {
    const events = await Event.find({ user: req.userId }).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, date, time, type, guestCount, notes, venue } = req.body;

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const validTime = time && timeRegex.test(time) ? time : '18:00';

    const newEvent = new Event({
      title,
      date,
      time: validTime,  
      type: type || 'other',
      guestCount: guestCount || 0,
      notes,
      venue,
      user: req.userId
    });

    const savedEvent = await newEvent.save();
    res.status(201).json(savedEvent);
  } catch (err) {
    console.error('Error creating event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, type, guestCount, notes, venue } = req.body;

    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    let validTime = event.time;  
    
    if (time) {
      validTime = timeRegex.test(time) ? time : event.time;
    }

    event.title = title || event.title;
    event.date = date || event.date;
    event.time = validTime;  
    event.type = type || event.type;
    event.guestCount = guestCount !== undefined ? guestCount : event.guestCount;
    event.notes = notes !== undefined ? notes : event.notes;
    
    if (venue) {
      event.venue = {
        name: venue.name || event.venue?.name,
        address: venue.address || event.venue?.address,
        phone: venue.phone || event.venue?.phone,
        website: venue.website || event.venue?.website
      };
    }

    const updatedEvent = await event.save();
    res.json(updatedEvent);
  } catch (err) {
    console.error('Error updating event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

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
    console.error('Error deleting event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById
};