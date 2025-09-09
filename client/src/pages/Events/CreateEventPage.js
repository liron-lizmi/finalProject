import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/CreateEventPage.css';
import { useTranslation } from 'react-i18next';

const CreateEventPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he'; 
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState({
    eventName: '',
    eventDate: '',
    eventTime: ''
  });
  const [displayDate, setDisplayDate] = useState('');
  const [dateError, setDateError] = useState('');
  const [timeError, setTimeError] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const timePickerRef = useRef(null);
  const timePickerContainerRef = useRef(null);
  const calendarRef = useRef(null);

  const today = new Date().toISOString().split('T')[0];

  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  const monthNames = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  };
  
  const dayNames = {
    en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        timePickerContainerRef.current && 
        !timePickerContainerRef.current.contains(event.target) &&
        !event.target.classList.contains('time-icon')
      ) {
        setShowTimePicker(false);
      }
      
      if (
        calendarRef.current &&
        !calendarRef.current.contains(event.target) &&
        !event.target.classList.contains('calendar-icon') &&
        !event.target.classList.contains('date-display-input')
      ) {
        setShowCalendar(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (eventData.eventDate) {
      if (isRTL) {
        const [year, month, day] = eventData.eventDate.split('-');
        setDisplayDate(`${day}/${month}/${year}`);
      } else {
        const [year, month, day] = eventData.eventDate.split('-');
        setDisplayDate(`${month}/${day}/${year}`);
      }
      
      setCurrentMonth(new Date(eventData.eventDate));
    } else {
      setDisplayDate('');
    }
  }, [eventData.eventDate, i18n.language]);

  const isValidTime = (timeString) => {
    if (!timeString) return false;
    
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
  };

  const handleTimeChange = (e) => {
    let value = e.target.value;
    
    if (value && !isValidTime(value)) {
      value = value.replace(/[^0-9:]/g, '');
      
      if (!value.includes(':') && value.length === 4) {
        const hours = value.substring(0, 2);
        const minutes = value.substring(2, 4);
        value = `${hours}:${minutes}`;
      }
      
      value = value.replace(/\s*(am|pm)\s*/i, '');
      
      if (value.includes(':') && !isValidTime(value)) {
        if (value !== '') {
          setTimeError(t('errors.invalidTimeFormat'));
        }
        return;
      }
    }
    
    setEventData(prev => ({
      ...prev,
      eventTime: value
    }));
    
    if (value === '' || isValidTime(value)) {
      setTimeError('');
    } else {
      setTimeError(t('errors.invalidTimeFormat'));
    }
  };

  const handleTimeSelection = (hour, minute) => {
    const formattedTime = `${hour}:${minute}`;
    setEventData(prev => ({
      ...prev,
      eventTime: formattedTime
    }));
    setTimeError(''); 
    setShowTimePicker(false);
  };

  const handleDateSelect = (day) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day,
      12,
      0,  
      0,  
      0   
    );
    
    const year = selected.getFullYear();
    const month = (selected.getMonth() + 1).toString().padStart(2, '0');
    const dayStr = selected.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${dayStr}`;
    
    setEventData(prev => ({
      ...prev,
      eventDate: formattedDate
    }));
    
    setDateError('');
    setShowCalendar(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name !== 'eventDate') {
      setEventData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  const toggleTimePicker = () => {
    setShowTimePicker(prev => !prev);
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() - 1);
      return newMonth;
    });
  };

  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  const isDateSelectable = (day) => {
    if (!today) return true;
    
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    const min = new Date(today);
    min.setHours(0, 0, 0, 0);
    
    return date >= min;
  };

  const isDateSelected = (day) => {
    if (!eventData.eventDate) return false;
    
    const selected = new Date(eventData.eventDate);
    const date = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    
    return (
      selected.getDate() === date.getDate() &&
      selected.getMonth() === date.getMonth() &&
      selected.getFullYear() === date.getFullYear()
    );
  };

  const handleToday = () => {
    const todayDate = new Date();
    
    const year = todayDate.getFullYear();
    const month = (todayDate.getMonth() + 1).toString().padStart(2, '0');
    const day = todayDate.getDate().toString().padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    setEventData(prev => ({
      ...prev,
      eventDate: formattedDate
    }));
    setCurrentMonth(todayDate);
    setShowCalendar(false);
  };

  const handleClearDate = () => {
    setEventData(prev => ({
      ...prev,
      eventDate: ''
    }));
    setDisplayDate('');
    setShowCalendar(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    let hasError = false;
    
    if (!eventData.eventDate) {
      setDateError(t('errors.invalidDateFormat'));
      hasError = true;
    }
    
    let timeToSubmit = eventData.eventTime;
    
    if (/^\d{1,4}$/.test(eventData.eventTime) && !eventData.eventTime.includes(':')) {
      if (eventData.eventTime.length <= 2) {
        timeToSubmit = `${eventData.eventTime.padStart(2, '0')}:00`;
      } else {
        const hours = eventData.eventTime.slice(0, 2).padStart(2, '0');
        const minutes = eventData.eventTime.slice(2).padStart(2, '0');
        timeToSubmit = `${hours}:${minutes}`;
      }
    }
    
    if (!timeToSubmit || !isValidTime(timeToSubmit)) {
      setTimeError(t('errors.invalidTimeFormat'));
      hasError = true;
    }
    
    if (hasError) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }

      const response = await axios.post(
        '/api/events',
        {
          title: eventData.eventName,
          date: eventData.eventDate,
          time: timeToSubmit,
          type: 'other',
          guestCount: 0
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        }
      );

      navigate('/dashboard?refresh=true');
      
    } catch (err) {
      console.error('Error creating event:', err);
      setError(err.response?.data?.message || t('errors.eventCreationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigate('/dashboard');
  };

  const renderCalendarDays = () => {
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
      const selected = isDateSelected(day);
      
      days.push(
        <div
          key={day}
          className={`task-calendar-day ${selectable ? 'selectable' : 'disabled'} ${selected ? 'selected' : ''}`}
          onClick={() => selectable && handleDateSelect(day)}
        >
          {day}
        </div>
      );
    }
    
    return days;
  };

  const renderCalendar = () => {
    if (!showCalendar) return null;
    
    const lang = isRTL ? 'he' : 'en';
    
    return (
      <div className={`task-calendar-dropdown ${isRTL ? 'ltr' : 'rtl'}`} ref={calendarRef}>
        <div className="task-calendar-header">
          <button 
            type="button" 
            className="task-month-nav prev" 
            onClick={handlePrevMonth}
          >
            {isRTL ? '❯' : '❮'}
          </button>
          <div className="task-current-month">
            {monthNames[lang][currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button 
            type="button" 
            className="task-month-nav next" 
            onClick={handleNextMonth}
          >
            {isRTL ? '❮' : '❯'}
          </button>
        </div>
        <div className="task-calendar-days-header">
          {dayNames[lang].map((day, index) => (
            <div key={index} className="task-day-name">{day}</div>
          ))}
        </div>
        <div className="task-calendar-days">
          {renderCalendarDays()}
        </div>
        <div className="task-calendar-footer">
          <button 
            type="button" 
            className="task-calendar-btn clear"
            onClick={handleClearDate}
          >
            {t('general.clear')}
          </button>
          <button 
            type="button" 
            className="task-calendar-btn today"
            onClick={handleToday}
          >
            {t('general.today')}
          </button>
        </div>
      </div>
    );
  };

  const renderTimePicker = () => {
    if (!showTimePicker) return null;
    
    return (
      <div className={`time-picker-dropdown ${isRTL ? 'rtl' : 'ltr'}`} ref={timePickerContainerRef}>
        <div className={`time-picker-header ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="time-picker-close" onClick={() => setShowTimePicker(false)}>✕</div>
        </div>
        <div className={`time-picker-content ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="time-picker-hours">
            {hours.map(hour => (
              <div 
                key={hour} 
                className="time-picker-hour"
                onClick={() => {
                  const minute = eventData.eventTime?.split(':')?.[1] || '00';
                  handleTimeSelection(hour, minute);
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
                  const hour = eventData.eventTime?.split(':')?.[0] || '18';
                  handleTimeSelection(hour, minute);
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
              setEventData(prev => ({ ...prev, eventTime: '' }));
              setShowTimePicker(false);
            }}
          >
            {t('general.clear')}
          </button>
          <button 
            type="button" 
            className="time-picker-action primary" 
            onClick={() => {
              const now = new Date();
              const hours = now.getHours().toString().padStart(2, '0');
              const minutes = Math.floor(now.getMinutes() / 5) * 5;
              const minutesStr = minutes.toString().padStart(2, '0');
              handleTimeSelection(hours, minutesStr);
            }}
          >
            {t('general.now')}
          </button>
        </div>
      </div>
    );
  };

  return (
    <>
    <div className={`auth-logo-container ${isRTL ? 'rtl' : 'ltr'}`}>
      <img src="/images/logo.png" alt={t('general.appLogo')} className="logo" />
    </div>
    <div className={`create-event-container ${isRTL ? 'rtl' : 'ltr'}`}>

      <div className="create-event-header">
        <h1>{t('events.createEvent')}</h1>
        <p>{t('events.fillDetails')}</p>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="event-form-container">
        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-group">
            <label htmlFor="eventName">{t('events.eventName')}</label>
            <input 
              type="text"
              id="eventName"
              name="eventName"
              value={eventData.eventName}
              onChange={handleInputChange}
              required
              className="form-input"
              placeholder={t('events.eventNamePlaceholder')}
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="eventDate">{t('events.eventDate')}</label>
            
            <div className="task-date-input-container">
              <div className="task-date-display-wrapper">
                <input
                  type="text"
                  id="eventDateDisplay"
                  placeholder={isRTL ? "DD/MM/YYYY" : "MM/DD/YYYY"}
                  value={displayDate}
                  readOnly
                  className={`task-date-display-input ${dateError ? 'input-error' : ''} ${eventData.eventDate ? 'filled' : ''}`}
                  onClick={toggleCalendar}
                />
                <div className={`task-calendar-icon ${isRTL ? 'rtl' : 'ltr'}`} onClick={toggleCalendar}>
                  <span role="img" aria-label="calendar">📅</span>
                </div>
              </div>
              {renderCalendar()}
            </div>
            {dateError && <div className="field-error">{dateError}</div>}
          </div>
          
          <div className="form-group">
            <label htmlFor="eventTime">{t('events.eventTime')}</label>
            
            <div className="time-input-container">
              <input
                type="text"
                id="eventTime"
                name="eventTime"
                value={eventData.eventTime}
                onChange={handleTimeChange}
                ref={timePickerRef}
                placeholder="HH:MM"
                required
                className={`time-input ${timeError ? 'input-error' : ''} ${eventData.eventTime ? 'filled' : ''}`}
              />
              <div className={`time-icon ${isRTL ? 'rtl' : 'ltr'}`} onClick={toggleTimePicker}>
                <span role="img" aria-label="clock">🕒</span>
              </div>
              
              {renderTimePicker()}
            </div>
            {timeError && <div className="field-error">{timeError}</div>}
          </div>
          
          <div className={`form-actions ${isRTL ? 'rtl' : 'ltr'}`}>
            <button 
              type="button" 
              className="cancel-button" 
              onClick={handleCancel}
              disabled={loading}
            >
              {t('general.cancel')}
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? t('events.creating') : t('events.createEventButton')}
            </button>
          </div>
        </form>
      </div>
      </div>
  </>
  );
};

export default CreateEventPage;