import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/EventTimeline.css';

const ReminderToast = ({ tasks, onTaskClick, canEdit = true}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [activeReminders, setActiveReminders] = useState([]);
  const [shownToday, setShownToday] = useState(new Set());

  useEffect(() => {
    checkForReminders();
  }, [tasks]);

 const checkForReminders = () => {
  if (!tasks || tasks.length === 0) return;

  const now = new Date();
  const today = now.toDateString();

  const dismissedReminders = JSON.parse(
    localStorage.getItem('dismissed_reminders') || '[]'
  );

  const shownTodayFromStorage = JSON.parse(
    localStorage.getItem(`reminders_shown_${today}`) || '[]'
  );
  setShownToday(new Set(shownTodayFromStorage));

  const reminderTasks = [];

  tasks.forEach(task => {
    if (task.status === 'completed') return;

    const taskId = task._id;
    const dueDate = new Date(task.dueDate);
    const dueDateString = dueDate.toDateString();

    if (task.dueTime) {
      const [hours, minutes] = task.dueTime.split(':');
      dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
    } else {
      dueDate.setHours(23, 59, 59, 999);
    }

    const overdueKey = `${taskId}_overdue_${dueDateString}`;
    if (dueDate < now && !dismissedReminders.includes(overdueKey)) {
      reminderTasks.push({
        ...task,
        reminderType: 'overdue',
        reminderKey: overdueKey
      });
    }

    if (task.reminderDate) {
      const reminderDateTime = new Date(task.reminderDate);

      if (task.reminderTime) {
        const [hours, minutes] = task.reminderTime.split(':');
        reminderDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      }

      if (task.reminderRecurrence && task.reminderRecurrence !== 'none') {
        const recurringReminders = getRecurringReminders(
          task, 
          now, 
          shownTodayFromStorage, 
          dismissedReminders
        );
        reminderTasks.push(...recurringReminders);
      } 
      else {
        const originalKey = `${taskId}_original`;
        
        if (now >= reminderDateTime && !dismissedReminders.includes(originalKey)) {
          reminderTasks.push({
            ...task,
            reminderType: 'original',
            reminderKey: originalKey
          });
        }
      }
    }
  });

  if (reminderTasks.length > 0) {
    setActiveReminders(reminderTasks);

    const newShownToday = [
      ...shownTodayFromStorage, 
      ...reminderTasks
        .filter(t => t.reminderType === 'recurring')
        .map(t => t.reminderKey)
    ];
    localStorage.setItem(`reminders_shown_${today}`, JSON.stringify(newShownToday));
    setShownToday(new Set(newShownToday));
  }
};

  const getRecurringReminders = (task, now, shownToday, dismissedReminders) => {
  const reminders = [];
  const taskId = task._id;
  const dueDate = new Date(task.dueDate);
  const reminderDate = new Date(task.reminderDate);

  if (task.reminderTime) {
    const [hours, minutes] = task.reminderTime.split(':');
    reminderDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  const todayAtReminderTime = new Date(now);
  if (task.reminderTime) {
    const [hours, minutes] = task.reminderTime.split(':');
    todayAtReminderTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
  }

  switch (task.reminderRecurrence) {
    case 'daily':
      const dailyKey = `${taskId}_daily_${now.toDateString()}`;
      
      if (now >= todayAtReminderTime && 
          now <= dueDate && 
          !shownToday.includes(dailyKey) &&
          !dismissedReminders.includes(dailyKey)) {
        reminders.push({
          ...task,
          reminderType: 'recurring',
          reminderKey: dailyKey,
          recurringNumber: 'daily'
        });
      }
      break;

    case 'weekly':
      const reminderDayOfWeek = reminderDate.getDay();
      const todayDayOfWeek = now.getDay();
      const weeklyKey = `${taskId}_weekly_${now.toDateString()}`;
      
      if (reminderDayOfWeek === todayDayOfWeek &&
          now >= todayAtReminderTime &&
          now <= dueDate &&
          !shownToday.includes(weeklyKey) &&
          !dismissedReminders.includes(weeklyKey)) {
        reminders.push({
          ...task,
          reminderType: 'recurring',
          reminderKey: weeklyKey,
          recurringNumber: 'weekly'
        });
      }
      break;

    case 'biweekly':
      const reminderDayOfWeek2 = reminderDate.getDay();
      const todayDayOfWeek2 = now.getDay();
      
      const secondDay = (reminderDayOfWeek2 + 3) % 7;
      
      const biweeklyKey = `${taskId}_biweekly_${now.toDateString()}`;
      
      if ((reminderDayOfWeek2 === todayDayOfWeek2 || secondDay === todayDayOfWeek2) &&
          now >= todayAtReminderTime &&
          now <= dueDate &&
          !shownToday.includes(biweeklyKey) &&
          !dismissedReminders.includes(biweeklyKey)) {
        reminders.push({
          ...task,
          reminderType: 'recurring',
          reminderKey: biweeklyKey,
          recurringNumber: 'biweekly'
        });
      }
      break;

    default:
      break;
  }

  return reminders;
};

  const closeReminder = (reminderKey, isPermanentDismiss = false) => {
  setActiveReminders(prev => prev.filter(task => task.reminderKey !== reminderKey));
  
  if (isPermanentDismiss) {
    const dismissedReminders = JSON.parse(
      localStorage.getItem('dismissed_reminders') || '[]'
    );
    
    if (!dismissedReminders.includes(reminderKey)) {
      dismissedReminders.push(reminderKey);
      localStorage.setItem('dismissed_reminders', JSON.stringify(dismissedReminders));
    }
  }
};

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
    closeReminder(task.reminderKey);
  };

  const formatDate = (date) => {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString(isRTL ? 'he-IL' : 'en-US', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatDateTime = (date, time) => {
    const dateStr = formatDate(date);
    if (!time) return dateStr;
    return `${dateStr} ${time}`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent': return '#dc2626';
      case 'high': return '#ea580c';
      case 'medium': return '#d97706';
      case 'low': return '#16a34a';
      default: return '#6b7280';
    }
  };

  const getDaysUntilDue = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    const due = new Date(dueDate);
    const diffTime = due - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getReminderTitle = (task) => {
    switch (task.reminderType) {
      case 'overdue':
        return t('events.features.tasks.reminders.taskOverdue');
      case 'recurring':
        return t('events.features.tasks.form.recurringReminder');
      case 'original':
      default:
        return t('events.features.tasks.reminders.reminder');
    }
  };

  const getReminderIcon = (task) => {
    switch (task.reminderType) {
      case 'overdue':
        return '⚠️';
      case 'recurring':
        return '🔄';
      case 'original':
      default:
        return '🔔';
    }
  };

  if (activeReminders.length === 0) return null;

  return (
    <div className={`reminder-toasts-container ${isRTL ? 'rtl' : 'ltr'}`}>
      {activeReminders.map((task, index) => {
        const daysUntilDue = getDaysUntilDue(task.dueDate);
        const isOverdue = task.reminderType === 'overdue' || daysUntilDue < 0;

        return (
          <div
            key={task.reminderKey}
            className={`reminder-toast ${isOverdue ? 'overdue' : ''} ${task.reminderType === 'recurring' ? 'recurring' : ''}`}
            style={{ 
              animationDelay: `${index * 0.2}s`,
              borderLeftColor: getPriorityColor(task.priority)
            }}
          >
            <div className="reminder-toast-header">
              <div className="reminder-icon">
                {getReminderIcon(task)}
              </div>
              <div className="reminder-title">
                {getReminderTitle(task)}
                {task.reminderType === 'recurring' && (
                  <span className="recurring-indicator">
                    (#{task.recurringNumber})
                  </span>
                )}
              </div>
              <button 
                className="reminder-close"
                onClick={() => closeReminder(
                  task.reminderKey, 
                  task.reminderType !== 'recurring'
                )}
                aria-label={t('general.close')}
              >
                ✕
              </button>
            </div>

            <div className="reminder-toast-body">
              <h4 className="reminder-task-title">{task.title}</h4>

              <div className="reminder-task-details">
                <div className="reminder-detail">
                  <span className="reminder-label">{t('events.features.tasks.form.dueDate')}:</span>
                  <span className={`reminder-value ${isOverdue ? 'overdue-text' : ''}`}>
                    {formatDateTime(task.dueDate, task.dueTime)}
                    {daysUntilDue !== null && (
                      <span className="days-info">
                        {daysUntilDue === 0 && ` (${t('events.features.tasks.time.today')})`}
                        {daysUntilDue === 1 && ` (${t('events.features.tasks.time.tomorrow')})`}
                        {daysUntilDue > 1 && ` (${t('events.features.tasks.time.daysLeft', { days: daysUntilDue })})`}
                        {daysUntilDue < 0 && ` (${t('events.features.tasks.time.daysOverdue', { days: Math.abs(daysUntilDue) })})`}
                      </span>
                    )}
                  </span>
                </div>

                {task.reminderDate && task.reminderType !== 'overdue' && (
                  <div className="reminder-detail">
                    <span className="reminder-label">{t('events.features.tasks.form.reminderDate')}:</span>
                    <span className="reminder-value">
                      {formatDateTime(task.reminderDate, task.reminderTime)}
                    </span>
                  </div>
                )}

                {task.reminderRecurrence && task.reminderRecurrence !== 'none' && (
                  <div className="reminder-detail">
                    <span className="reminder-label">{t('events.features.tasks.form.recurringReminder')}:</span>
                    <span className="reminder-value">
                      {t(`events.features.tasks.reminders.${task.reminderRecurrence}`)}
                    </span>
                  </div>
                )}

                <div className="reminder-detail">
                  <span className="reminder-label">{t('events.features.tasks.form.priority')}:</span>
                  <span 
                    className="reminder-priority"
                    style={{ color: getPriorityColor(task.priority) }}
                  >
                    {t(`events.features.tasks.priority.${task.priority}`)}
                  </span>
                </div>

                <div className="reminder-detail">
                  <span className="reminder-label">{t('events.features.tasks.form.category')}:</span>
                  <span className="reminder-value">
                    {t(`events.features.tasks.category.${task.category}`)}
                  </span>
                </div>
              </div>

              {task.description && (
                <div className="reminder-description">
                  <p>{task.description}</p>
                </div>
              )}
            </div>

            <div className="reminder-toast-actions">
              <button 
                className="reminder-btn view-task"
                onClick={() => handleTaskClick(task)}
              >
                {t('events.features.tasks.reminders.viewTask')}
              </button>
              <button 
                className="reminder-btn dismiss"
                onClick={() => closeReminder(
                  task.reminderKey, 
                  task.reminderType !== 'recurring'
                )}
              >
                {t('events.features.tasks.reminders.dismiss')}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ReminderToast;