// routes/venueRoutes.js
const express = require('express');
const router = express.Router();
const {
  searchVenues,
  getVenueById,
  searchPlacesAPI,
  getPlaceDetails,
  saveVenue
} = require('../controllers/venueController');
const auth = require('../middleware/auth');

// חיפוש מקומות אירועים מהמאגר המקומי
router.get('/search', searchVenues);

// קבלת פרטי מקום ספציפי
router.get('/:id', getVenueById);

// חיפוש מקומות דרך Google Places API
router.get('/api/search', searchPlacesAPI);

// קבלת פרטים מורחבים מ-Google Places API
router.get('/api/details/:placeId', getPlaceDetails);

// שמירת מקום חדש (דורש התחברות)
router.post('/', auth, saveVenue);

module.exports = router;