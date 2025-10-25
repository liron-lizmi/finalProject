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