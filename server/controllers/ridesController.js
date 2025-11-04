const Guest = require('../models/Guest');
const Event = require('../models/Event');
const axios = require('axios');

// Cache for distance calculations 
const distanceCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Calculate distance using Google Distance Matrix API
const calculateDistance = async (address1, address2) => {
  // Create cache key
  const cacheKey = `${address1.toLowerCase().trim()}|${address2.toLowerCase().trim()}`;
  
  const cachedResult = distanceCache.get(cacheKey);
  if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_DURATION) {
    return cachedResult.distance;
  }

  // If addresses are identical or very similar
  const addr1Lower = address1.toLowerCase().trim();
  const addr2Lower = address2.toLowerCase().trim();
  
  if (addr1Lower === addr2Lower) {
    return 0.1;
  }
  
  if (addr1Lower.includes(addr2Lower) || addr2Lower.includes(addr1Lower)) {
    return 0.5;
  }

  // Call Google Distance Matrix API
  try {
    const apiKey = process.env.GOOGLE_DISTANCE_MATRIX_API_KEY;
    
    if (!apiKey) {
      console.error('Google Maps API key is missing!');
      return fallbackDistance(address1, address2); 
    }

    const url = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = {
      origins: address1,
      destinations: address2,
      key: apiKey,
      language: 'he',
      region: 'il'
    };
    
    const response = await axios.get(url, { params });
    
    if (response.data.status === 'OK' && 
        response.data.rows[0]?.elements[0]?.status === 'OK') {
      
      const distanceInMeters = response.data.rows[0].elements[0].distance.value;
      const distanceInKm = distanceInMeters / 1000;
      
      // Save to cache
      distanceCache.set(cacheKey, {
        distance: distanceInKm,
        timestamp: Date.now()
      });
      
      return distanceInKm;
      
    } else {
      console.warn('Google API returned no result, using fallback');
      return fallbackDistance(address1, address2);
    }
    
  } catch (error) {
    console.error('Error calling Google Distance Matrix API:', error.message);
    return fallbackDistance(address1, address2);
  }
};

