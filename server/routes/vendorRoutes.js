/**
 * vendorRoutes.js - Vendor Management Routes
 *
 * Handles vendor search via Google Places API and event vendor management.
 * Can be used standalone (/api/vendors) or nested (/events/:eventId/vendors).
 *
 * Public Routes (no auth required):
 * - GET /search: Search vendors via Google Places API with filters
 * - GET /details/:placeId: Get detailed vendor info by Google Place ID
 *
 * Protected Routes (requires auth):
 * - GET /cache/stats: Get vendor cache statistics
 *
 * Event Vendor CRUD (requires auth + permissions):
 * - GET /: Get vendors saved to event (view permission)
 * - POST /: Add vendor to event (edit permission)
 * - PUT /:vendorId: Update event vendor (edit permission)
 * - DELETE /:vendorId: Remove vendor from event (edit permission)
 */

const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getEventVendors,
  addVendor,
  updateVendor,
  deleteVendor,
  searchVendors,
  getCacheStats,
  getVendorDetailsByPlaceId
} = require('../controllers/vendorController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.get('/search', searchVendors);
router.get('/details/:placeId', getVendorDetailsByPlaceId);
router.get('/cache/stats', auth, getCacheStats);

router.get('/', auth, checkViewPermission, getEventVendors);
router.post('/', auth, checkEditPermission, addVendor);
router.put('/:vendorId', auth, checkEditPermission, updateVendor);
router.delete('/:vendorId', auth, checkEditPermission, deleteVendor);

module.exports = router;