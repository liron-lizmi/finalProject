// controllers/venueController.js
const Venue = require('../models/Venue');
const axios = require('axios');

// הגדרת מפתח ה-API של גוגל
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// המרת כתובת לקואורדינטות גיאוגרפיות
const geocodeAddress = async (req, res) => {
  const { address } = req.query;

  if (!address) {
    return res.status(400).json({ message: 'נדרשת כתובת להמרה' });
  }

  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${GOOGLE_MAPS_API_KEY}&language=iw`
    );

    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const result = response.data.results[0];
      res.json({
        location: result.geometry.location,
        formattedAddress: result.formatted_address,
        placeId: result.place_id
      });
    } else {
      res.status(404).json({ message: 'לא נמצאו תוצאות לכתובת זו' });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({ message: 'שגיאה בהמרת הכתובת' });
  }
};

// חיפוש מקומות אירועים
const searchVenues = async (req, res) => {
  try {
    const {
      capacity,
      eventType,
      location,
      priceRange,
      radius = 50000, // ברירת מחדל: 50 ק"מ
      keyword
    } = req.query;

    // בניית השאילתא
    const query = {};

    // טווח קיבולת
    if (capacity) {
      const capacityNum = parseInt(capacity);
      query['capacity.max'] = { $gte: capacityNum };
      query['capacity.min'] = { $lte: capacityNum };
    }

    // סוג אירוע
    if (eventType) {
      query.eventTypes = eventType;
    }

    // טווח מחירים
    if (priceRange) {
      const [min, max] = priceRange.split('-').map(p => parseInt(p));
      if (min) query['priceRange.min'] = { $lte: max || 1000000 };
      if (max) query['priceRange.max'] = { $gte: min || 0 };
    }

    // חיפוש לפי מילות מפתח
    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: 'i' } },
        { address: { $regex: keyword, $options: 'i' } }
      ];
    }

    // חיפוש לפי מיקום ורדיוס
    if (location) {
      const [lng, lat] = location.split(',').map(coord => parseFloat(coord));
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: parseInt(radius)
        }
      };
    }

    const venues = await Venue.find(query).limit(20);

    res.json({
      count: venues.length,
      venues
    });
  } catch (error) {
    console.error('Venue search error:', error);
    res.status(500).json({ message: 'שגיאה בחיפוש מקומות אירועים' });
  }
};

// השג פרטים של מקום אירועים ספציפי
const getVenueById = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);
    
    if (!venue) {
      return res.status(404).json({ message: 'מקום האירועים לא נמצא' });
    }
    
    res.json(venue);
  } catch (error) {
    console.error('Get venue error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת פרטי מקום האירועים' });
  }
};

// חיפוש מקומות באמצעות Google Places API
const searchPlacesAPI = async (req, res) => {
  try {
    const { query, location, radius = 10000, type = 'restaurant,event_venue' } = req.query;
    
    if (!query && !location) {
      return res.status(400).json({ message: 'נדרש מידע לחיפוש (מילת חיפוש או מיקום)' });
    }
    
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?key=${GOOGLE_MAPS_API_KEY}&language=iw`;
    
    if (query) {
      url += `&query=${encodeURIComponent(query + ' אירועים')}`;
    }
    
    if (location) {
      url += `&location=${location}&radius=${radius}`;
    }
    
    if (type) {
      url += `&type=${type}`;
    }
    
    const response = await axios.get(url);
    
    res.json(response.data);
  } catch (error) {
    console.error('Places API search error:', error);
    res.status(500).json({ message: 'שגיאה בחיפוש מקומות' });
  }
};

// קבלת פרטים מורחבים על מקום מ-Google Places API
const getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.params;
    
    if (!placeId) {
      return res.status(400).json({ message: 'נדרש מזהה מקום' });
    }
    
    const url = `https://maps.googleapis.com/maps/api/place/details/json?key=${GOOGLE_MAPS_API_KEY}&place_id=${placeId}&language=iw&fields=name,formatted_address,geometry,photos,formatted_phone_number,website,rating,reviews,opening_hours,price_level`;
    
    const response = await axios.get(url);
    
    // בדיקה אם המקום כבר נשמר במסד הנתונים
    const existingVenue = await Venue.findOne({ placeId });
    
    res.json({
      placeDetails: response.data.result,
      isSaved: !!existingVenue,
      savedVenue: existingVenue
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({ message: 'שגיאה בטעינת פרטי המקום' });
  }
};

// שמירת מקום חדש במסד הנתונים (כולל מידע מ-Google Places)
const saveVenue = async (req, res) => {
  try {
    const {
      name,
      placeId,
      address,
      location,
      phone,
      website,
      capacity,
      priceRange,
      venueType,
      eventTypes,
      amenities,
      photos
    } = req.body;
    
    // בדיקה אם המקום כבר קיים
    const existingVenue = await Venue.findOne({ placeId });
    
    if (existingVenue) {
      return res.status(400).json({ message: 'מקום אירועים זה כבר קיים במערכת' });
    }
    
    const newVenue = new Venue({
      name,
      placeId,
      address,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      },
      phone,
      website,
      capacity,
      priceRange,
      venueType,
      eventTypes,
      amenities,
      photos
    });
    
    await newVenue.save();
    
    res.status(201).json({
      message: 'מקום האירועים נשמר בהצלחה',
      venue: newVenue
    });
  } catch (error) {
    console.error('Save venue error:', error);
    res.status(500).json({ message: 'שגיאה בשמירת מקום האירועים' });
  }
};

module.exports = {
  geocodeAddress,
  searchVenues,
  getVenueById,
  searchPlacesAPI,
  getPlaceDetails,
  saveVenue
};