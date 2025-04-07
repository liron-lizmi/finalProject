import React, { useState } from 'react';
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

  const today = new Date().toISOString().split('T')[0];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
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
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="eventDate">תאריך האירוע</label>
            <input
              type="date"
              id="eventDate"
              name="eventDate"
              value={eventData.eventDate}
              onChange={handleInputChange}
              min={today}
              required
            />
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