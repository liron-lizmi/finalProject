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
  updateGuestRideInfoByOwner
} = require('../controllers/ridesController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.get('/:eventId/info', getEventRidesInfo);
router.post('/:eventId/check-phone', checkPhoneForRides);
router.get('/:eventId/guests', getRidesGuests);
router.put('/:eventId/update', updateGuestRideInfo);
router.post('/:eventId/contact', recordContact);
router.post('/:eventId/suggestions', getSuggestedRides);
router.post('/:eventId/cancel', cancelRide);

router.put('/:eventId/guests/:guestId/ride-info', auth, checkEditPermission, updateGuestRideInfoByOwner);

module.exports = router;