/**
 * venueRoutes.js - Venue Search Routes
 *
 * Handles venue search and discovery via Google Places API.
 * All routes are public (no authentication required).
 *
 * Routes:
 * - GET /search: Search venues with filters (type, area, style, amenities)
 *   Query params: query, area, venueType, venueStyle, parking, accessibility,
 *                 outdoorSpace, catering, page, language
 * - GET /details/:placeId: Get detailed venue info by Google Place ID
 *   Returns: name, address, phone, website, photos, rating, reviews, hours
 */

const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');

router.get('/search', venueController.searchVenues);
router.get('/details/:placeId', venueController.getVenueDetails);

module.exports = router;