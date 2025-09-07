const express = require('express');
const router = express.Router();
const {
  getEventRidesInfo,
  checkPhoneForRides,
  getRidesGuests,
  updateGuestRideInfo,
  recordContact,
  updateGuestRideInfoByOwner
} = require('../controllers/ridesController');
const auth = require('../middleware/auth');

router.get('/:eventId/info', getEventRidesInfo);
router.post('/:eventId/check-phone', checkPhoneForRides);
router.get('/:eventId/guests', getRidesGuests);
router.put('/:eventId/update', updateGuestRideInfo);
router.post('/:eventId/contact', recordContact);

router.put('/:eventId/guests/:guestId/ride-info', auth, updateGuestRideInfoByOwner);

module.exports = router;