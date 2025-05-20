// routes/vendorRoutes.js
const express = require('express');
const router = express.Router({ mergeParams: true }); 
const { 
  getEventVendors,
  addVendor,
  updateVendor,
  deleteVendor
} = require('../controllers/vendorController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', getEventVendors);
router.post('/', addVendor);

router.put('/:vendorId', updateVendor);
router.delete('/:vendorId', deleteVendor);

module.exports = router;