const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
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
router.get('/event/:eventId', getEventTasks);
router.get('/event/:eventId/statistics', getTasksStatistics);
router.post('/event/:eventId', createTask);
router.put('/event/:eventId/:taskId', updateTask);
router.patch('/event/:eventId/:taskId/status', updateTaskStatus);
router.delete('/event/:eventId/:taskId', deleteTask);

// Google Calendar integration routes
router.get('/google-calendar/status', getGoogleCalendarStatus);
router.get('/google-calendar/auth-url', getGoogleAuthUrl);
router.post('/google-calendar/callback', handleGoogleCallback);
router.delete('/google-calendar/disconnect', disconnectGoogleCalendar);
router.post('/event/:eventId/sync-calendar', syncWithGoogleCalendar);

module.exports = router;