// client/src/pages/Events/Features/components/TaskModal.js
import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

const TaskModal = ({ task, onSave, onClose, eventDate, canEdit = true }) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: '',
    dueTime: '09:00',
    priority: 'medium',
    category: 'other',
    reminderDate: '',
    reminderTime: '09:00',
    notes: '',
    reminderRecurrence: 'none'
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showDueDateCalendar, setShowDueDateCalendar] = useState(false);
  const [showReminderCalendar, setShowReminderCalendar] = useState(false);
  const [showDueTimePicker, setShowDueTimePicker] = useState(false);
  const [showReminderTimePicker, setShowReminderTimePicker] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [focusedField, setFocusedField] = useState('');
  const [displayDueDate, setDisplayDueDate] = useState('');
  const [displayReminderDate, setDisplayReminderDate] = useState('');
  const [recurringReminderEnabled, setRecurringReminderEnabled] = useState(false);
  const [showRecurringModal, setShowRecurringModal] = useState(false);

  const dueDateCalendarRef = useRef(null);
  const reminderCalendarRef = useRef(null);
  const dueDateInputRef = useRef(null);
  const reminderInputRef = useRef(null);
  const dueTimePickerRef = useRef(null);
  const dueTimePickerContainerRef = useRef(null);
  const reminderTimePickerRef = useRef(null);
  const reminderTimePickerContainerRef = useRef(null);

  const monthNames = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  };
  
  const dayNames = {
    en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
  };

  const recurringOptions = [
    { value: 'daily', label: t('events.features.tasks.reminders.daily') },
    { value: 'weekly', label: t('events.features.tasks.reminders.weekly') },
    { value: 'biweekly', label: t('events.features.tasks.reminders.biweekly') }
  ];

  const showError = (message) => {
    setErrorMessage(message);
    setTimeout(() => setErrorMessage(''), 5000);
  };

  const formatDateToDisplay = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const shouldCalendarAppearAbove = (inputRef) => {
    if (!inputRef.current) return false;
    const inputRect = inputRef.current.getBoundingClientRect();
    const windowHeight = window.innerHeight;
    const calendarHeight = 350; 
    
    return (inputRect.bottom + calendarHeight) > windowHeight;
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dueDateCalendarRef.current && !dueDateCalendarRef.current.contains(event.target) &&
          !event.target.classList.contains('task-calendar-icon') &&
          !event.target.classList.contains('task-date-display-input')) {
        setShowDueDateCalendar(false);
      }
      if (reminderCalendarRef.current && !reminderCalendarRef.current.contains(event.target) &&
          !event.target.classList.contains('task-calendar-icon') &&
          !event.target.classList.contains('task-reminder-display-input')) {
        setShowReminderCalendar(false);
      }
      if (
        dueTimePickerContainerRef.current && 
        !dueTimePickerContainerRef.current.contains(event.target) &&
        !event.target.classList.contains('due-time-icon')
      ) {
        setShowDueTimePicker(false);
      }
      if (
        reminderTimePickerContainerRef.current && 
        !reminderTimePickerContainerRef.current.contains(event.target) &&
        !event.target.classList.contains('reminder-time-icon')
      ) {
        setShowReminderTimePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (task) {
      const taskData = {
        title: task.title || '',
        description: task.description || '',
        dueDate: task.dueDate || '',
        dueTime: task.dueTime || '09:00',
        priority: task.priority || 'medium',
        category: task.category || 'other',
        reminderDate: task.reminderDate || '',
        reminderTime: task.reminderTime || '09:00',
        notes: task.notes || '',
        reminderRecurrence: task.reminderRecurrence || 'none'
      };
      
      setFormData(taskData);
      setRecurringReminderEnabled(taskData.reminderRecurrence !== 'none');
      
      if (taskData.dueDate) {
        setDisplayDueDate(formatDateToDisplay(taskData.dueDate));
        setCurrentMonth(new Date(taskData.dueDate));
      }
      if (taskData.reminderDate) {
        setDisplayReminderDate(formatDateToDisplay(taskData.reminderDate));
      }
    }
  }, [task]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleFocus = (fieldName) => {
    setFocusedField(fieldName);
  };

  const handleBlur = () => {
    setFocusedField('');
  };

  const validateDueDateAgainstEvent = (selectedDate) => {
    if (!eventDate || !selectedDate) return null;
    
    const taskDueDate = new Date(selectedDate);
    const eventDateObj = new Date(eventDate);
    
    taskDueDate.setHours(0, 0, 0, 0);
    eventDateObj.setHours(0, 0, 0, 0);
    
    if (taskDueDate > eventDateObj) {
      return t('events.features.tasks.validation.dueDateAfterEvent');
    }
    
    return null;
  };

  const handleRecurringCheckboxChange = (e) => {
    const isChecked = e.target.checked;
    setRecurringReminderEnabled(isChecked);
    
    if (isChecked) {
      setShowRecurringModal(true);
    } else {
      setFormData(prev => ({ ...prev, reminderRecurrence: 'none' }));
    }
  };

  const handleRecurringOptionSelect = (option) => {
    setFormData(prev => ({ ...prev, reminderRecurrence: option }));
    setShowRecurringModal(false);
    if (option === 'none') {
      setRecurringReminderEnabled(false);
    }
  };

  const handleDateSelect = (day, fieldName) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      12, 0, 0, 0
    );
    
    const year = selected.getFullYear();
    const month = (selected.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = selected.getDate().toString().padStart(2, '0');
    const formattedDateISO = `${year}-${month}-${dayStr}`;
    const formattedDateDisplay = `${dayStr}/${month}/${year}`;
    
    setFormData(prev => ({
      ...prev,
      [fieldName]: formattedDateISO
    }));
    
    if (fieldName === 'dueDate') {
      setDisplayDueDate(formattedDateDisplay);
      setShowDueDateCalendar(false);
      
      const dueDateError = validateDueDateAgainstEvent(formattedDateISO);
      if (dueDateError) {
        setErrors(prev => ({ ...prev, dueDate: dueDateError }));
      } else if (errors.dueDate) {
        setErrors(prev => ({ ...prev, dueDate: '' }));
      }
    } else {
      setDisplayReminderDate(formattedDateDisplay);
      setShowReminderCalendar(false);
      if (errors.reminderDate) {
        setErrors(prev => ({ ...prev, reminderDate: '' }));
      }
    }
  };

  const isDateSelectable = (day) => {
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    return date >= today;
  };

  const isDateSelected = (day, fieldName) => {
    const fieldValue = formData[fieldName];
    if (!fieldValue) return false;
    
    const selectedDate = new Date(fieldValue);
    const calendarDate = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    
    return selectedDate.getTime() === calendarDate.getTime();
  };

  const renderCalendarDays = (fieldName) => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="task-calendar-day empty"></div>);
    }
    
    for (let day = 1; day <= daysInMonth; day++) {
      const selectable = isDateSelectable(day);
      const selected = isDateSelected(day, fieldName);
      
      days.push(
        <div
          key={day}
          className={`task-calendar-day ${selectable ? 'selectable' : 'disabled'} ${selected ? 'selected' : ''}`}
          onClick={() => selectable && handleDateSelect(day, fieldName)}
        >
          {day}
        </div>
      );
    }
    
    return days;
  };

  const toggleCalendar = (fieldName) => {
    if (fieldName === 'dueDate') {
      setShowDueDateCalendar(!showDueDateCalendar);
      setShowReminderCalendar(false);
    } else {
      setShowReminderCalendar(!showReminderCalendar);
      setShowDueDateCalendar(false);
    }
  };

  const handleClearDate = (fieldName) => {
    setFormData(prev => ({ ...prev, [fieldName]: '' }));
    if (fieldName === 'dueDate') {
      setDisplayDueDate('');
      setShowDueDateCalendar(false);
      if (errors.dueDate) {
        setErrors(prev => ({ ...prev, dueDate: '' }));
      }
    } else {
      setDisplayReminderDate('');
      setShowReminderCalendar(false);
      setFormData(prev => ({ ...prev, reminderTime: '' }));
    }
  };

  const handleToday = (fieldName) => {
    const todayDate = new Date();
    const year = todayDate.getFullYear();
    const month = (todayDate.getMonth() + 1).toString().padStart(2, '0');
    const day = todayDate.getDate().toString().padStart(2, '0');
    const formattedDateISO = `${year}-${month}-${day}`;
    const formattedDateDisplay = `${day}/${month}/${year}`;
    
    setFormData(prev => ({ ...prev, [fieldName]: formattedDateISO }));
    setCurrentMonth(todayDate);
    
    if (fieldName === 'dueDate') {
      setDisplayDueDate(formattedDateDisplay);
      setShowDueDateCalendar(false);
      
      const dueDateError = validateDueDateAgainstEvent(formattedDateISO);
      if (dueDateError) {
        setErrors(prev => ({ ...prev, dueDate: dueDateError }));
      } else if (errors.dueDate) {
        setErrors(prev => ({ ...prev, dueDate: '' }));
      }
    } else {
      setDisplayReminderDate(formattedDateDisplay);
      setShowReminderCalendar(false);
    }
  };

  const handleTimeSelection = (hour, minute, timeField) => {
    const formattedTime = `${hour}:${minute}`;
    setFormData(prev => ({
      ...prev,
      [timeField]: formattedTime
    }));
    
    if (timeField === 'dueTime') {
      setShowDueTimePicker(false);
    } else {
      setShowReminderTimePicker(false);
    }
  };

  const renderTimePicker = (timeField, showPicker, setShowPicker, containerRef) => {
    if (!showPicker) return null;
    
    const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
    const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));
    
    return (
      <div className={`time-picker-dropdown ${isRTL ? 'rtl' : 'ltr'}`} ref={containerRef}>
        <div className={`time-picker-header ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="time-picker-close" onClick={() => setShowPicker(false)}>✕</div>
        </div>
        <div className={`time-picker-content ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="time-picker-hours">
            {hours.map(hour => (
              <div 
                key={hour} 
                className="time-picker-hour"
                onClick={() => {
                  const minute = formData[timeField]?.split(':')?.[1] || '00';
                  handleTimeSelection(hour, minute, timeField);
                }}
              >
                {hour}
              </div>
            ))}
          </div>
          <div className="time-picker-minutes">
            {minutes.map(minute => (
              <div 
                key={minute} 
                className="time-picker-minute"
                onClick={() => {
                  const hour = formData[timeField]?.split(':')?.[0] || '09';
                  handleTimeSelection(hour, minute, timeField);
                }}
              >
                {minute}
              </div>
            ))}
          </div>
        </div>
        <div className="time-picker-footer">
          <button 
            type="button" 
            className="time-picker-action" 
            onClick={() => {
              setFormData(prev => ({ ...prev, [timeField]: '' }));
              setShowPicker(false);
            }}
          >
            {t('general.clear')}
          </button>
          {timeField === 'dueTime' && (
            <button 
              type="button" 
              className="time-picker-action primary" 
              onClick={() => {
                const now = new Date();
                const hours = now.getHours().toString().padStart(2, '0');
                const minutes = Math.floor(now.getMinutes() / 5) * 5;
                const minutesStr = minutes.toString().padStart(2, '0');
                handleTimeSelection(hours, minutesStr, timeField);
              }}
            >
              {t('general.now')}
            </button>
          )}
          <button 
            type="button" 
            className="time-picker-action primary" 
            onClick={() => {
              const todayTime = '09:00';
              const [hours, minutes] = todayTime.split(':');
              handleTimeSelection(hours, minutes, timeField);
            }}
          >
            {t('general.today')}
          </button>
        </div>
      </div>
    );
  };

  const renderCalendar = (show, fieldName, ref, inputRef) => {
    if (!show) return null;
    
    const lang = isRTL ? 'he' : 'en';
    const shouldAppearAbove = shouldCalendarAppearAbove(inputRef);
    
    return (
      <div 
        className={`task-calendar-dropdown ${isRTL ? 'rtl' : 'ltr'} ${shouldAppearAbove ? 'calendar-above' : ''}`} 
        ref={ref}
      >
        <div className="task-calendar-header">
          <button 
            type="button" 
            className="task-month-nav prev" 
            onClick={() => setCurrentMonth(prev => {
              const newMonth = new Date(prev);
              newMonth.setMonth(newMonth.getMonth() - 1);
              return newMonth;
            })}
          >
            &#9650;
          </button>
          <div className="task-current-month">
            {monthNames[lang][currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button 
            type="button" 
            className="task-month-nav next" 
            onClick={() => setCurrentMonth(prev => {
              const newMonth = new Date(prev);
              newMonth.setMonth(newMonth.getMonth() + 1);
              return newMonth;
            })}
          >
            &#9660;
          </button>
        </div>
        <div className="task-calendar-days-header">
          {dayNames[lang].map((day, index) => (
            <div key={index} className="task-day-name">{day}</div>
          ))}
        </div>
        <div className="task-calendar-days">
          {renderCalendarDays(fieldName)}
        </div>
        <div className="task-calendar-footer">
          <button 
            type="button" 
            className="task-calendar-btn clear"
            onClick={() => handleClearDate(fieldName)}
          >
            {t('general.clear')}
          </button>
          <button 
            type="button" 
            className="task-calendar-btn today"
            onClick={() => handleToday(fieldName)}
          >
            {t('general.today')}
          </button>
        </div>
      </div>
    );
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = t('events.features.tasks.validation.titleRequired');
    }

    if (!formData.dueDate) {
      newErrors.dueDate = t('events.features.tasks.validation.dueDateRequired');
    } else {
      const selectedDate = new Date(formData.dueDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        newErrors.dueDate = t('events.features.tasks.validation.dueDatePast');
      } else {
        const dueDateError = validateDueDateAgainstEvent(formData.dueDate);
        if (dueDateError) {
          newErrors.dueDate = dueDateError;
        }
      }
    }

    if (formData.reminderDate) {
      if (formData.dueDate) {
        const reminderDateTime = new Date(formData.reminderDate);
        const dueDateTime = new Date(formData.dueDate);
        
        if (formData.reminderTime) {
          const [reminderHour, reminderMinute] = formData.reminderTime.split(':');
          reminderDateTime.setHours(parseInt(reminderHour), parseInt(reminderMinute), 0, 0);
        }
        
        if (formData.dueTime) {
          const [dueHour, dueMinute] = formData.dueTime.split(':');
          dueDateTime.setHours(parseInt(dueHour), parseInt(dueMinute), 0, 0);
        }
        
        if (reminderDateTime >= dueDateTime) {
          newErrors.reminderDate = t('events.features.tasks.validation.reminderBeforeDue');
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      await onSave(formData);
    } catch (error) {
      showError(t('events.features.tasks.messages.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          ✕
        </button>

        {errorMessage && (
          <div className="task-modal-error-message">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('events.features.tasks.form.title')} *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              onFocus={() => handleFocus('title')}
              onBlur={handleBlur}
              className={`form-input ${errors.title ? 'error' : ''} ${formData.title ? 'filled' : ''}`}
              placeholder={t('events.features.tasks.form.titlePlaceholder')}
              maxLength={200}
              disabled={!canEdit}
            />
            {errors.title && <div className="field-error">{errors.title}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">{t('events.features.tasks.form.description')}</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              onFocus={() => handleFocus('description')}
              onBlur={handleBlur}
              className={`form-textarea ${formData.description ? 'filled' : ''} ${isRTL ? 'form-textarea-rtl' : 'form-textarea-ltr'}`}
              placeholder={t('events.features.tasks.form.descriptionPlaceholder')}
              maxLength={1000}
              rows={3}
              disabled={!canEdit}
            />
          </div>

          <div className="form-row">
            <div className="form-group-with-error-space">
              <label className="form-label">{t('events.features.tasks.form.dueDate')} *</label>
              <div className="task-date-input-container">
                <div className="task-date-display-wrapper">
                  <input
                    ref={dueDateInputRef}
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={displayDueDate}
                    readOnly
                    className={`task-date-display-input ${errors.dueDate ? 'input-error' : ''} ${formData.dueDate ? 'filled' : ''}`}
                    onClick={() => canEdit && toggleCalendar('dueDate')}
                    disabled={!canEdit}
                  />
                  <div className={`task-calendar-icon ${isRTL ? 'rtl' : 'ltr'} ${!canEdit ? 'icon-readonly' : ''}`}
                   onClick={() => canEdit && toggleCalendar('dueDate')}
                   > 
                    <span role="img" aria-label="calendar">📅</span>
                  </div>
                </div>
                {renderCalendar(showDueDateCalendar, 'dueDate', dueDateCalendarRef, dueDateInputRef)}
              </div>
              <div className="field-error-space">
                {errors.dueDate && <div className="field-error">{errors.dueDate}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('events.features.tasks.form.dueTime')}</label>
              
              <div className="time-input-container">
                <input
                  type="text"
                  name="dueTime"
                  value={formData.dueTime}
                  onChange={handleChange}
                  ref={dueTimePickerRef}
                  placeholder="HH:MM"
                  className={`time-input ${formData.dueTime ? 'filled' : ''}`}
                  disabled={!canEdit}
                />
                <div className={`time-icon due-time-icon ${isRTL ? 'rtl' : 'ltr'} ${!canEdit ? 'icon-readonly' : ''}`}
                onClick={() => canEdit && setShowDueTimePicker(!showDueTimePicker)}
                >
                  <span role="img" aria-label="clock">🕒</span>
                </div>
                
                {renderTimePicker('dueTime', showDueTimePicker, setShowDueTimePicker, dueTimePickerContainerRef)}
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">{t('events.features.tasks.form.priority')}</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                onFocus={() => handleFocus('priority')}
                onBlur={handleBlur}
                className={`form-select priority-select ${formData.priority && formData.priority !== 'medium' ? 'filled' : ''}`}
                disabled={!canEdit}
              >
                <option value="low">{t('events.features.tasks.priority.low')}</option>
                <option value="medium">{t('events.features.tasks.priority.medium')}</option>
                <option value="high">{t('events.features.tasks.priority.high')}</option>
                <option value="urgent">{t('events.features.tasks.priority.urgent')}</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">{t('events.features.tasks.form.category')}</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                onFocus={() => handleFocus('category')}
                onBlur={handleBlur}
                className={`form-select ${formData.category && formData.category !== 'other' ? 'filled' : ''}`}
                disabled={!canEdit}
              >
                <option value="venue">{t('events.features.tasks.category.venue')}</option>
                <option value="catering">{t('events.features.tasks.category.catering')}</option>
                <option value="decoration">{t('events.features.tasks.category.decoration')}</option>
                <option value="entertainment">{t('events.features.tasks.category.entertainment')}</option>
                <option value="photography">{t('events.features.tasks.category.photography')}</option>
                <option value="invitations">{t('events.features.tasks.category.invitations')}</option>
                <option value="transportation">{t('events.features.tasks.category.transportation')}</option>
                <option value="budget">{t('events.features.tasks.category.budget')}</option>
                <option value="other">{t('events.features.tasks.category.other')}</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group-with-error-space">
              <label className="form-label">{t('events.features.tasks.form.reminderDate')}</label>
              <div className="task-date-input-container">
                <div className="task-date-display-wrapper">
                  <input
                    ref={reminderInputRef}
                    type="text"
                    placeholder="DD/MM/YYYY"
                    value={displayReminderDate}
                    readOnly
                    className={`task-date-display-input ${errors.reminderDate ? 'input-error' : ''} ${formData.reminderDate ? 'filled' : ''}`}
                    onClick={() => canEdit && toggleCalendar('reminderDate')}
                    disabled={!canEdit}
                  />
                  <div className={`task-calendar-icon ${isRTL ? 'rtl' : 'ltr'} ${!canEdit ? 'icon-readonly' : ''}`}
                   onClick={() => canEdit && toggleCalendar('reminderDate')}
                   >
                    <span role="img" aria-label="calendar">📅</span>
                  </div>
                </div>
                {renderCalendar(showReminderCalendar, 'reminderDate', reminderCalendarRef, reminderInputRef)}
              </div>
              <div className="field-error-space">
                {errors.reminderDate && <div className="field-error">{errors.reminderDate}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">{t('events.features.tasks.form.reminderTime')}</label>
              
              <div className="time-input-container">
                <input
                  type="text"
                  name="reminderTime"
                  value={formData.reminderTime}
                  onChange={handleChange}
                  ref={reminderTimePickerRef}
                  placeholder="HH:MM"
                  disabled={!formData.reminderDate || !canEdit}
                  className={`time-input ${formData.reminderTime ? 'filled' : ''} ${!formData.reminderDate ? 'disabled' : ''}`}
                />
                <div 
                  className={`time-icon reminder-time-icon ${isRTL ? 'rtl' : 'ltr'} ${!formData.reminderDate ? 'disabled' : ''} ${!canEdit ? 'icon-readonly' : ''}`}
                  onClick={() => canEdit && formData.reminderDate && setShowReminderTimePicker(!showReminderTimePicker)}
                >
                  <span role="img" aria-label="clock">🕒</span>
                </div>
                
                {formData.reminderDate && renderTimePicker('reminderTime', showReminderTimePicker, setShowReminderTimePicker, reminderTimePickerContainerRef)}
              </div>
            </div>
          </div>

          {/* Recurring Reminder Checkbox */}
          <div className="form-row recurring-reminder-row">
            <div className="form-group">
              <div className="recurring-reminder-container">
                {formData.reminderRecurrence !== 'none' && (
                  <span className="recurring-selected">
                    ({recurringOptions.find(opt => opt.value === formData.reminderRecurrence)?.label})
                  </span>
                )}
                <label htmlFor="recurringReminder" className="recurring-label">
                  {t('events.features.tasks.form.recurringReminder')}
                </label>
                <input
                  type="checkbox"
                  id="recurringReminder"
                  checked={recurringReminderEnabled}
                  onChange={handleRecurringCheckboxChange}
                  className="recurring-checkbox"
                  disabled={!canEdit}
                />
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('events.features.tasks.form.notes')}</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              onFocus={() => handleFocus('notes')}
              onBlur={handleBlur}
              className={`form-textarea ${formData.notes ? 'filled' : ''} ${isRTL ? 'form-textarea-rtl' : 'form-textarea-ltr'}`}
              placeholder={t('events.features.tasks.form.notesPlaceholder')}
              maxLength={500}
              rows={2}
              disabled={!canEdit}
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={onClose}
            >
              {t('general.cancel')}
            </button>
            {canEdit && (
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? t('general.loading') : t('general.save')}
            </button>
          )}
          </div>
        </form>
      </div>

      {/* Recurring Reminder Options Modal */}
      {showRecurringModal && (
        <div className="modal-overlay recurring-modal-overlay" onClick={() => setShowRecurringModal(false)}>
          <div className="modal-content recurring-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recurring-modal-header">
              <h3>{t('events.features.tasks.reminders.selectFrequency')}</h3>
              <button 
                className="modal-close" 
                onClick={() => setShowRecurringModal(false)}
              >
                ✕
              </button>
            </div>
            <div className="recurring-options">
              {recurringOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`recurring-option-btn ${formData.reminderRecurrence === option.value ? 'selected' : ''}`}
                  onClick={() => handleRecurringOptionSelect(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskModal;
