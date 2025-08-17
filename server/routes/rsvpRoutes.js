// server/routes/rsvpRoutes.js
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