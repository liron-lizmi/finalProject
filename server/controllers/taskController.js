const Task = require('../models/Task');
const Event = require('../models/Event');
const User = require('../models/User');
const mongoose = require('mongoose');
const googleCalendar = require('../services/googleCalendar');

const processedCodes = new Set();

const getEventTasks = async (req, res) => {
  try {
    const { eventId } = req.params;
    let actualEventId = eventId;

    let event = await Event.findOne({ _id: eventId, user: req.userId }).lean();
    
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      }).lean();
      
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const tasks = await Task.find({ event: actualEventId })
      .select('title description dueDate dueTime priority status category reminderDate reminderTime reminderRecurrence notes createdAt')
      .sort({ dueDate: 1, priority: -1, createdAt: -1 })
      .lean();

    res.json(tasks);
  } catch (err) {
    console.error('Error fetching tasks:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const createTask = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    let actualEventId = eventId;
    let originalOwnerId = req.userId;
    let eventForValidation = null;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
      const originalEvent = await Event.findById(event.originalEvent);
      originalOwnerId = originalEvent.user;
      eventForValidation = originalEvent;
    } else if (!event) {
      const sharedEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      
      if (!sharedEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      const userShare = sharedEvent.sharedWith.find(share => 
        share.userId.toString() === req.userId.toString()
      );
      
      if (!userShare || userShare.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
      
      actualEventId = eventId;
      originalOwnerId = sharedEvent.user;
      eventForValidation = sharedEvent;
    } else {
      eventForValidation = event;
    }

    const { 
      title, 
      description, 
      dueDate, 
      dueTime,
      priority, 
      category, 
      reminderDate,
      reminderTime,
      reminderRecurrence,
      notes
    } = req.body;

    if (!dueDate) {
      return res.status(400).json({ 
        message: req.t('events.validation.taskDueDateRequired') 
      });
    }

    const taskDueDate = new Date(dueDate);
    if (isNaN(taskDueDate.getTime())) {
      return res.status(400).json({ 
        message: req.t('events.validation.invalidDueDate') 
      });
    }

    const eventDate = new Date(eventForValidation.date);
    eventDate.setHours(0, 0, 0, 0);
    taskDueDate.setHours(0, 0, 0, 0);
    
    if (taskDueDate > eventDate) {
      return res.status(400).json({ 
        message: req.t('events.validation.dueDateAfterEvent')
      });
    }

    if (reminderDate) {
      const taskReminderDate = new Date(reminderDate);
      if (isNaN(taskReminderDate.getTime())) {
        return res.status(400).json({ 
          message: req.t('events.validation.invalidReminderDate') 
        });
      }

      const reminderDateTime = new Date(taskReminderDate);
      const dueDateTime = new Date(dueDate);

      if (reminderTime) {
        const [reminderHour, reminderMinute] = reminderTime.split(':');
        reminderDateTime.setHours(parseInt(reminderHour), parseInt(reminderMinute), 0, 0);
      }

      if (dueTime) {
        const [dueHour, dueMinute] = dueTime.split(':');
        dueDateTime.setHours(parseInt(dueHour), parseInt(dueMinute), 0, 0);
      }

      if (reminderDateTime >= dueDateTime) {
        return res.status(400).json({ 
          message: req.t('events.validation.reminderBeforeDue') 
        });
      }
    }

    const newTask = new Task({
      title,
      description,
      dueDate: taskDueDate,
      dueTime: dueTime || '09:00',
      priority: priority || 'medium',
      category: category || 'other',
      reminderDate: reminderDate ? new Date(reminderDate) : undefined,
      reminderTime: reminderTime || undefined,
      reminderRecurrence: reminderRecurrence || 'none',
      notes,
      event: actualEventId,
      user: originalOwnerId
    });

    const savedTask = await newTask.save();

    res.status(201).json(savedTask);
  } catch (err) {
    console.error('Error creating task:', err);
    
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateTask = async (req, res) => {
  try {
    const { eventId, taskId } = req.params;
    const updateData = req.body;

    let actualEventId = eventId;
    let eventForValidation = null;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
      const originalEvent = await Event.findById(event.originalEvent);
      eventForValidation = originalEvent;
    } else if (!event) {
      const sharedEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      
      if (!sharedEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      const userShare = sharedEvent.sharedWith.find(share => 
        share.userId.toString() === req.userId.toString()
      );
      
      if (!userShare || userShare.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
      
      actualEventId = eventId;
      eventForValidation = sharedEvent;
    } else {
      eventForValidation = event;
    }

    const task = await Task.findOne({ 
      _id: taskId, 
      event: actualEventId
    });

    if (!task) {
      return res.status(404).json({ message: req.t('events.tasks.notFound') });
    }

    if (updateData.dueDate) {
      const taskDueDate = new Date(updateData.dueDate);
      if (isNaN(taskDueDate.getTime())) {
        return res.status(400).json({ 
          message: req.t('events.validation.invalidDueDate') 
        });
      }

      const eventDate = new Date(eventForValidation.date);
      eventDate.setHours(0, 0, 0, 0);
      taskDueDate.setHours(0, 0, 0, 0);

      if (taskDueDate > eventDate) {
        return res.status(400).json({ 
          message: req.t('events.validation.dueDateAfterEvent')
        });
      }

      updateData.dueDate = taskDueDate;
    }

    if (updateData.dueTime !== undefined) {
      if (updateData.dueTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.dueTime)) {
        return res.status(400).json({ 
          message: req.t('events.validation.invalidTimeFormat') 
        });
      }
      updateData.dueTime = updateData.dueTime || '09:00';
    }

    if (updateData.reminderTime !== undefined) {
      if (updateData.reminderTime && !/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(updateData.reminderTime)) {
        return res.status(400).json({ 
          message: req.t('events.validation.invalidTimeFormat') 
        });
      }
    }

    if (updateData.reminderDate) {
      const taskReminderDate = new Date(updateData.reminderDate);
      if (isNaN(taskReminderDate.getTime())) {
        return res.status(400).json({ 
          message: req.t('events.validation.invalidReminderDate') 
        });
      }
      updateData.reminderDate = taskReminderDate;

      const reminderDateTime = new Date(taskReminderDate);
      const dueDate = updateData.dueDate || task.dueDate;
      const dueDateTime = new Date(dueDate);

      const reminderTime = updateData.reminderTime || task.reminderTime;
      const dueTime = updateData.dueTime || task.dueTime;

      if (reminderTime) {
        const [reminderHour, reminderMinute] = reminderTime.split(':');
        reminderDateTime.setHours(parseInt(reminderHour), parseInt(reminderMinute), 0, 0);
      }

      if (dueTime) {
        const [dueHour, dueMinute] = dueTime.split(':');
        dueDateTime.setHours(parseInt(dueHour), parseInt(dueMinute), 0, 0);
      }

      if (reminderDateTime >= dueDateTime) {
        return res.status(400).json({ 
          message: req.t('events.validation.reminderBeforeDue') 
        });
      }
    }

    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        task[key] = updateData[key];
      }
    });

    const updatedTask = await task.save();

    try {
      const user = await User.findById(req.userId);

      if (user && user.googleTokens && user.googleTokens.access_token && 
          updatedTask.googleCalendarEventId && eventForValidation) {

        const refreshedTokens = await googleCalendar.refreshTokenIfNeeded(user.googleTokens);
        const oauth2Client = googleCalendar.setCredentials(refreshedTokens);

        if (refreshedTokens !== user.googleTokens) {
          await User.findByIdAndUpdate(req.userId, {
            googleTokens: refreshedTokens
          });
        }

        await googleCalendar.updateCalendarEvent(
          updatedTask.googleCalendarEventId, 
          updatedTask, 
          eventForValidation,
          oauth2Client
        );
      }
    } catch (calendarError) {
      console.log('Failed to update in Google Calendar:', calendarError.message);
    }

    res.json({
      message: req.t('events.tasks.updateSuccess'),
      task: updatedTask
    });
  } catch (err) {
    console.error('Error updating task:', err);

    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }

    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const deleteTask = async (req, res) => {
  try {
    const { eventId, taskId } = req.params;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const sharedEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      
      if (!sharedEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      const userShare = sharedEvent.sharedWith.find(share => 
        share.userId.toString() === req.userId.toString()
      );
      
      if (!userShare || userShare.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
      
      actualEventId = eventId;
    }

    const task = await Task.findOne({ 
      _id: taskId, 
      event: actualEventId
    });

    if (!task) {
      return res.status(404).json({ message: req.t('events.tasks.notFound') });
    }

    const googleCalendarEventId = task.googleCalendarEventId;

    await Task.findByIdAndDelete(taskId);

    if (googleCalendarEventId) {
      try {
        const user = await User.findById(req.userId);

        if (user && user.googleTokens && user.googleTokens.access_token) {
          const refreshedTokens = await googleCalendar.refreshTokenIfNeeded(user.googleTokens);
          const oauth2Client = googleCalendar.setCredentials(refreshedTokens);

          if (refreshedTokens !== user.googleTokens) {
            await User.findByIdAndUpdate(req.userId, {
              googleTokens: refreshedTokens
            });
          }

          await googleCalendar.deleteCalendarEvent(googleCalendarEventId, oauth2Client);
        }
      } catch (calendarError) {
        console.log('Failed to delete from Google Calendar:', calendarError.message);
      }
    }

    res.json({ message: req.t('events.tasks.deleteSuccess') });
  } catch (err) {
    console.error('Error deleting task:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { eventId, taskId } = req.params;
    const { status } = req.body;

    let actualEventId = eventId;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const sharedEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      });
      
      if (!sharedEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      
      const userShare = sharedEvent.sharedWith.find(share => 
        share.userId.toString() === req.userId.toString()
      );
      
      if (!userShare || userShare.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
      
      actualEventId = eventId;
    }

    const task = await Task.findOne({ 
      _id: taskId, 
      event: actualEventId
    });

    if (!task) {
      return res.status(404).json({ message: req.t('events.tasks.notFound') });
    }

    task.status = status;
    const updatedTask = await task.save();

    try {
      const user = await User.findById(req.userId);
      const eventData = await Event.findById(actualEventId);

      if (user && user.googleTokens && user.googleTokens.access_token && 
          updatedTask.googleCalendarEventId && eventData) {

        const refreshedTokens = await googleCalendar.refreshTokenIfNeeded(user.googleTokens);
        const oauth2Client = googleCalendar.setCredentials(refreshedTokens);

        if (refreshedTokens !== user.googleTokens) {
          await User.findByIdAndUpdate(req.userId, {
            googleTokens: refreshedTokens
          });
        }

        await googleCalendar.updateCalendarEvent(
          updatedTask.googleCalendarEventId, 
          updatedTask, 
          eventData,
          oauth2Client
        );
      }
    } catch (calendarError) {
      console.log('Failed to update status in Google Calendar:', calendarError.message);
    }

    res.json({
      message: req.t('events.tasks.statusUpdateSuccess'),
      task: updatedTask
    });
  } catch (err) {
    console.error('Error updating task status:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getTasksStatistics = async (req, res) => {
  try {
    const { eventId } = req.params;
    let actualEventId = eventId;

    let event = await Event.findOne({ _id: eventId, user: req.userId }).lean();
    
    if (event && event.originalEvent) {
      actualEventId = event.originalEvent;
    } else if (!event) {
      const originalEvent = await Event.findOne({
        _id: eventId,
        'sharedWith.userId': req.userId
      }).lean();
      
      if (!originalEvent) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
      actualEventId = eventId;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const stats = await Task.aggregate([
      { 
        $match: { 
          event: new mongoose.Types.ObjectId(actualEventId)
        } 
      },
      {
        $facet: {
          statusCounts: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ],
          overdueCounts: [
            {
              $match: {
                $and: [
                  { status: { $ne: 'completed' } },
                  { dueDate: { $lt: today } }
                ]
              }
            },
            {
              $count: 'overdue'
            }
          ],
          totalCount: [
            {
              $count: 'total'
            }
          ]
        }
      }
    ]);

    const statusMap = {};
    stats[0].statusCounts.forEach(item => {
      statusMap[item._id] = item.count;
    });

    const result = {
      total: stats[0].totalCount[0]?.total || 0,
      completed: statusMap.completed || 0,
      pending: statusMap.pending || 0,
      inProgress: statusMap.in_progress || 0,
      overdue: stats[0].overdueCounts[0]?.overdue || 0
    };

    res.json(result);
  } catch (err) {
    console.error('Error fetching task statistics:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

// Google Calendar Functions
const getGoogleCalendarStatus = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const connected = user && user.googleTokens && user.googleTokens.access_token ? true : false;
    res.json({ connected });
  } catch (error) {
    console.error('Error checking connection status:', error);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getGoogleAuthUrl = async (req, res) => {
  try {
    const authUrl = googleCalendar.getAuthUrl();
    res.json({ authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const handleGoogleCallback = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      console.error('Missing authorization code');
      return res.status(400).json({ 
        message: 'Missing authorization code',
        error: 'MISSING_CODE'
      });
    }

    if (processedCodes.has(code)) {
      console.error('Authorization code already used:', code.substring(0, 20) + '...');
      return res.status(400).json({
        message: 'Authorization code already used. Please try connecting again.',
        error: 'CODE_ALREADY_USED',
        userMessage: 'Authorization code already used. Please try connecting again.'
      });
    }

    processedCodes.add(code);
    setTimeout(() => {
      processedCodes.delete(code);
    }, 10 * 60 * 1000); 

    try {
      const tokens = await googleCalendar.getAccessToken(code);

      const updatedUser = await User.findByIdAndUpdate(
        req.userId, 
        { googleTokens: tokens },
        { new: true }
      );

      if (!updatedUser) {
        console.error('User not found:', req.userId);
        return res.status(404).json({ 
          message: 'User not found',
          error: 'USER_NOT_FOUND'
        });
      }

      res.json({ 
        message: 'Google Calendar connected successfully',
        success: true
      });

    } catch (tokenError) {
      console.error('Token exchange error:', tokenError);

      if (tokenError.message.includes('invalid_grant') || 
          tokenError.message.includes('expired') ||
          tokenError.message.includes('already used')) {
        return res.status(400).json({
          message: 'Authorization expired or invalid. Please try connecting again.',
          error: 'AUTH_EXPIRED',
          userMessage: 'Authorization expired or invalid. Please try connecting again.'
        });
      }

      if (tokenError.message.includes('redirect_uri_mismatch')) {
        return res.status(400).json({
          message: 'Configuration error. Please contact support.',
          error: 'CONFIG_ERROR',
          userMessage: 'Configuration error. Please contact support.'
        });
      }

      throw tokenError;
    }

  } catch (error) {
    console.error('Error in Google Calendar callback:', error);

    res.status(500).json({ 
      message: 'Failed to connect Google Calendar',
      error: error.message,
      type: 'GOOGLE_AUTH_ERROR',
      userMessage: 'Failed to connect to Google Calendar. Please try again.'
    });
  }
};

const disconnectGoogleCalendar = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      $unset: { googleTokens: 1 }
    });

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const syncWithGoogleCalendar = async (req, res) => {
  try {
    const { eventId } = req.params;

    const user = await User.findById(req.userId);
    if (!user || !user.googleTokens || !user.googleTokens.access_token) {
      return res.status(400).json({ 
        message: 'Google Calendar not connected',
        error: 'NOT_CONNECTED'
      });
    }

    const tasks = await Task.find({ event: eventId, user: req.userId });
    const event = await Event.findOne({ _id: eventId, user: req.userId });

    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    try {
      const syncResult = await googleCalendar.syncEventTasksWithCalendar(
        eventId, 
        tasks, 
        event, 
        user.googleTokens
      );

      if (syncResult.updatedTokens) {
        await User.findByIdAndUpdate(req.userId, {
          googleTokens: syncResult.updatedTokens
        });
      }

      for (const success of syncResult.results.success) {
        await Task.findByIdAndUpdate(success.taskId, {
          googleCalendarEventId: success.googleEventId
        });
      }

      res.json({
        message: 'Calendar sync completed',
        results: syncResult.results
      });
    } catch (syncError) {
      if (syncError.message === 'GOOGLE_AUTH_EXPIRED') {
        await User.findByIdAndUpdate(req.userId, {
          $unset: { googleTokens: 1 }
        });

        return res.status(401).json({ 
          message: 'Google Calendar authorization expired. Please reconnect.',
          error: 'AUTH_EXPIRED',
          needsReauth: true
        });
      }
      throw syncError;
    }

  } catch (error) {
    console.error('Error syncing with calendar:', error);
    res.status(500).json({ 
      message: 'Failed to sync with calendar',
      error: error.message 
    });
  }
};

module.exports = {
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
};