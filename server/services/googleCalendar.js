const { google } = require('googleapis');

const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

const getAuthUrl = () => {
  const oauth2Client = createOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    state: 'google_calendar_auth',
    redirect_uri: process.env.GOOGLE_REDIRECT_URI 
  });
};

const getAccessToken = async (code) => {
  const oauth2Client = createOAuth2Client();
  
  try {
    oauth2Client.redirectUri = process.env.GOOGLE_REDIRECT_URI;
    
    const response = await oauth2Client.getToken(code);
    
    if (!response.tokens) {
      throw new Error('No tokens received from Google');
    }
    
    return response.tokens;
  } catch (error) {
    if (error.message.includes('invalid_grant') || 
        (error.response && error.response.data && error.response.data.error === 'invalid_grant')) {
      throw new Error('Authorization code expired or already used. Please try connecting again.');
    }
    
    if (error.message.includes('redirect_uri_mismatch')) {
      throw new Error('Redirect URI mismatch. Please contact support.');
    }
    
    throw new Error(`Failed to get access token: ${error.message}`);
  }
};

const setCredentials = (tokens) => {
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials(tokens);
  return oauth2Client;
};

const refreshTokenIfNeeded = async (tokens) => {
  try {
    const oauth2Client = createOAuth2Client();
    oauth2Client.setCredentials(tokens);
    
    const expiryDate = tokens.expiry_date || 0;
    const now = Date.now();
    
    if (expiryDate - now < 5 * 60 * 1000) { 
      try {
        const { credentials } = await oauth2Client.refreshAccessToken();
        return credentials;
      } catch (refreshError) {
        if (refreshError.message && refreshError.message.includes('invalid_grant')) {
          throw new Error('AUTH_EXPIRED');
        }
        throw refreshError;
      }
    }
    
    return tokens;
  } catch (error) {
    if (error.message === 'AUTH_EXPIRED') {
      throw error;
    }
    throw new Error('Failed to refresh access token');
  }
};

