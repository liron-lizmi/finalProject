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
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

// All routes require authentication
router.use(auth);

// Main seating routes
router.get('/', checkViewPermission, getSeatingArrangement); 
router.post('/', checkEditPermission, saveSeatingArrangement); 
router.delete('/', checkEditPermission, deleteSeatingArrangement); 

// AI seating generation
router.post('/ai-generate', checkEditPermission, generateAISeating); 

// Export functionality
router.post('/export', checkViewPermission, exportSeatingChart); 

// Statistics and validation
router.get('/statistics', checkViewPermission, getSeatingStatistics); 
router.post('/validate', checkViewPermission, validateSeatingArrangement); 

// Guest suggestions
router.get('/suggestions', checkViewPermission, getSeatingSubjestions); 

// Clone seating arrangement
router.post('/clone', checkEditPermission, cloneSeatingArrangement); 

// Sync functionality - new routes
router.post('/sync/process', checkEditPermission, processSeatingSync);
router.post('/sync/propose-options', checkViewPermission, proposeSyncOptions);
router.post('/sync/apply-option', checkEditPermission, applySyncOption);
router.post('/sync/move-to-unassigned', checkEditPermission, moveAffectedGuestsToUnassigned);
router.put('/sync/settings', checkEditPermission, updateSyncSettings);
router.get('/sync/status', checkViewPermission, getSyncStatus);

module.exports = router;