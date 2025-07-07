// src/pages/Events/Features/components/ReminderToast.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/EventTimeline.css';

const ReminderToast = ({ tasks, onTaskClick }) => {
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
    
    const shownTodayFromStorage = JSON.parse(
      localStorage.getItem(`reminders_shown_${today}`) || '[]'
    );
    setShownToday(new Set(shownTodayFromStorage));

    const reminderTasks = tasks.filter(task => {
      if (!task.reminderDate || task.status === 'completed') return false;
      
      if (shownTodayFromStorage.includes(task._id)) return false;
      
      const reminderTime = new Date(task.reminderDate);
      const timeDiff = now - reminderTime;
      
      return timeDiff >= 0 && timeDiff <= 24 * 60 * 60 * 1000;
    });

    if (reminderTasks.length > 0) {
      setActiveReminders(reminderTasks);
      
      const newShownToday = [...shownTodayFromStorage, ...reminderTasks.map(t => t._id)];
      localStorage.setItem(`reminders_shown_${today}`, JSON.stringify(newShownToday));
      setShownToday(new Set(newShownToday));
    }
  };

  const closeReminder = (taskId) => {
    setActiveReminders(prev => prev.filter(task => task._id !== taskId));
  };

  const handleTaskClick = (task) => {
    if (onTaskClick) {
      onTaskClick(task);
    }
    closeReminder(task._id);
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

  if (activeReminders.length === 0) return null;

  return (
    <div className={`reminder-toasts-container ${isRTL ? 'rtl' : 'ltr'}`}>
      {activeReminders.map((task, index) => {
        const daysUntilDue = getDaysUntilDue(task.dueDate);
        const isOverdue = daysUntilDue < 0;
        
        return (
          <div
            key={task._id}
            className={`reminder-toast ${isOverdue ? 'overdue' : ''}`}
            style={{ 
              animationDelay: `${index * 0.2}s`,
              borderLeftColor: getPriorityColor(task.priority)
            }}
          >
            <div className="reminder-toast-header">
              <div className="reminder-icon">
                {isOverdue ? '⚠️' : '🔔'}
              </div>
              <div className="reminder-title">
                {isOverdue 
                  ? t('events.features.tasks.reminders.overdue') 
                  : t('events.features.tasks.reminders.reminder')
                }
              </div>
              <button 
                className="reminder-close"
                onClick={() => closeReminder(task._id)}
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
                    {formatDate(task.dueDate)}
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
                onClick={() => closeReminder(task._id)}
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