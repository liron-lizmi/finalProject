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