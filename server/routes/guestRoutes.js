/**
 * guestRoutes.js - Guest Management Routes
 *
 * Handles all guest-related endpoints for event guest management.
 * Mounted as nested router under /events/:eventId/guests
 *
 * Public Routes (no auth required):
 * - GET /:eventId/rsvp-info: Get event info for RSVP page
 * - POST /:eventId/check-phone: Verify guest by phone number
 * - PUT /:eventId/rsvp-public: Submit RSVP response publicly
 *
 * Protected Routes (requires auth):
 *
 * Guest CRUD:
 * - GET /: Get all guests for event (view permission)
 * - POST /: Add new guest (edit permission)
 * - POST /bulk-import: Import multiple guests (edit permission)
 * - PUT /:guestId: Update guest (edit permission)
 * - DELETE /:guestId: Delete guest (edit permission)
 *
 * RSVP Management:
 * - PUT /:guestId/rsvp: Update RSVP status (edit permission)
 * - GET /rsvp-link: Generate public RSVP link (view permission)
 *
 * Statistics & Groups:
 * - GET /groups: Get unique groups list (view permission)
 * - GET /stats: Get guest statistics (view permission)
 *
 * Gifts:
 * - PUT /:guestId/gift: Update gift info (edit permission)
 *
 * Sync (for seating):
 * - GET /sync/status: Get pending sync triggers
 * - POST /sync/processed: Mark sync as processed
 */

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
  markSyncProcessed,
  getGoogleContacts
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

// Google Contacts route
router.post('/google-contacts', checkViewPermission, getGoogleContacts);

// Sync routes - new routes
router.get('/sync/status', getSeatingSync);
router.post('/sync/processed', markSyncProcessed);

module.exports = router;