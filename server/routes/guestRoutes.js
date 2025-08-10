const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getEventGuests,
  addGuest,
  updateGuest,
  deleteGuest,
  updateGuestRSVP,
  getEventGroups,
  getGuestStats
} = require('../controllers/guestController');
const auth = require('../middleware/auth');

// Enabling authentication middleware for all routes
router.use(auth);

// Guest management routes
router.get('/', getEventGuests);                    // GET /api/events/:eventId/guests
router.post('/', addGuest);                         // POST /api/events/:eventId/guests
router.put('/:guestId', updateGuest);               // PUT /api/events/:eventId/guests/:guestId
router.delete('/:guestId', deleteGuest);            // DELETE /api/events/:eventId/guests/:guestId

// RSVP routes
router.put('/:guestId/rsvp', updateGuestRSVP);      // PUT /api/events/:eventId/guests/:guestId/rsvp

// Statistics and groups routes
router.get('/groups', getEventGroups);              // GET /api/events/:eventId/guests/groups
router.get('/stats', getGuestStats);                // GET /api/events/:eventId/guests/stats

module.exports = router;