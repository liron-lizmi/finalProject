// client/src/pages/Events/Features/components/InternalCalendar.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const InternalCalendar = ({ tasks, eventDate, onTaskClick, canEdit = true, onClose }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [modalTasks, setModalTasks] = useState([]);
  const [modalDate, setModalDate] = useState(null);

  const monthNames = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  };
  
  const dayNames = {
    en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    he: ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
  };

  const dayNamesShort = {
    en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    he: ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']
  };

  const formatDateForComparison = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getTasksForDate = (date) => {
    const dateStr = formatDateForComparison(date);
    const tasksForDate = tasks.filter(task => {
        if (!task.dueDate) return false;
        const taskDate = new Date(task.dueDate);
        const taskDateStr = formatDateForComparison(taskDate);
        return taskDateStr === dateStr;
    });
    
    return tasksForDate.sort((a, b) => {
        const timeA = a.dueTime || '09:00';
        const timeB = b.dueTime || '09:00';
        return timeA.localeCompare(timeB);
    });
};

  const isToday = (date) => {
    const today = new Date();
    return formatDateForComparison(date) === formatDateForComparison(today);
  };

  const isEventDate = (date) => {
    if (!eventDate) return false;
    const eventDateObj = new Date(eventDate);
    return formatDateForComparison(date) === formatDateForComparison(eventDateObj);
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

  const navigateMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + direction);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleShowAllTasks = (date, dayTasks) => {
    setModalDate(date);
    setModalTasks(dayTasks);
    setShowTasksModal(true);
  };

  const closeTasksModal = () => {
    setShowTasksModal(false);
    setModalTasks([]);
    setModalDate(null);
  };

  const renderMonthView = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const weeks = [];
    let currentWeekDate = new Date(startDate);

    for (let week = 0; week < 5; week++) {
      const days = [];
      
      for (let day = 0; day < 7; day++) {
        const date = new Date(currentWeekDate);
        const isCurrentMonth = date.getMonth() === month;
        const dayTasks = getTasksForDate(date);
        
        days.push(
          <div
            key={`${week}-${day}`}
            className={`calendar-day ${!isCurrentMonth ? 'other-month' : ''} ${isToday(date) ? 'today' : ''} ${isEventDate(date) ? 'event-date' : ''}`}
          >
            <div className="day-number">{date.getDate()}</div>
            
            {dayTasks.length > 0 && (
              <div className="day-tasks">
                {dayTasks.slice(0, 2).map((task, index) => (
                  <div
                    key={task._id}
                    className={`task-item status-${task.status}`}
                    onClick={() => canEdit && onTaskClick(task)}
                    style={{ 
                      borderLeftColor: getPriorityColor(task.priority),
                    }}
                  >
                    <span className="task-title">{task.title}</span>
                    <span className="task-time">{task.dueTime || '09:00'}</span>
                  </div>
                ))}
                
                {dayTasks.length > 2 && (
                  <div 
                    className="more-tasks-btn"
                    onClick={() => handleShowAllTasks(date, dayTasks)}
                  >
                    ▼ +{dayTasks.length - 2} {t('events.features.tasks.calendar.internal.moreTasks')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
        
        currentWeekDate.setDate(currentWeekDate.getDate() + 1);
      }
      
      weeks.push(
        <div key={week} className="calendar-week">
          {days}
        </div>
      );
    }

    return weeks;
  };

  const renderWeekView = () => {
    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayTasks = getTasksForDate(date);
      
      days.push(
        <div key={i} className={`week-day ${isToday(date) ? 'today' : ''} ${isEventDate(date) ? 'event-date' : ''}`}>
          <div className="week-day-header">
            <div className="day-name">{dayNames[isRTL ? 'he' : 'en'][date.getDay()]}</div>
            <div className="day-number">{date.getDate()}</div>
          </div>
          
          <div className="week-day-tasks">
            {dayTasks.slice(0, 2).map((task) => (
              <div
                key={task._id}
                className={`week-task-item status-${task.status}`}
                onClick={() => canEdit && onTaskClick(task)}
                style={{ 
                  borderLeftColor: getPriorityColor(task.priority),
                }}
              >
                <div className="task-title">{task.title}</div>
                <div className="task-category">{t(`events.features.tasks.category.${task.category}`)}</div>
              </div>
            ))}
            
            {dayTasks.length > 2 && (
              <div 
                className="more-tasks-btn week-more-tasks"
                onClick={() => handleShowAllTasks(date, dayTasks)}
              >
                ▼ +{dayTasks.length - 2} {t('events.features.tasks.calendar.internal.moreTasks')}
              </div>
            )}
          </div>
        </div>
      );
    }
    
    return days;
  };

  const navigateWeek = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setDate(newDate.getDate() + (direction * 7));
      return newDate;
    });
  };

  const lang = isRTL ? 'he' : 'en';

  return (
    <div className={`internal-calendar ${isRTL ? 'rtl' : 'ltr'}`}>
      <div className="calendar-header">
        <button 
          className="internal-calendar-close-btn"
          onClick={onClose}
          title={t('general.close')}
        >
          ✕
        </button>
        <div className="calendar-navigation">
          <button
            className="nav-btn"
            onClick={() => viewMode === 'month' ? navigateMonth(-1) : navigateWeek(-1)}
          >
            {isRTL ? '❮' : '❯'}
          </button>
          
          <div className="current-period">
            {viewMode === 'month' ? (
              <span>{monthNames[lang][currentDate.getMonth()]} {currentDate.getFullYear()}</span>
            ) : (
              <span>
                {t('events.features.tasks.calendar.internal.week')} - {monthNames[lang][currentDate.getMonth()]} {currentDate.getFullYear()}
              </span>
            )}
          </div>
          
          <button
            className="nav-btn"
            onClick={() => viewMode === 'month' ? navigateMonth(1) : navigateWeek(1)}
          >
            {isRTL ? '❯' : '❮'}
          </button>
        </div>

        <div className="calendar-controls">
          <div className="view-mode-buttons">
            <button
              className={`view-btn ${viewMode === 'month' ? 'active' : ''}`}
              onClick={() => setViewMode('month')}
            >
              {t('events.features.tasks.calendar.internal.monthView')}
            </button>
            <button
              className={`view-btn ${viewMode === 'week' ? 'active' : ''}`}
              onClick={() => setViewMode('week')}
            >
              {t('events.features.tasks.calendar.internal.weekView')}
            </button>
          </div>
          
          <button className="today-btn" onClick={goToToday}>
            {t('general.today')}
          </button>
        </div>
      </div>

      <div className="calendar-legend">
        <div className="legend-item">
          <div className="legend-color today-color"></div>
          <span>{t('events.features.tasks.calendar.internal.todayLegend')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color event-color"></div>
          <span>{t('events.features.tasks.calendar.internal.eventDateLegend')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color urgent-color"></div>
          <span>{t('events.features.tasks.priority.urgent')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color high-color"></div>
          <span>{t('events.features.tasks.priority.high')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color medium-color"></div>
          <span>{t('events.features.tasks.priority.medium')}</span>
        </div>
        <div className="legend-item">
          <div className="legend-color low-color"></div>
          <span>{t('events.features.tasks.priority.low')}</span>
        </div>
      </div>

      {viewMode === 'month' ? (
        <div className="calendar-month-view">
          <div className="calendar-days-header">
            {dayNamesShort[lang].map((day, index) => (
              <div key={index} className="day-header">{day}</div>
            ))}
          </div>
          
          <div className="calendar-grid">
            {renderMonthView()}
          </div>
        </div>
      ) : (
        <div className="calendar-week-view">
          {renderWeekView()}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="calendar-empty-state">
          <div className="empty-icon">📅</div>
          <p>{t('events.features.tasks.calendar.internal.noTasks')}</p>
        </div>
      )}

      {showTasksModal && (
        <div className="modal-overlay" onClick={closeTasksModal}>
          <div className="modal-content tasks-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('events.features.tasks.calendar.internal.tasksForDate', { 
                date: modalDate ? modalDate.toLocaleDateString('he-IL') : '' 
              })}</h3>
              <button className="modal-close" onClick={closeTasksModal}>
                ✕
              </button>
            </div>
            
            <div className="modal-body">
              {modalTasks.map((task) => (
                <div
                  key={task._id}
                  className={`modal-task-item status-${task.status}`}
                  onClick={() => {
                    if (canEdit) {
                      onTaskClick(task);
                      closeTasksModal();
                    }
                  }}
                  style={{ 
                    borderLeftColor: getPriorityColor(task.priority),
                  }}
                >
                  <div className="task-title">{task.title}</div>
                  <div className="task-details">
                    <span className="task-category">{t(`events.features.tasks.category.${task.category}`)}</span>
                    <span className="task-priority">{t(`events.features.tasks.priority.${task.priority}`)}</span>
                    <span className="task-status">{t(`events.features.tasks.status.${task.status}`)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InternalCalendar;