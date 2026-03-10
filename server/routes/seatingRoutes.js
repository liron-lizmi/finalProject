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
 *
 * Export & Validation:
 * - POST /export: Export seating chart as PDF/image (view permission)
 * Sync with Guest Changes:
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
  deleteSeatingArrangement,
  processSeatingSync,
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

router.post('/sync/process', checkEditPermission, processSeatingSync);
router.post('/sync/apply-option', checkEditPermission, applySyncOption);
router.post('/sync/move-to-unassigned', checkEditPermission, moveAffectedGuestsToUnassigned);

module.exports = router;