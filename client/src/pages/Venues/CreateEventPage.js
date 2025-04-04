import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../styles/CreateEventPage.css';

const CreateEventPage = () => {
  const navigate = useNavigate();
  const [eventData, setEventData] = useState({
    eventName: '',
    eventDate: ''
  });

  // Get today's date in YYYY-MM-DD format for the date input min attribute
  const today = new Date().toISOString().split('T')[0];

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Create a complete event object
    const newEvent = {
      id: 'event-' + Date.now(),
      title: eventData.eventName,
      date: eventData.eventDate,
      type: 'other', // Default type
      guestCount: 0, // Default guest count
      fullData: eventData
    };
    
    // Get existing events from localStorage or initialize empty array
    const existingEventsJSON = localStorage.getItem('events');
    const existingEvents = existingEventsJSON ? JSON.parse(existingEventsJSON) : [];
    
    // Add new event to the array
    const updatedEvents = [...existingEvents, newEvent];
    
    // Save updated events list to localStorage
    localStorage.setItem('events', JSON.stringify(updatedEvents));
    
    // Redirect back to dashboard
    navigate('/dashboard');
  };

  const handleCancel = () => {
    // Go back to dashboard on cancel
    navigate('/dashboard');
  };

  return (
    <div className="create-event-container">
      <div className="create-event-header">
        <h1>יצירת אירוע חדש</h1>
        <p>מלא את הפרטים הבאים ליצירת האירוע שלך</p>
      </div>
      
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
              placeholder="לדוגמה: החתונה של דני ודנה"
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
              min={today} // Set minimum date to today
              required
            />
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={handleCancel}>
              ביטול
            </button>
            <button type="submit" className="submit-button">
              יצירת אירוע
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateEventPage;