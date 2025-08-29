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
  getSeatingSubjestions,
  cloneSeatingArrangement
} = require('../controllers/seatingController');
const auth = require('../middleware/auth');

// All routes require authentication
router.use(auth);

// Main seating routes
router.get('/', getSeatingArrangement); 
router.post('/', saveSeatingArrangement); 
router.delete('/', deleteSeatingArrangement); 

// AI seating generation
router.post('/ai-generate', generateAISeating); 

// Export functionality
router.post('/export', exportSeatingChart); 

// Statistics and validation
router.get('/statistics', getSeatingStatistics); 
router.post('/validate', validateSeatingArrangement); 

// Guest suggestions
router.get('/suggestions', getSeatingSubjestions); 

// Clone seating arrangement
router.post('/clone', cloneSeatingArrangement); 

module.exports = router;