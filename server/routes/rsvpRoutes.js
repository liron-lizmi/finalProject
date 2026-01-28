/**
 * rsvpRoutes.js - Public RSVP Routes
 *
 * Handles public RSVP endpoints that allow guests to respond
 * to event invitations without authentication.
 *
 * All routes are PUBLIC (no authentication required):
 * - GET /:eventId/info: Get event details for RSVP page (title, date, venue)
 * - POST /:eventId/check-phone: Verify guest identity by phone number
 * - PUT /:eventId/submit: Submit RSVP response (attendance, guest count)
 *
 * Flow:
 * 1. Guest receives RSVP link with eventId
 * 2. GET /info displays event details
 * 3. POST /check-phone verifies guest's phone number
 * 4. PUT /submit records RSVP response
 *
 * Note: Uses guestController handlers shared with guestRoutes
 */

const express = require('express');
const router = express.Router();
const {
  getEventForRSVP,
  checkGuestByPhone,
  updateGuestRSVPPublic
} = require('../controllers/guestController');

// Public RSVP routes (no authentication required)
router.get('/:eventId/info', getEventForRSVP);          
router.post('/:eventId/check-phone', checkGuestByPhone); 
router.put('/:eventId/submit', updateGuestRSVPPublic);   

module.exports = router;