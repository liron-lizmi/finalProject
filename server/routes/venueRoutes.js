const express = require('express');
const router = express.Router();
const venueController = require('../controllers/venueController');

router.get('/search', venueController.searchVenues);
router.get('/details/:placeId', venueController.getVenueDetails);

module.exports = router;