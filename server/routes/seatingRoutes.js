const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getSeatingArrangement,
  saveSeatingArrangement,
  generateAISeating,
  exportSeatingChart,
  getSeatingStatistics,
  deleteSeatingArrangement,
  validateSeatingArrangement,
  getSeatingSubgestions,
  cloneSeatingArrangement
} = require('../controllers/seatingController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Main seating routes
router.get('/', getSeatingArrangement);                    // GET /api/events/:eventId/seating
router.post('/', saveSeatingArrangement);                  // POST /api/events/:eventId/seating
router.delete('/', deleteSeatingArrangement);              // DELETE /api/events/:eventId/seating

// AI seating generation
router.post('/ai-generate', generateAISeating);            // POST /api/events/:eventId/seating/ai-generate

// Export functionality
router.post('/export', exportSeatingChart);                // POST /api/events/:eventId/seating/export?format=pdf|excel|png

// Statistics and validation
router.get('/statistics', getSeatingStatistics);           // GET /api/events/:eventId/seating/statistics
router.post('/validate', validateSeatingArrangement);      // POST /api/events/:eventId/seating/validate

// Guest suggestions
router.get('/suggestions', getSeatingSubgestions);         // GET /api/events/:eventId/seating/suggestions?guestId=...

// Clone seating arrangement
router.post('/clone', cloneSeatingArrangement);            // POST /api/events/:eventId/seating/clone

module.exports = router;