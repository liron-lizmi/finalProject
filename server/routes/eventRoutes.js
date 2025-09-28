const express = require('express');
const router = express.Router();
const {
  getUserEvents,
  createEvent,
  updateEvent,
  deleteEvent,
  getEventById,
  checkEditPermission,
  getNotifications,
  markNotificationRead,
  acceptNotificationAndShare
} = require('../controllers/eventController');

const {
  shareEvent,
  getSharedUsers,
  removeShare,
  updateSharePermission,
  acceptShare
} = require('../controllers/shareController');

const auth = require('../middleware/auth');
const { checkEditPermission: checkEditPermissionMiddleware, checkViewPermission } = require('../middleware/checkPermissions');

// Import nested routers
const guestRoutes = require('./guestRoutes');
const seatingRoutes = require('./seatingRoutes');
const budgetRoutes = require('./budgetRoutes');

// All routes require authentication
router.use(auth);

// Notification routes
router.get('/notifications', getNotifications);
router.put('/notifications/:notificationId/read', markNotificationRead);
router.put('/notifications/:notificationId/accept', acceptNotificationAndShare);

// Event CRUD routes
router.get('/', getUserEvents);
router.post('/', createEvent);
router.get('/:id', checkViewPermission, getEventById);
router.put('/:id', checkEditPermissionMiddleware, updateEvent);
router.delete('/:id', deleteEvent);

// Permission check route
router.get('/:id/edit-permission', checkEditPermission);

// Sharing routes
router.post('/:eventId/share', checkEditPermissionMiddleware, shareEvent);
router.get('/:eventId/shared-users', checkViewPermission, getSharedUsers);
router.delete('/:eventId/share/:shareId', checkEditPermissionMiddleware, removeShare);
router.put('/:eventId/share/:shareId', checkEditPermissionMiddleware, updateSharePermission);

// Nested routes with permission checking
router.use('/:eventId/guests', guestRoutes);
router.use('/:eventId/seating', seatingRoutes);
router.use('/:eventId/budget', budgetRoutes);

module.exports = router;