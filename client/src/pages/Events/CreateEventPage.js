import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/CreateEventPage.css';

const CreateEventPage = () => {
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

  // חישוב התאריך הנוכחי בפורמט ISO
  const today = new Date().toISOString().split('T')[0];

  // יצירת שעות לבורר השעות
  const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

  // סגירת בורר השעות בלחיצה מחוץ לבורר
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

  // המרת תאריך מפורמט DD/MM/YYYY לפורמט YYYY-MM-DD
  const convertToISODate = (dateString) => {
    if (!dateString) return '';
    
    const parts = dateString.split('/');
    if (parts.length !== 3) return '';
    
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    
    return `${year}-${month}-${day}`;
  };

  // המרת תאריך מפורמט YYYY-MM-DD לפורמט DD/MM/YYYY
  const convertToDisplayDate = (isoDate) => {
    if (!isoDate) return '';
    
    const [year, month, day] = isoDate.split('-');
    return `${day}/${month}/${year}`;
  };

  // בדיקה אם התאריך תקין ובעתיד
  const isValidFutureDate = (dateString) => {
    if (!dateString) return false;
    
    // בדיקת פורמט
    const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
    const match = dateString.match(dateRegex);
    if (!match) return false;
    
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    
    // בדיקת תקינות בסיסית
    if (month < 1 || month > 12) return false;
    
    // מספר ימים בחודש
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth) return false;
    
    // בדיקה שהתאריך בעתיד
    const inputDate = new Date(year, month - 1, day);
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    return inputDate >= currentDate;
  };

  // בדיקת תקינות של השעה
  const isValidTime = (timeString) => {
    if (!timeString) return false;
    
    // בדיקת פורמט (HH:MM)
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
      setDateError(''); // ניקוי שגיאה אם התאריך תקין
    }
  };

  const handleTimeChange = (e) => {
    let value = e.target.value;
    
    // סינון ערכים לא תקינים
    if (value && !isValidTime(value)) {
      // אם לא תקין, נסה לנקות את הפורמט
      value = value.replace(/[^0-9:]/g, '');
      
      // אם אין נקודותיים אבל יש 4 מספרים בדיוק, מפורמטים אוטומטית לפורמט שעה
      if (!value.includes(':') && value.length === 4) {
        const hours = value.substring(0, 2);
        const minutes = value.substring(2, 4);
        value = `${hours}:${minutes}`;
      }
      
      // הסר כל אזכור ל-AM/PM
      value = value.replace(/\s*(am|pm)\s*/i, '');
      
      // אם עדיין לא תקין אבל יש : כבר, נשאיר את מה שיש
      if (value.includes(':') && !isValidTime(value)) {
        // בדיקה אם יש שגיאה
        if (value !== '') {
          setTimeError('יש להזין שעה תקינה בפורמט 24 שעות ');
        }
        return;
      }
    }
    
    setEventData(prev => ({
      ...prev,
      eventTime: value
    }));
    
    // בדיקה אם השעה חוקית לאחר העדכון
    if (value === '' || isValidTime(value)) {
      setTimeError('');
    } else {
      setTimeError('יש להזין שעה תקינה בפורמט 24 שעות (לדוגמה: 14:30)');
    }
  };

  // בחירת שעה מבורר השעות
  const handleTimeSelection = (hour, minute) => {
    const formattedTime = `${hour}:${minute}`;
    setEventData(prev => ({
      ...prev,
      eventTime: formattedTime
    }));
    setTimeError(''); // ניקוי שגיאה אם השעה תקינה
    setShowTimePicker(false);
  };

  const handleDisplayDateChange = (e) => {
    // שומרים על הפורמט של התאריך בזמן הקלדה
    let value = e.target.value;
    
    // נסיר כל תווים שלא מספרים או /
    value = value.replace(/[^\d\/]/g, '');
    
    // נחליף כל שני סלשים או יותר ברציפות בסלש אחד
    value = value.replace(/\/+/g, '/');
    
    // מגבילים את האורך ל-10 תווים (DD/MM/YYYY)
    if (value.length > 10) {
      value = value.slice(0, 10);
    }
    
    // אם המשתמש הקליד 2 ספרות (יום), נוסיף סלש
    if (value.length === 2 && !value.includes('/') && displayDate.length < 2) {
      value += '/';
    }
    
    // אם המשתמש הקליד 5 תווים (DD/MM), נוסיף סלש
    if (value.length === 5 && value.split('/').length === 2 && displayDate.length < 5) {
      value += '/';
    }
    
    setDisplayDate(value);
    
    // עדכון התאריך בפורמט ISO רק אם התאריך תקין
    if (isValidFutureDate(value)) {
      const isoDate = convertToISODate(value);
      setEventData(prev => ({
        ...prev,
        eventDate: isoDate
      }));
      setDateError(''); // ניקוי שגיאה אם התאריך תקין
    } else {
      // אם התאריך לא תקין, נשמור רק את התצוגה אבל לא נעדכן את ערך ה-ISO
      if (value === '') {
        setEventData(prev => ({
          ...prev,
          eventDate: ''
        }));
        setDateError(''); // אם השדה ריק, לא נציג שגיאה
      } else {
        setDateError('התאריך לא חוקי או שהוא עבר. יש להזין תאריך בפורמט DD/MM/YYYY');
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

  // פתיחה/סגירה של בורר השעות
  const toggleTimePicker = () => {
    setShowTimePicker(prev => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // בדיקת תקינות התאריך והשעה לפני שליחת הטופס
    let hasError = false;
    
    // בדיקת תאריך
    if (!eventData.eventDate || !isValidFutureDate(displayDate)) {
      setDateError('התאריך לא חוקי או שהוא עבר. יש להזין תאריך בפורמט DD/MM/YYYY');
      hasError = true;
    }
    
    // פורמוט השעה לפורמט תקין אם צריך
    let timeToSubmit = eventData.eventTime;
    
    // אם המשתמש הזין רק מספרים ללא פורמט (לדוגמא: 1630)
    if (/^\d{1,4}$/.test(eventData.eventTime) && !eventData.eventTime.includes(':')) {
      if (eventData.eventTime.length <= 2) {
        // רק שעה (לדוגמא: 16)
        timeToSubmit = `${eventData.eventTime.padStart(2, '0')}:00`;
      } else {
        // שעה ודקות (לדוגמא: 1630)
        const hours = eventData.eventTime.slice(0, 2).padStart(2, '0');
        const minutes = eventData.eventTime.slice(2).padStart(2, '0');
        timeToSubmit = `${hours}:${minutes}`;
      }
    }
    
    // בדיקת תקינות השעה המפורמטת
    if (!timeToSubmit || !isValidTime(timeToSubmit)) {
      setTimeError('יש להזין שעה תקינה בפורמט 24 שעות (לדוגמה: 14:30)');
      hasError = true;
    }
    
    // אם יש שגיאה, עוצרים את השליחה
    if (hasError) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('לא מחובר. נא להתחבר מחדש.');
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
      setError(err.response?.data?.message || 'אירעה שגיאה ביצירת האירוע');
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
        <h1>יצירת אירוע חדש</h1>
        <p>מלא את הפרטים הבאים ליצירת האירוע שלך</p>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="event-form-container">
        <form onSubmit={handleSubmit} className="event-form">
          <div className="form-group">
            <label htmlFor="eventName">שם האירוע</label>
            <input 
              type="text"
              id="eventName"
              name="eventName"
              value={eventData.eventName}
              onChange={handleInputChange}
              required
              className="form-input"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="eventDate">תאריך האירוע</label>
            
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
            <label htmlFor="eventTime">שעת האירוע</label>
            
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
              
              {/* בורר שעות בפורמט 24 שעות */}
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
                            // בחירת שעה ודקות ברירת מחדל (00)
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
                            // בחירת דקות עם השעה הנוכחית
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
              ביטול
            </button>
            <button 
              type="submit" 
              className="submit-button"
              disabled={loading}
            >
              {loading ? 'יוצר אירוע...' : 'יצירת אירוע'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventPage;