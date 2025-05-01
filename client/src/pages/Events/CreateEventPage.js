import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/CreateEventPage.css';
import { useTranslation } from 'react-i18next';

const CreateEventPage = () => {
  const { t } = useTranslation();
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
  const datePickerRef = useRef(null);
  const timePickerRef = useRef(null);
  const timePickerContainerRef = useRef(null);

  // Calculate current date in ISO format
  const today = new Date().toISOString().split('T')[0];

  // Create hours for time picker
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  // Close time picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        timePickerContainerRef.current && 
        !timePickerContainerRef.current.contains(event.target) &&
        !event.target.classList.contains('time-icon')
      ) {
        setShowTimePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Convert date from DD/MM/YYYY format to YYYY-MM-DD
  const convertToISODate = (dateString) => {
    if (!dateString) return '';
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return '';
    
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
  };

  // Convert date from YYYY-MM-DD format to DD/MM/YYYY
  const convertToDisplayDate = (isoDate) => {
    if (!isoDate) return '';
    
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // Check if date is valid and in the future
  const isValidFutureDate = (dateString) => {
    if (!dateString) return false;
    
    // Check format
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);
    if (!match) return false;
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    // Basic validity check
    if (month < 1 || month > 12) return false;
    
    // Days in month
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return false;
    
    // Check if date is in the future
    const inputDate = new Date(year, month - 1, day);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    return inputDate >= currentDate;
  };

  // Check if time is valid
  const isValidTime = (timeString) => {
    if (!timeString) return false;
    
    // Check format (HH:MM)
    const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    return timeRegex.test(timeString);
  };

  const handleDateChange = (e) => {
    const isoDate = e.target.value;
    if (isoDate) {
      setEventData(prev => ({
        ...prev,
        eventDate: isoDate
      }));
      
      setDisplayDate(convertToDisplayDate(isoDate));
      setDateError(''); // Clear error if date is valid
    }
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

  const handleDisplayDateChange = (e) => {
    // Maintain date format during typing
    let value = e.target.value;
    
    // Remove any characters that are not numbers or /
    value = value.replace(/[^\d\/]/g, '');
    
    // Replace multiple consecutive slashes with a single one
    value = value.replace(/\/+/g, '/');
    
    // Limit length to 10 characters (DD/MM/YYYY)
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    // If user typed 2 digits (day), add a slash
    if (value.length === 2 && !value.includes('/') && displayDate.length < 2) {
      value += '/';
    }
    
    // If user typed 5 characters (DD/MM), add a slash
    if (value.length === 5 && value.split('/').length === 2 && displayDate.length < 5) {
      value += '/';
    }
    
    setDisplayDate(value);
    
    // Update date in ISO format only if date is valid
    if (isValidFutureDate(value)) {
      const isoDate = convertToISODate(value);
      setEventData(prev => ({
        ...prev,
        eventDate: isoDate
      }));
      setDateError(''); // Clear error if date is valid
    } else {
      // If date is invalid, just store the display but don't update ISO value
      if (value === '') {
        setEventData(prev => ({
          ...prev,
          eventDate: ''
        }));
        setDateError(''); // If field is empty, don't show error
      } else {
        setDateError(t('errors.invalidDateFormat'));
      }
    }
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

  const toggleDatePicker = () => {
    if (datePickerRef.current) {
      datePickerRef.current.showPicker();
    }
  };

  // Open/close time picker
  const toggleTimePicker = () => {
    setShowTimePicker(prev => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate date and time before submitting the form
    let hasError = false;
    
    // Date validation
    if (!eventData.eventDate || !isValidFutureDate(displayDate)) {
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

  return (
    <div className="create-event-container">
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
              <input
                type="date"
                id="eventDateISO"
                name="eventDate"
                value={eventData.eventDate}
                onChange={handleDateChange}
                min={today}
                ref={datePickerRef}
                className="hidden-date-input"
              />
              
              <div className="date-display-wrapper">
                <input
                  type="text"
                  id="eventDateDisplay"
                  placeholder="DD/MM/YYYY"
                  value={displayDate}
                  onChange={handleDisplayDateChange}
                  className={`date-display-input ${dateError ? 'input-error' : ''}`}
                />
                <div className="calendar-icon" onClick={toggleDatePicker}>
                  <span role="img" aria-label="calendar">📅</span>
                </div>
              </div>
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
              <div className="time-icon" onClick={toggleTimePicker}>
                <span role="img" aria-label="clock">🕒</span>
              </div>
              
              {/* Time picker in 24-hour format */}
              {showTimePicker && (
                <div className="time-picker-dropdown" ref={timePickerContainerRef}>
                  <div className="time-picker-header">
                    <div className="time-picker-close" onClick={() => setShowTimePicker(false)}>✕</div>
                  </div>
                  <div className="time-picker-content">
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
                </div>
              )}
            </div>
            {timeError && <div className="field-error">{timeError}</div>}
          </div>
          
          <div className="form-actions">
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