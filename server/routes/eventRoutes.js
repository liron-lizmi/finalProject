// routes/eventRoutes.js
const express = require('express');
const router = express.Router();
const { 
  getUserEvents, 
  createEvent, 
  updateEvent, 
  deleteEvent, 
  getEventById 
} = require('../controllers/eventController');
const auth = require('../middleware/auth');

const vendorRoutes = require('./vendorRoutes');
router.use('/:eventId/vendors', vendorRoutes);

router.use(auth);

router.get('/', getUserEvents);

router.get('/:id', getEventById);

router.post('/', createEvent);

router.put('/:id', updateEvent);

router.delete('/:id', deleteEvent);

module.exports = router;