// Fallback distance calculation 
const fallbackDistance = (address1, address2) => {
  const addr1Lower = address1.toLowerCase().trim();
  const addr2Lower = address2.toLowerCase().trim();
  
  const cityVariations = {
    'תל אביב': ['תל אביב', 'ת"א', 'תל-אביב', 'tel aviv', 'תא', 'תל אביב יפו', 'tlv'],
    'ירושלים': ['ירושלים', 'ירושלם', 'jerusalem', 'י-ם', 'ירוש', 'ים', 'jlm'],
    'חיפה': ['חיפה', 'haifa', 'חיפא'],
    'באר שבע': ['באר שבע', 'באר-שבע', 'beer sheva', 'ב"ש', 'be\'er sheva'],
    'פתח תקווה': ['פתח תקווה', 'פתח-תקווה', 'פת"ק', 'petah tikva'],
    'נתניה': ['נתניה', 'netanya'],
    'רחובות': ['רחובות', 'rehovot'],
    'מודיעין': ['מודיעין', 'modiin', 'מודיעין עילית', 'מודיעין מכבים רעות'],
    'רעננה': ['רעננה', 'raanana'],
    'הרצליה': ['הרצליה', 'herzliya'],
    'רמת גן': ['רמת גן', 'רמת-גן', 'ramat gan'],
    'בני ברק': ['בני ברק', 'בני-ברק', 'bnei brak'],
    'גבעתיים': ['גבעתיים', 'givatayim'],
    'אשדוד': ['אשדוד', 'ashdod'],
    'אשקלון': ['אשקלון', 'ashkelon'],
    'בית שמש': ['בית שמש', 'בית-שמש', 'bet shemesh'],
    'ביתר עילית': ['ביתר עילית', 'ביתר', 'beitar illit', 'ביתר-עילית'],
    'מעלה אדומים': ['מעלה אדומים', 'מעלה-אדומים', 'maale adumim'],
    'אלעד': ['אלעד', 'elad'],
    'כפר סבא': ['כפר סבא', 'כפר-סבא', 'kfar saba'],
    'הוד השרון': ['הוד השרון', 'הוד-השרון', 'hod hasharon'],
    'ראשון לציון': ['ראשון לציון', 'ראשון', 'rishon lezion'],
    'אפרת': ['אפרת', 'efrat', 'אפרת'],
    'גוש עציון': ['גוש עציון', 'gush etzion'],
    'מעלות דפנה': ['מעלות דפנה', 'maalot dafna'],
    'רמות': ['רמות', 'ramot'],
    'גבעת זאב': ['גבעת זאב', 'givat zeev', 'גבעת-זאב'],
    'מבשרת ציון': ['מבשרת ציון', 'mevaseret zion', 'מבשרת'],
    'אבו גוש': ['אבו גוש', 'abu gosh'],
    'קרית ארבע': ['קרית ארבע', 'kiryat arba'],
    'חברון': ['חברון', 'hebron'],
    'אריאל': ['אריאל', 'ariel'],
    'מעלה אפרים': ['מעלה אפרים', 'maaleh efraim'],
    'עפרה': ['עפרה', 'ofra'],
    'בית אל': ['בית אל', 'beit el', 'bet el'],
    'עלי': ['עלי', 'eli'],
    'שילה': ['שילה', 'shilo'],
    'עמנואל': ['עמנואל', 'emanuel'],
    'כרמיאל': ['כרמיאל', 'karmiel'],
    'צפת': ['צפת', 'safed', 'tzfat'],
    'טבריה': ['טבריה', 'tiberias'],
    'נצרת עילית': ['נצרת עילית', 'nof hagalil', 'נוף הגליל'],
    'עכו': ['עכו', 'acre', 'akko'],
    'נהריה': ['נהריה', 'nahariya'],
    'קרית שמונה': ['קרית שמונה', 'kiryat shmona'],
    'אילת': ['אילת', 'eilat'],
    'דימונה': ['דימונה', 'dimona'],
    'ערד': ['ערד', 'arad'],
    'קרית גת': ['קרית גת', 'kiryat gat'],
    'קרית מלאכי': ['קרית מלאכי', 'kiryat malachi'],
    'יבנה': ['יבנה', 'yavne'],
    'גדרה': ['גדרה', 'gedera'],
    'נס ציונה': ['נס ציונה', 'nes ziona']
  };
  
  const findCity = (address) => {
    for (const [mainCity, variations] of Object.entries(cityVariations)) {
      for (const variation of variations) {
        if (address.includes(variation.toLowerCase())) {
          return mainCity;
        }
      }
    }
    return null;
  };
  
  const city1 = findCity(addr1Lower);
  const city2 = findCity(addr2Lower);
  
  if (!city1 || !city2) {
    return 12;
  }
  
  if (city1 === city2) {
    return Math.random() * 3 + 0.5;
  }
  
  const jerusalemAreas = ['ירושלים', 'בית שמש', 'מודיעין', 'ביתר עילית', 'מעלה אדומים', 
                          'אפרת', 'גוש עציון', 'מעלות דפנה', 'רמות', 'גבעת זאב', 
                          'מבשרת ציון', 'אבו גוש', 'קרית ארבע'];
  const isJerusalemArea1 = jerusalemAreas.includes(city1);
  const isJerusalemArea2 = jerusalemAreas.includes(city2);
  
  if (isJerusalemArea1 && isJerusalemArea2) {
    return Math.random() * 12 + 8;
  }
  
  const gushDanAreas = ['תל אביב', 'רמת גן', 'גבעתיים', 'בני ברק', 'פתח תקווה', 
                        'רעננה', 'הרצליה', 'הוד השרון', 'כפר סבא', 'ראשון לציון', 
                        'רחובות', 'נס ציונה', 'גדרה', 'יבנה'];
  const isGushDan1 = gushDanAreas.includes(city1);
  const isGushDan2 = gushDanAreas.includes(city2);
  
  if (isGushDan1 && isGushDan2) {
    return Math.random() * 15 + 5;
  }
  
  const northAreas = ['חיפה', 'כרמיאל', 'צפת', 'טבריה', 'נצרת עילית', 'עכו', 'נהריה', 'קרית שמונה'];
  const isNorth1 = northAreas.includes(city1);
  const isNorth2 = northAreas.includes(city2);
  
  if (isNorth1 && isNorth2) {
    return Math.random() * 20 + 10;
  }
  
  const southAreas = ['באר שבע', 'אילת', 'דימונה', 'ערד', 'אשדוד', 'אשקלון', 'קרית גת', 'קרית מלאכי'];
  const isSouth1 = southAreas.includes(city1);
  const isSouth2 = southAreas.includes(city2);
  
  if (isSouth1 && isSouth2) {
    return Math.random() * 25 + 15;
  }
  
  return Math.random() * 50 + 30;
};

//  Retrieves basic event information for rides page
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

//  Checks if phone number exists for the event and returns guest data
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

