/**
 * venueRoutes.js - Venue Routes
 *
 * Handles venue search via Google Places API and event venue management.
 * Can be used standalone (/api/venues) or nested (/events/:eventId/venue).
 *
 * Public Routes (no auth required):
 * - GET /search: Search venues via Google Places API with filters
 * - GET /details/:placeId: Get detailed venue info by Google Place ID
 *
 * Protected Routes (requires auth):
 * Event Venue CRUD (requires auth + permissions):
 * - GET /: Get venue saved to event (view permission)
 * - POST /: Set venue for event (edit permission)
 * - DELETE /: Remove venue from event (edit permission)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  searchVenues,
  getVenueDetails,
  getEventVenue,
  setEventVenue,
  deleteEventVenue
} = require('../controllers/venueController');
const venueController = require('../controllers/venueController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.get('/search', searchVenues);
router.get('/details/:placeId', getVenueDetails);

router.get('/', auth, checkViewPermission, getEventVenue);
router.post('/', auth, checkEditPermission, setEventVenue);
router.delete('/', auth, checkEditPermission, deleteEventVenue);

module.exports = router;