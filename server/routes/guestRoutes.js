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
  generateRSVPLink,
  updateGuestGift,
  getSeatingSync,
  markSyncProcessed
} = require('../controllers/guestController');

const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

// Public RSVP routes
router.get('/:eventId/rsvp-info', getEventForRSVP);         
router.post('/:eventId/check-phone', checkGuestByPhone);
router.put('/:eventId/rsvp-public', updateGuestRSVPPublic); 

// Protected routes
router.use(auth);

// Guest management routes
router.get('/', checkViewPermission, getEventGuests);               
router.post('/', checkEditPermission, addGuest);
router.post('/bulk-import', checkEditPermission, bulkImportGuests);                      
router.put('/:guestId', checkEditPermission, updateGuest);               
router.delete('/:guestId', checkEditPermission, deleteGuest);            

// RSVP routes
router.put('/:guestId/rsvp', checkEditPermission, updateGuestRSVP);      
router.get('/rsvp-link', checkViewPermission, generateRSVPLink);  

// Statistics and groups routes
router.get('/groups', checkViewPermission, getEventGroups);              
router.get('/stats', checkViewPermission, getGuestStats);  

// Gift routes
router.put('/:guestId/gift', checkEditPermission, updateGuestGift);

// Sync routes - new routes
router.get('/sync/status', getSeatingSync);
router.post('/sync/processed', markSyncProcessed);

module.exports = router;