// Returns fresh data from database including both offering and seeking guests
const getRidesGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Get all confirmed guests with ride info (both offering and seeking)
    const guests = await Guest.find({ 
      event: eventId,
      rsvpStatus: 'confirmed',
      'rideInfo.status': { $in: ['offering', 'seeking'] },
      'rideInfo.address': { $exists: true, $ne: '' }
    }).select('firstName lastName phone rideInfo').lean();
    
    res.json(guests);
  } catch (err) {
    console.error('Error fetching rides guests:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

//  Gets suggested rides based on location proximity
const getSuggestedRides = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, userAddress } = req.body;

    if (!phone || !userAddress) {
      return res.status(400).json({ message: req.t('events.rides.validation.missingParameters') });
    }

    const requestingGuest = await Guest.findOne({ event: eventId, phone });
    if (!requestingGuest) {
      return res.status(404).json({ message: req.t('events.rides.phoneNotFound') });
    }

    const offeringGuests = await Guest.find({
      event: eventId,
      phone: { $ne: phone },
      rsvpStatus: 'confirmed',
      'rideInfo.status': 'offering',
      'rideInfo.address': { $exists: true, $ne: '' }
    }).select('firstName lastName phone rideInfo').lean();

    offeringGuests.forEach(g => {
      console.log('Offering guest address:', g.rideInfo.address);
    });

    const guestsWithDistance = await Promise.all(
      offeringGuests.map(async (guest) => {
        const distance = await calculateDistance(userAddress, guest.rideInfo.address);
      return {
        ...guest,
        distance: `${distance.toFixed(1)} ק"מ`,
        numericDistance: distance
      };
    })
  );

    const sortedGuests = guestsWithDistance.sort((a, b) => a.numericDistance - b.numericDistance);

    const closeSuggestions = sortedGuests.filter(guest => guest.numericDistance < 25);
    
    const suggestions = closeSuggestions.slice(0, 3);

    res.json({ suggestions });
  } catch (err) {
    console.error('Error getting suggested rides:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};


// Updates guest ride information from interface
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

    if (rideInfo.status === 'offering') {
      updatedRideInfo.availableSeats = rideInfo.availableSeats || 1;
      updatedRideInfo.requiredSeats = undefined;
    }

    if (rideInfo.status === 'seeking') {
      updatedRideInfo.requiredSeats = rideInfo.requiredSeats || 1;
      updatedRideInfo.availableSeats = undefined;
    }

    if (guest.rideInfo && guest.rideInfo.contactHistory) {
      updatedRideInfo.contactHistory = guest.rideInfo.contactHistory;
    }

    if (guest.rideInfo && guest.rideInfo.contactStatus) {
      updatedRideInfo.contactStatus = guest.rideInfo.contactStatus;
    }

    guest.rideInfo = updatedRideInfo;
    await guest.save();

    res.json({ 
      message: req.t('events.features.rides.updateSuccess'), 
      guest: guest 
    });
  } catch (err) {
    console.error('Error updating guest ride info:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

//  Records contact action and updates both guests' statuses
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

//  Cancels an arranged ride
const cancelRide = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, contactedGuestId } = req.body;

    if (!phone || !contactedGuestId) {
      return res.status(400).json({ message: req.t('events.rides.validation.missingParameters') });
    }

    const guest = await Guest.findOne({ event: eventId, phone });
    const contactedGuest = await Guest.findById(contactedGuestId);

    if (!guest || !contactedGuest) {
      return res.status(404).json({ message: req.t('events.rides.guestNotFound') });
    }

    // Remove contact history entry for this guest
    if (guest.rideInfo && guest.rideInfo.contactHistory) {
      guest.rideInfo.contactHistory = guest.rideInfo.contactHistory.filter(
        contact => contact.contactedGuestId.toString() !== contactedGuestId
      );
    }

    // Reset the contacted guest's status
    if (contactedGuest.rideInfo) {
      contactedGuest.rideInfo.contactStatus = undefined;
    }

    await guest.save();
    await contactedGuest.save();

    res.json({ 
      message: req.t('events.rides.rideCancelled'),
      contactHistory: guest.rideInfo.contactHistory
    });
  } catch (err) {
    console.error('Error cancelling ride:', err);
    res.status(500).json({ message: req.t('events.rides.errors.serverError') });
  }
};

//  Updates guest ride information by event owner 
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

    if (rideInfo.status === 'offering') {
      updatedRideInfo.availableSeats = rideInfo.availableSeats || 1;
    }

    if (rideInfo.status === 'seeking') {
      updatedRideInfo.requiredSeats = rideInfo.requiredSeats || 1;
    }

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
  getSuggestedRides,
  updateGuestRideInfo,
  recordContact,
  cancelRide,
  updateGuestRideInfoByOwner
};