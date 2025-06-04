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
    const { title, date, time, type, guestCount, notes, venues, vendors } = req.body;
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

const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, date, time, type, guestCount, notes, venues, vendors } = req.body;
    
    const event = await Event.findOne({ _id: id, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
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
          return res.status(400).json({ message: 'Invalid venues format' });
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
          return res.status(400).json({ message: 'Invalid vendors format' });
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
    
    console.log("Saving event with venues:", JSON.stringify(event.venues, null, 2));
    console.log("Saving event with vendors:", JSON.stringify(event.vendors, null, 2));
    
    const updatedEvent = await event.save();
    res.json(updatedEvent);
  } catch (err) {
    console.error('Error updating event:', err);
    console.warn("Error updating event:", err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ errors });
    }
    
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