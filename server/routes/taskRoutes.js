/**
 * taskRoutes.js - Task Management Routes
 *
 * Handles all task-related endpoints for event planning task management
 * with Google Calendar integration.
 *
 * All routes require authentication (auth middleware applied globally).
 *
 * Task CRUD:
 * - GET /event/:eventId: Get all tasks for event (view permission)
 * - GET /event/:eventId/statistics: Get task statistics (view permission)
 * - POST /event/:eventId: Create new task (edit permission)
 * - PUT /event/:eventId/:taskId: Update task (edit permission)
 * - PATCH /event/:eventId/:taskId/status: Update task status only (edit permission)
 * - DELETE /event/:eventId/:taskId: Delete task (edit permission)
 *
 * Google Calendar Integration:
 * - GET /google-calendar/status: Check if Google Calendar is connected
 * - GET /google-calendar/auth-url: Get OAuth authorization URL
 * - POST /google-calendar/callback: Handle OAuth callback with auth code
 * - DELETE /google-calendar/disconnect: Disconnect Google Calendar
 * - POST /event/:eventId/sync-calendar: Sync event tasks to Google Calendar
 */

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { checkEditPermission, checkViewPermission } = require('../middleware/checkPermissions');
const {
  getEventTasks,
  createTask,
  updateTask,
  deleteTask,
  updateTaskStatus,
  getTasksStatistics,
  getGoogleCalendarStatus,
  getGoogleAuthUrl,
  handleGoogleCallback,
  disconnectGoogleCalendar,
  syncWithGoogleCalendar
} = require('../controllers/taskController');

router.use(auth);

// Task CRUD routes
router.get('/event/:eventId', checkViewPermission, getEventTasks);
router.get('/event/:eventId/statistics', checkViewPermission, getTasksStatistics);
router.post('/event/:eventId', checkEditPermission, createTask);
router.put('/event/:eventId/:taskId', checkEditPermission, updateTask);
router.patch('/event/:eventId/:taskId/status', checkEditPermission, updateTaskStatus);
router.delete('/event/:eventId/:taskId', checkEditPermission, deleteTask);

// Google Calendar integration routes
router.get('/google-calendar/status', getGoogleCalendarStatus);
router.get('/google-calendar/auth-url', getGoogleAuthUrl);
router.post('/google-calendar/callback', handleGoogleCallback);
router.delete('/google-calendar/disconnect', disconnectGoogleCalendar);
router.post('/event/:eventId/sync-calendar', checkEditPermission, syncWithGoogleCalendar);

module.exports = router;