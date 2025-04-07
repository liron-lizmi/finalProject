const Event = require('../models/Event');

const getUserEvents = async (req, res) => {
  try {
    const events = await Event.find({ user: req.userId }).sort({ date: 1 });
    res.json(events);
  } catch (err) {
    console.error('Error fetching events:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const createEvent = async (req, res) => {
  try {
    const { title, date, type, guestCount, notes, venue } = req.body;

    const newEvent = new Event({
      title,
      date,
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
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, type, guestCount, notes, venue } = req.body;

    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: 'אירוע לא נמצא' });
    }

    event.title = title || event.title;
    event.date = date || event.date;
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
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: 'אירוע לא נמצא' });
    }

    await Event.findByIdAndDelete(id);
    res.json({ message: 'אירוע נמחק בהצלחה' });
  } catch (err) {
    console.error('Error deleting event:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: 'אירוע לא נמצא' });
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event:', err);
    res.status(500).json({ message: 'שגיאת שרת' });
  }
};

module.exports = {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById
};