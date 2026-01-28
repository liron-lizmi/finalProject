/**
 * seatingRoutes.js - Seating Arrangement Routes
 *
 * Handles all seating-related endpoints for event seating management.
 * Mounted as nested router under /events/:eventId/seating
 *
 * All routes require authentication (auth middleware applied globally).
 *
 * Seating CRUD:
 * - GET /: Get seating arrangement (view permission)
 * - POST /: Save seating arrangement (edit permission)
 * - DELETE /: Delete seating arrangement (edit permission)
 *
 * AI & Suggestions:
 * - POST /ai-generate: Generate AI seating arrangement (edit permission)
 * - POST /suggest-tables: Get table configuration suggestions (view permission)
 * - GET /suggestions: Get seating improvement suggestions (view permission)
 *
 * Export & Validation:
 * - POST /export: Export seating chart as PDF/image (view permission)
 * - GET /statistics: Get seating statistics (view permission)
 * - POST /validate: Validate seating arrangement (view permission)
 *
 * Cloning:
 * - POST /clone: Clone seating arrangement (edit permission)
 *
 * Sync with Guest Changes:
 * - POST /sync/process: Process pending guest changes (edit permission)
 * - POST /sync/propose-options: Get sync options for changes (view permission)
 * - POST /sync/apply-option: Apply selected sync option (edit permission)
 * - POST /sync/move-to-unassigned: Move affected guests to unassigned (edit permission)
 * - PUT /sync/settings: Update sync settings (edit permission)
 * - GET /sync/status: Get sync status (view permission)
 */

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

router.use((req, res, next) => {
  next();
});

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