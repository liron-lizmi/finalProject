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
  moveAffectedGuestsToUnassigned,
  suggestTables
} = require('../controllers/seatingController');
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');

router.use(auth);

router.get('/', checkViewPermission, getSeatingArrangement); 
router.post('/', checkEditPermission, saveSeatingArrangement); 
router.delete('/', checkEditPermission, deleteSeatingArrangement); 

router.post('/ai-generate', checkEditPermission, generateAISeating); 
router.post('/suggest-tables', checkViewPermission, suggestTables);

router.post('/export', checkViewPermission, exportSeatingChart); 

router.get('/statistics', checkViewPermission, getSeatingStatistics); 
router.post('/validate', checkViewPermission, validateSeatingArrangement); 

router.get('/suggestions', checkViewPermission, getSeatingSubjestions); 

router.post('/clone', checkEditPermission, cloneSeatingArrangement); 

router.post('/sync/process', checkEditPermission, processSeatingSync);
router.post('/sync/propose-options', checkViewPermission, proposeSyncOptions);
router.post('/sync/apply-option', checkEditPermission, applySyncOption);
router.post('/sync/move-to-unassigned', checkEditPermission, moveAffectedGuestsToUnassigned);
router.put('/sync/settings', checkEditPermission, updateSyncSettings);
router.get('/sync/status', checkViewPermission, getSyncStatus);

module.exports = router;