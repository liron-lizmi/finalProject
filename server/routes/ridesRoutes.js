/**
 * ridesRoutes.js - Ride Sharing Routes
 *
 * Handles all ride-sharing related endpoints for coordinating
 * transportation between event guests.
 *
 * Public Routes (no auth required - for guest self-service):
 * - GET /:eventId/info: Get event info for rides page
 * - POST /:eventId/check-phone: Verify guest by phone for rides
 * - GET /:eventId/guests: Get guests offering/seeking rides
 * - PUT /:eventId/update: Update own ride info (offer/seek)
 * - POST /:eventId/contact: Record contact between guests
 * - POST /:eventId/suggestions: Get suggested ride matches
 * - POST /:eventId/cancel: Cancel ride offer/request
 *
 */

const express = require('express');
const router = express.Router();
const {
  getEventRidesInfo,
  checkPhoneForRides,
  getRidesGuests,
  getSuggestedRides,
  updateGuestRideInfo,
  recordContact,
  cancelRide,
} = require('../controllers/ridesController');
const auth = require('../middleware/auth');

router.get('/:eventId/info', getEventRidesInfo);
router.post('/:eventId/check-phone', checkPhoneForRides);
router.get('/:eventId/guests', getRidesGuests);
router.put('/:eventId/update', updateGuestRideInfo);
router.post('/:eventId/contact', recordContact);
router.post('/:eventId/suggestions', getSuggestedRides);
router.post('/:eventId/cancel', cancelRide);

module.exports = router;