const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getEventGuests,
  addGuest,
  bulkImportGuests,
  updateGuest,
  deleteGuest,
  updateGuestRSVP,
  getEventGroups,
  getGuestStats,
  updateGuestRSVPPublic,
  getEventForRSVP,
  checkGuestByPhone,
  generateRSVPLink
} = require('../controllers/guestController');
const auth = require('../middleware/auth');

// Public RSVP routes
router.get('/:eventId/rsvp-info', getEventForRSVP);         
router.post('/:eventId/check-phone', checkGuestByPhone);    
router.put('/:eventId/rsvp-public', updateGuestRSVPPublic); 

// Protected routes
router.use(auth);

// Guest management routes
router.get('/', getEventGuests);               
router.post('/', addGuest);
router.post('/bulk-import', bulkImportGuests);                      
router.put('/:guestId', updateGuest);               
router.delete('/:guestId', deleteGuest);            

// RSVP routes
router.put('/:guestId/rsvp', updateGuestRSVP);      
router.get('/rsvp-link', generateRSVPLink);    

// Statistics and groups routes
router.get('/groups', getEventGroups);              
router.get('/stats', getGuestStats);               

module.exports = router;