const createCalendarEvent = async (taskData, eventData) => {
  try {
    const oauth2Client = createOAuth2Client();
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    if (!taskData.dueDate) {
      throw new Error('Task due date is required');
    }

    const dueDate = new Date(taskData.dueDate);
    const [hours, minutes] = (taskData.dueTime || '09:00').split(':');
    dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (isNaN(dueDate.getTime())) {
      throw new Error('Invalid due date provided');
    }

    const defaultDuration = 60; 
    const endDate = new Date(dueDate.getTime() + (defaultDuration * 60000));

    const calendarEvent = {
      summary: taskData.title,
      description: `${taskData.description || ''}\n\nקטגוריה: ${getCategoryText(taskData.category)}\nעדיפות: ${getPriorityText(taskData.priority)}\n\nמשויך לאירוע: ${eventData.title}`,
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
      reminders: {
        useDefault: false,
        overrides: []
      }
    };

    if (taskData.reminderDate) {
      const reminderDateTime = new Date(taskData.reminderDate);
      
      if (taskData.reminderTime) {
        const [reminderHours, reminderMinutes] = taskData.reminderTime.split(':');
        reminderDateTime.setHours(parseInt(reminderHours), parseInt(reminderMinutes), 0, 0);
      }
      
      if (!isNaN(reminderDateTime.getTime())) {
        const reminderMinutes = Math.floor((dueDate - reminderDateTime) / (1000 * 60));
        if (reminderMinutes > 0 && reminderMinutes <= 40320) { 
          calendarEvent.reminders.overrides.push({
            method: 'email',
            minutes: reminderMinutes
          });
          calendarEvent.reminders.overrides.push({
            method: 'popup',
            minutes: reminderMinutes
          });
        }
      }
    }

    if (calendarEvent.reminders.overrides.length === 0) {
      calendarEvent.reminders.overrides.push({
        method: 'email',
        minutes: 1440
      });
    }

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: calendarEvent,
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to create calendar event: ${error.message}`);
  }
};

const updateCalendarEvent = async (googleEventId, taskData, eventData, oauth2Client) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    if (!taskData.dueDate) {
      throw new Error('Task due date is required');
    }

    const dueDate = new Date(taskData.dueDate);
    const [hours, minutes] = (taskData.dueTime || '09:00').split(':');
    dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (isNaN(dueDate.getTime())) {
      throw new Error('Invalid due date provided');
    }

    const defaultDuration = 60; 
    const endDate = new Date(dueDate.getTime() + (defaultDuration * 60000));

    const calendarEvent = {
      summary: taskData.title,
      description: `${taskData.description || ''}\n\nקטגוריה: ${getCategoryText(taskData.category)}\nעדיפות: ${getPriorityText(taskData.priority)}\n\nמשויך לאירוע: ${eventData.title}`,
      start: {
        dateTime: dueDate.toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
      end: {
        dateTime: endDate.toISOString(),
        timeZone: 'Asia/Jerusalem',
      },
      reminders: {
        useDefault: false,
        overrides: []
      }
    };

    if (taskData.reminderDate) {
      const reminderDateTime = new Date(taskData.reminderDate);
      
      if (taskData.reminderTime) {
        const [reminderHours, reminderMinutes] = taskData.reminderTime.split(':');
        reminderDateTime.setHours(parseInt(reminderHours), parseInt(reminderMinutes), 0, 0);
      }
      
      if (!isNaN(reminderDateTime.getTime())) {
        const reminderMinutes = Math.floor((dueDate - reminderDateTime) / (1000 * 60));
        if (reminderMinutes > 0 && reminderMinutes <= 40320) {
          calendarEvent.reminders.overrides.push({
            method: 'email',
            minutes: reminderMinutes
          });
          calendarEvent.reminders.overrides.push({
            method: 'popup',
            minutes: reminderMinutes
          });
        }
      }
    }

    if (calendarEvent.reminders.overrides.length === 0) {
      calendarEvent.reminders.overrides.push({
        method: 'email',
        minutes: 1440 
      });
    }

    const response = await calendar.events.update({
      calendarId: 'primary',
      eventId: googleEventId,
      resource: calendarEvent,
    });

    return response.data;
  } catch (error) {
    throw new Error(`Failed to update calendar event: ${error.message}`);
  }
};

const deleteCalendarEvent = async (googleEventId, oauth2Client) => {
  try {
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    return { success: true };
  } catch (error) {
    if (error.code === 404 || error.message.includes('not found')) {
      return { success: true, alreadyDeleted: true };
    }
    
    throw new Error(`Failed to delete calendar event: ${error.message}`);
  }
};

const syncEventTasksWithCalendar = async (eventId, tasks, eventData, userTokens) => {
  try {
    let refreshedTokens;
    let oauth2Client;
    
    try {
      refreshedTokens = await refreshTokenIfNeeded(userTokens);
      oauth2Client = setCredentials(refreshedTokens);
    } catch (error) {
      if (error.message === 'AUTH_EXPIRED') {
        throw new Error('GOOGLE_AUTH_EXPIRED');
      }
      throw error;
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

    const results = {
      success: [],
      failed: []
    };

    for (const task of tasks) {
      try {
        if (!task.dueDate) {
          results.failed.push({
            taskId: task._id,
            title: task.title,
            error: 'Task due date is missing'
          });
          continue;
        }

        const taskDueDate = new Date(task.dueDate);
        if (isNaN(taskDueDate.getTime())) {
          results.failed.push({
            taskId: task._id,
            title: task.title,
            error: 'Invalid due date format'
          });
          continue;
        }

        let calendarEvent;
        
        if (task.googleCalendarEventId) {
          calendarEvent = await updateCalendarEvent(task.googleCalendarEventId, task, eventData, oauth2Client);
        } else {
          const dueDate = new Date(task.dueDate);
          const [hours, minutes] = (task.dueTime || '09:00').split(':');
          dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
          
          const defaultDuration = 60;
          const endDate = new Date(dueDate.getTime() + (defaultDuration * 60000));

          const calendarEventData = {
            summary: task.title,
            description: `${task.description || ''}\n\nקטגוריה: ${getCategoryText(task.category)}\nעדיפות: ${getPriorityText(task.priority)}\n\nמשויך לאירוע: ${eventData.title}`,
            start: {
              dateTime: dueDate.toISOString(),
              timeZone: 'Asia/Jerusalem',
            },
            end: {
              dateTime: endDate.toISOString(),
              timeZone: 'Asia/Jerusalem',
            },
            reminders: {
              useDefault: false,
              overrides: []
            }
          };

          if (task.reminderDate) {
            const reminderDateTime = new Date(task.reminderDate);
            
            if (task.reminderTime) {
              const [reminderHours, reminderMinutes] = task.reminderTime.split(':');
              reminderDateTime.setHours(parseInt(reminderHours), parseInt(reminderMinutes), 0, 0);
            }
            
            if (!isNaN(reminderDateTime.getTime())) {
              const reminderMinutes = Math.floor((dueDate - reminderDateTime) / (1000 * 60));
              if (reminderMinutes > 0 && reminderMinutes <= 40320) {
                calendarEventData.reminders.overrides.push({
                  method: 'email',
                  minutes: reminderMinutes
                });
                calendarEventData.reminders.overrides.push({
                  method: 'popup',
                  minutes: reminderMinutes
                });
              }
            }
          }

          if (calendarEventData.reminders.overrides.length === 0) {
            calendarEventData.reminders.overrides.push({
              method: 'email',
              minutes: 1440 
            });
          }

          const response = await calendar.events.insert({
            calendarId: 'primary',
            resource: calendarEventData,
          });
          
          calendarEvent = response.data;
        }

        results.success.push({
          taskId: task._id,
          googleEventId: calendarEvent.id,
          title: task.title
        });

      } catch (error) {
        results.failed.push({
          taskId: task._id,
          title: task.title,
          error: error.message
        });
      }
    }

    return {
      results,
      updatedTokens: refreshedTokens !== userTokens ? refreshedTokens : null
    };
  } catch (error) {
    if (error.message === 'GOOGLE_AUTH_EXPIRED') {
      throw new Error('GOOGLE_AUTH_EXPIRED');
    }
    throw new Error('Failed to sync tasks with calendar');
  }
};

const getCategoryText = (category) => {
  const categoryMap = {
    'venue': 'מקום',
    'catering': 'קייטרינג',
    'decoration': 'עיצוב',
    'entertainment': 'בידור',
    'photography': 'צילום',
    'invitations': 'הזמנות',
    'transportation': 'הסעות',
    'budget': 'תקציב',
    'other': 'אחר'
  };
  return categoryMap[category] || category;
};

const getPriorityText = (priority) => {
  const priorityMap = {
    'low': 'נמוכה',
    'medium': 'בינונית',
    'high': 'גבוהה',
    'urgent': 'דחוף'
  };
  return priorityMap[priority] || priority;
};

module.exports = {
  getAuthUrl,
  getAccessToken,
  setCredentials,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  syncEventTasksWithCalendar,
  refreshTokenIfNeeded
};