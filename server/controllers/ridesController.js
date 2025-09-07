const Guest = require('../models/Guest');
const Event = require('../models/Event');

/**
 * Retrieves basic event information for rides page
 */
const getEventRidesInfo = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    res.json({
      eventName: event.title,
      eventDate: event.date,
      eventLocation: event.venues && event.venues[0] ? event.venues[0].address : null
    });
  } catch (err) {
    console.error('Error fetching event rides info:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

/**
 * Checks if phone number exists for the event and returns guest data
 */
const checkPhoneForRides = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: req.t('events.rides.validation.phoneRequired') });
    }

    const guest = await Guest.findOne({ event: eventId, phone });
    if (!guest) {
      return res.status(404).json({ message: req.t('events.rides.phoneNotFound') });
    }

    res.json({ guest });
  } catch (err) {
    console.error('Error checking phone for rides:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

/**
 * Retrieves all guests with ride information for public display
 * Returns fresh data from database including both offering and seeking guests
 */
const getRidesGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    console.log('Getting rides for event:', eventId);
    // Get all confirmed guests with ride info
    const guests = await Guest.find({ 
      event: eventId,
      rsvpStatus: 'confirmed',
      'rideInfo.status': { $in: ['offering', 'seeking'] }
    }).select('firstName lastName phone rideInfo');
    console.log('Found guests:', guests.length); 
    console.log('Guests data:', guests);
    res.json(guests);
  } catch (err) {
    console.error('Error fetching rides guests:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

/**
 * Updates guest ride information from public interface
 * Handles both offering and seeking statuses with required fields
 */
const updateGuestRideInfo = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, rideInfo } = req.body;

    if (!phone) {
      return res.status(400).json({ message: req.t('validation.phoneRequired') });
    }

    const guest = await Guest.findOne({ event: eventId, phone });
    if (!guest) {
      return res.status(404).json({ message: req.t('events.rides.guestNotFound') });
    }

    // Build updated ride info object
    const updatedRideInfo = {
      status: rideInfo.status,
      address: rideInfo.address || '',
      departureTime: rideInfo.departureTime || '',
      lastUpdated: new Date()
    };

    // Set available seats for offering rides
    if (rideInfo.status === 'offering') {
      updatedRideInfo.availableSeats = rideInfo.availableSeats || 1;
      // Clear requiredSeats if previously set
      updatedRideInfo.requiredSeats = undefined;
    }

    // Set required seats for seeking rides  
    if (rideInfo.status === 'seeking') {
      updatedRideInfo.requiredSeats = rideInfo.requiredSeats || 1;
      // Clear availableSeats if previously set
      updatedRideInfo.availableSeats = undefined;
    }

    // Preserve existing contact history
    if (guest.rideInfo && guest.rideInfo.contactHistory) {
      updatedRideInfo.contactHistory = guest.rideInfo.contactHistory;
    }

    // Preserve contact status from other users' actions
    if (guest.rideInfo && guest.rideInfo.contactStatus) {
      updatedRideInfo.contactStatus = guest.rideInfo.contactStatus;
    }

    // Update the guest's ride info
    guest.rideInfo = updatedRideInfo;
    await guest.save();

    // Return updated guest data
    res.json({ 
      message: req.t('events.features.rides.updateSuccess'), 
      guest: guest 
    });
  } catch (err) {
    console.error('Error updating guest ride info:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

/**
 * Records contact action and updates both guests' statuses
 */
const recordContact = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, contactedGuestId, action } = req.body;

    if (!phone || !contactedGuestId || !action) {
      return res.status(400).json({ message: req.t('events.rides.validation.missingParameters') });
    }

    const guest = await Guest.findOne({ event: eventId, phone });
    const contactedGuest = await Guest.findById(contactedGuestId);

    if (!guest || !contactedGuest) {
      return res.status(404).json({ message: req.t('events.rides.guestNotFound') });
    }

    // Initialize ride info if it doesn't exist
    if (!guest.rideInfo) {
      guest.rideInfo = {
        status: 'not_set',
        contactHistory: []
      };
    }

    if (!guest.rideInfo.contactHistory) {
      guest.rideInfo.contactHistory = [];
    }

    // Update the contacting guest's contact history
    const existingContactIndex = guest.rideInfo.contactHistory.findIndex(
      contact => contact.contactedGuestId.toString() === contactedGuestId
    );

    const contactRecord = {
      contactedGuestId,
      contactedGuestName: `${contactedGuest.firstName} ${contactedGuest.lastName}`,
      action,
      timestamp: new Date()
    };

    if (existingContactIndex >= 0) {
      guest.rideInfo.contactHistory[existingContactIndex] = contactRecord;
    } else {
      guest.rideInfo.contactHistory.push(contactRecord);
    }

    // Update the contacted guest's status based on the action
    if (!contactedGuest.rideInfo) {
      contactedGuest.rideInfo = {
        status: 'not_set'
      };
    }

    switch (action) {
      case 'arranged_ride':
        contactedGuest.rideInfo.contactStatus = 'taken';
        break;
      case 'not_relevant':
        contactedGuest.rideInfo.contactStatus = 'not_relevant';
        break;
      case 'no_response':
        contactedGuest.rideInfo.contactStatus = 'in_process';
        break;
      default:
        // Keep existing status
        break;
    }

    await guest.save();
    await contactedGuest.save();

    res.json({ 
      message: req.t('events.rides.contactRecorded'),
      contactHistory: guest.rideInfo.contactHistory
    });
  } catch (err) {
    console.error('Error recording contact:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

/**
 * Updates guest ride information by event owner (admin interface)
 */
const updateGuestRideInfoByOwner = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { rideInfo } = req.body;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.rides.notFound') });
    }

    const guest = await Guest.findOne({ _id: guestId, event: eventId, user: req.userId });
    if (!guest) {
      return res.status(404).json({ message: req.t('events.rides.guestNotFound') });
    }

    const updatedRideInfo = {
      status: rideInfo.status,
      address: rideInfo.address || '',
      departureTime: rideInfo.departureTime || '',
      lastUpdated: new Date()
    };

    // Set available seats for offering rides
    if (rideInfo.status === 'offering') {
      updatedRideInfo.availableSeats = rideInfo.availableSeats || 1;
    }

    // Set required seats for seeking rides
    if (rideInfo.status === 'seeking') {
      updatedRideInfo.requiredSeats = rideInfo.requiredSeats || 1;
    }

    // Preserve existing contact history and status
    if (guest.rideInfo && guest.rideInfo.contactHistory) {
      updatedRideInfo.contactHistory = guest.rideInfo.contactHistory;
    }

    if (guest.rideInfo && guest.rideInfo.contactStatus) {
      updatedRideInfo.contactStatus = guest.rideInfo.contactStatus;
    }

    guest.rideInfo = updatedRideInfo;
    await guest.save();

    res.json({ message: req.t('events.rides.updateSuccess'), guest });
  } catch (err) {
    console.error('Error updating guest ride info by owner:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

module.exports = {
  getEventRidesInfo,
  checkPhoneForRides,
  getRidesGuests,
  updateGuestRideInfo,
  recordContact,
  updateGuestRideInfoByOwner
};