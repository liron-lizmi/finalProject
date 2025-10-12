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

router.get('/search', searchVendors);
router.get('/details/:placeId', getVendorDetailsByPlaceId);
router.get('/cache/stats', auth, getCacheStats);

router.get('/', auth, getEventVendors);
router.post('/', auth, addVendor);
router.put('/:vendorId', auth, updateVendor);
router.delete('/:vendorId', auth, deleteVendor);

module.exports = router;