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
  cloneSeatingArrangement,
  processSeatingSync,
  updateSyncSettings,
  getSyncStatus,
  proposeSyncOptions,
  applySyncOption,
  moveAffectedGuestsToUnassigned
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

// Sync functionality - new routes
router.post('/sync/process', processSeatingSync);
router.post('/sync/propose-options', proposeSyncOptions);
router.post('/sync/apply-option', applySyncOption);
router.post('/sync/move-to-unassigned', moveAffectedGuestsToUnassigned);
router.put('/sync/settings', updateSyncSettings);
router.get('/sync/status', getSyncStatus);

module.exports = router;