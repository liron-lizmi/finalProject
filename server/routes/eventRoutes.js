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

const guestRoutes = require('./guestRoutes');

router.use('/:eventId/guests', (req, res, next) => {
  req.eventId = req.params.eventId;
  next();
}, guestRoutes);

router.use(auth);

// Event routes
router.get('/', getUserEvents);
router.get('/:id', getEventById);
router.post('/', createEvent);
router.put('/:id', updateEvent);
router.delete('/:id', deleteEvent);

module.exports = router;