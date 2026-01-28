/**
 * eventRoutes.js - Event Management Routes (Main Router)
 *
 * Central router for all event-related operations including CRUD,
 * sharing, notifications, and nested resource routes.
 *
 * All routes require authentication (auth middleware applied globally).
 *
 * Notification Routes:
 * - GET /notifications: Get user's notifications
 * - PUT /notifications/:notificationId/read: Mark notification as read
 * - PUT /notifications/:notificationId/accept: Accept share invitation
 *
 * Event CRUD:
 * - GET /: Get all events for current user (owned + shared)
 * - POST /: Create new event
 * - GET /:id: Get single event (view permission)
 * - PUT /:id: Update event (edit permission)
 * - DELETE /:id: Delete event (owner only)
 * - GET /:id/edit-permission: Check if user can edit
 *
 * Sharing Routes (owner only):
 * - POST /:eventId/share: Share event with user
 * - GET /:eventId/shared-users: Get list of shared users
 * - DELETE /:eventId/share/:shareId: Remove share
 * - PUT /:eventId/share/:shareId: Update share permission
 *
 * Nested Routes:
 * - /events/:eventId/guests → guestRoutes
 * - /events/:eventId/seating → seatingRoutes
 * - /events/:eventId/budget → budgetRoutes
 */

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
const { checkEditPermission: checkEditPermissionMiddleware, checkViewPermission, checkIsEventOwner } = require('../middleware/checkPermissions');

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
router.post('/:eventId/share', checkIsEventOwner, shareEvent);
router.get('/:eventId/shared-users', checkViewPermission, getSharedUsers);
router.delete('/:eventId/share/:shareId', checkIsEventOwner, removeShare);
router.put('/:eventId/share/:shareId', checkIsEventOwner, updateSharePermission);

// Nested routes with permission checking
router.use('/:eventId/guests', guestRoutes);
router.use('/:eventId/seating', seatingRoutes);
router.use('/:eventId/budget', budgetRoutes);

module.exports = router;