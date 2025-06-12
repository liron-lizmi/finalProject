const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getEventGuests,
  addGuest,
  deleteGuest,
  updateGuestRSVP
} = require('../controllers/guestController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', getEventGuests);
router.post('/', addGuest);
router.delete('/:guestId', deleteGuest);
router.put('/:guestId/rsvp', updateGuestRSVP);

module.exports = router;