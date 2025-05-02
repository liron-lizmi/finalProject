import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/CreateEventPage.css';
import { useTranslation } from 'react-i18next';

const CreateEventPage = () => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he'; // Check if current language is Hebrew
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

  // Calculate current date in ISO format
  const today = new Date().toISOString().split('T')[0];

  // Create hours for time picker
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  // Month names in both languages
  const monthNames = {
    en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    he: ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר']
  };
  
  // Day names in both languages
  const dayNames = {
    en: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],
    he: ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש']
  };

  // Close calendar and time picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Close time picker if clicked outside
      if (
        timePickerContainerRef.current && 
        !timePickerContainerRef.current.contains(event.target) &&
        !event.target.classList.contains('time-icon')
      ) {
        setShowTimePicker(false);
      }
      
      // Close calendar if clicked outside
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

  // Update display date when eventDate changes
  useEffect(() => {
    if (eventData.eventDate) {
      if (isRTL) {
        // Format as DD/MM/YYYY for Hebrew
        const [year, month, day] = eventData.eventDate.split('-');
        setDisplayDate(`${day}/${month}/${year}`);
      } else {
        // Format as MM/DD/YYYY for English
        const [year, month, day] = eventData.eventDate.split('-');
        setDisplayDate(`${month}/${day}/${year}`);
      }
      
      // Set current month in calendar
      setCurrentMonth(new Date(eventData.eventDate));
    } else {
      setDisplayDate('');
    }
  }, [eventData.eventDate, i18n.language]);

  // Check if time is valid
  const isValidTime = (timeString) => {
    if (!timeString) return false;
    
    // Check format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
  };

  const handleTimeChange = (e) => {
    let value = e.target.value;
    
    // Filter invalid values
    if (value && !isValidTime(value)) {
      // If invalid, try to clean the format
      value = value.replace(/[^0-9:]/g, '');
      
      // If no colon but exactly 4 numbers, format automatically to time format
      if (!value.includes(':') && value.length === 4) {
        const hours = value.substring(0, 2);
        const minutes = value.substring(2, 4);
        value = `${hours}:${minutes}`;
      }
      
      // Remove any AM/PM reference
      value = value.replace(/\s*(am|pm)\s*/i, '');
      
      // If still invalid but already has :, keep as is
      if (value.includes(':') && !isValidTime(value)) {
        // Check if there's an error
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
    
    // Check if time is valid after update
    if (value === '' || isValidTime(value)) {
      setTimeError('');
    } else {
      setTimeError(t('errors.invalidTimeFormatExample'));
    }
  };

  // Select time from time picker
  const handleTimeSelection = (hour, minute) => {
    const formattedTime = `${hour}:${minute}`;
    setEventData(prev => ({
      ...prev,
      eventTime: formattedTime
    }));
    setTimeError(''); // Clear error if time is valid
    setShowTimePicker(false);
  };

  // Select date from calendar
  const handleDateSelect = (day) => {
    const selected = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      day
    );
    
    // Format as YYYY-MM-DD for the internal state
    const formattedDate = selected.toISOString().split('T')[0];
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

  // Toggle calendar visibility
  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };

  // Toggle time picker visibility
  const toggleTimePicker = () => {
    setShowTimePicker(prev => !prev);
  };

  // Handle previous month in calendar
  const handlePrevMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() - 1);
      return newMonth;
    });
  };

  // Handle next month in calendar
  const handleNextMonth = () => {
    setCurrentMonth(prev => {
      const newMonth = new Date(prev);
      newMonth.setMonth(newMonth.getMonth() + 1);
      return newMonth;
    });
  };

  // Check if date is selectable (not before minDate)
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

  // Check if date is selected
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

  // Handle today selection
  const handleToday = () => {
    const todayDate = new Date();
    // Format as YYYY-MM-DD
    const formattedDate = todayDate.toISOString().split('T')[0];
    setEventData(prev => ({
      ...prev,
      eventDate: formattedDate
    }));
    setCurrentMonth(todayDate);
    setShowCalendar(false);
  };

  // Handle clear date
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
    
    // Validate form
    let hasError = false;
    
    // Date validation
    if (!eventData.eventDate) {
      setDateError(t('errors.invalidDateFormat'));
      hasError = true;
    }
    
    // Format time to valid format if needed
    let timeToSubmit = eventData.eventTime;
    
    // If user entered just numbers without format (e.g.: 1630)
    if (/^\d{1,4}$/.test(eventData.eventTime) && !eventData.eventTime.includes(':')) {
      if (eventData.eventTime.length <= 2) {
        // Just hour (e.g.: 16)
        timeToSubmit = `${eventData.eventTime.padStart(2, '0')}:00`;
      } else {
        // Hour and minutes (e.g.: 1630)
        const hours = eventData.eventTime.slice(0, 2).padStart(2, '0');
        const minutes = eventData.eventTime.slice(2).padStart(2, '0');
        timeToSubmit = `${hours}:${minutes}`;
      }
    }
    
    // Validate formatted time
    if (!timeToSubmit || !isValidTime(timeToSubmit)) {
      setTimeError(t('errors.invalidTimeFormatExample'));
      hasError = true;
    }
    
    // If there's an error, stop submission
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

      navigate('/dashboard');
      
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

  // Render calendar days
  const renderCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    
    const days = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }
    
    // Add days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const selectable = isDateSelectable(day);
      const selected = isDateSelected(day);
      
      days.push(
        <div
          key={day}
          className={`calendar-day ${selectable ? 'selectable' : 'disabled'} ${selected ? 'selected' : ''}`}
          onClick={() => selectable && handleDateSelect(day)}
        >
          {day}
        </div>
      );
    }
    
    return days;
  };

  // Render calendar
  const renderCalendar = () => {
    if (!showCalendar) return null;
    
    const lang = isRTL ? 'he' : 'en';
    
    return (
      <div className={`calendar-dropdown ${isRTL ? 'rtl' : 'ltr'}`} ref={calendarRef}>
        <div className="calendar-header">
          <button 
            type="button" 
            className="month-nav prev" 
            onClick={handlePrevMonth}
          >
            &#9650;
          </button>
          <div className="current-month">
            {monthNames[lang][currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </div>
          <button 
            type="button" 
            className="month-nav next" 
            onClick={handleNextMonth}
          >
            &#9660;
          </button>
        </div>
        <div className="calendar-days-header">
          {dayNames[lang].map((day, index) => (
            <div key={index} className="day-name">{day}</div>
          ))}
        </div>
        <div className="calendar-days">
          {renderCalendarDays()}
        </div>
        <div className="calendar-footer">
          <button 
            type="button" 
            className="calendar-btn clear"
            onClick={handleClearDate}
          >
            {isRTL ? 'ניקוי' : 'Clear'}
          </button>
          <button 
            type="button" 
            className="calendar-btn today"
            onClick={handleToday}
          >
            {isRTL ? 'היום' : 'Today'}
          </button>
        </div>
      </div>
    );
  };

  // Render time picker
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
                  // Select hour with default minutes (00)
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
                  // Select minutes with current hour
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
            {isRTL ? 'ניקוי' : 'Clear'}
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
            {isRTL ? 'עכשיו' : 'Now'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`create-event-container ${isRTL ? 'rtl' : 'ltr'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
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
            
            <div className="date-input-container">
              <div className="date-display-wrapper">
                <input
                  type="text"
                  id="eventDateDisplay"
                  placeholder={isRTL ? "DD/MM/YYYY" : "MM/DD/YYYY"}
                  value={displayDate}
                  readOnly
                  className={`date-display-input ${dateError ? 'input-error' : ''}`}
                  onClick={toggleCalendar}
                />
                <div className={`calendar-icon ${isRTL ? 'rtl' : 'ltr'}`} onClick={toggleCalendar}>
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
                className={`time-input ${timeError ? 'input-error' : ''}`}
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
  );
};

export default CreateEventPage;