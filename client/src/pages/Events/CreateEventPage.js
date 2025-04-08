import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/CreateEventPage.css';

const CreateEventPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState({
    eventName: '',
    eventDate: ''
  });
  const [displayDate, setDisplayDate] = useState('');
  const datePickerRef = useRef(null);

  // חישוב התאריך הנוכחי בפורמט ISO
  const today = new Date().toISOString().split('T')[0];

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

  const handleDateChange = (e) => {
    const isoDate = e.target.value;
    if (isoDate) {
      setEventData(prev => ({
        ...prev,
        eventDate: isoDate
      }));
      
      setDisplayDate(convertToDisplayDate(isoDate));
    }
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
    } else {
      // אם התאריך לא תקין, נשמור רק את התצוגה אבל לא נעדכן את ערך ה-ISO
      if (value === '') {
        setEventData(prev => ({
          ...prev,
          eventDate: ''
        }));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // בדיקה אם התאריך תקין ובעתיד לפני שליחת הטופס
    if (!eventData.eventDate || !isValidFutureDate(displayDate)) {
      alert("התאריך לא חוקי או שהוא עבר. יש להזין תאריך בפורמט DD/MM/YYYY");
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
                  className="date-display-input"
                />
                <div className="calendar-icon" onClick={toggleDatePicker}>
                  <span role="img" aria-label="calendar">📅</span>
                </div>
              </div>
            </div>
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