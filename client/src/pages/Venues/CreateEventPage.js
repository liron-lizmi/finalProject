import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import '../../styles/CreateEventPage.css';

const CreateEventPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [venue, setVenue] = useState(null);
  const [eventData, setEventData] = useState({
    eventName: '',
    eventType: 'wedding',
    eventDate: '',
    startTime: '',
    endTime: '',
    guestCount: '',
    notes: ''
  });

  useEffect(() => {
    // Check if venue was passed through location state
    if (location.state && location.state.venue) {
      setVenue(location.state.venue);
    } else {
      // Try to get from localStorage
      const savedVenue = localStorage.getItem('selectedVenue');
      if (savedVenue) {
        try {
          setVenue(JSON.parse(savedVenue));
        } catch (error) {
          console.error('Error parsing venue data:', error);
          navigate('/venues');
        }
      } else {
        // No venue selected, redirect back to venue page
        navigate('/venues');
      }
    }
  }, [location, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEventData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Here you would typically send the data to your backend
    // For now, just log it and save to localStorage
    const completeEventData = {
      ...eventData,
      venue: {
        id: venue.place_id,
        name: venue.name,
        address: venue.formatted_address || venue.vicinity,
        phone: venue.formatted_phone_number || '',
        website: venue.website || ''
      }
    };
    
    console.log('Event data to be saved:', completeEventData);
    
    // Save to localStorage for now
    localStorage.setItem('eventData', JSON.stringify(completeEventData));
    
    // Redirect to dashboard or next step
    navigate('/dashboard');
  };

  const handleGoBack = () => {
    navigate('/venues');
  };

  if (!venue) {
    return (
      <div className="create-event-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="create-event-container">
      <div className="create-event-header">
        <h1>יצירת אירוע חדש</h1>
        <p>מלא את הפרטים הבאים כדי ליצור את האירוע שלך</p>
      </div>
      
      <div className="selected-venue-summary">
        <h2>המקום שנבחר</h2>
        <div className="venue-summary-card">
          {venue.photos && venue.photos[0] && (
            <div className="venue-summary-image">
              <img 
                src={venue.photos[0].getUrl({ maxWidth: 300, maxHeight: 200 })} 
                alt={venue.name} 
              />
            </div>
          )}
          
          <div className="venue-summary-details">
            <h3>{venue.name}</h3>
            <p>{venue.formatted_address || venue.vicinity}</p>
            {venue.formatted_phone_number && <p>טלפון: {venue.formatted_phone_number}</p>}
          </div>
          
          <button className="change-venue-button" onClick={handleGoBack}>
            שנה מקום
          </button>
        </div>
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
            <label htmlFor="eventType">סוג האירוע</label>
            <select 
              id="eventType" 
              name="eventType" 
              value={eventData.eventType} 
              onChange={handleInputChange}
              required
            >
              <option value="wedding">חתונה</option>
              <option value="bar_mitzvah">בר/בת מצווה</option>
              <option value="birthday">יום הולדת</option>
              <option value="corporate">אירוע חברה</option>
              <option value="conference">כנס</option>
              <option value="other">אחר</option>
            </select>
          </div>
          
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="eventDate">תאריך האירוע</label>
              <input 
                type="date" 
                id="eventDate" 
                name="eventDate" 
                value={eventData.eventDate} 
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="startTime">שעת התחלה</label>
              <input 
                type="time" 
                id="startTime" 
                name="startTime" 
                value={eventData.startTime} 
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime">שעת סיום</label>
              <input 
                type="time" 
                id="endTime" 
                name="endTime" 
                value={eventData.endTime} 
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
          
          <div className="form-group">
            <label htmlFor="guestCount">מספר אורחים משוער</label>
            <input 
              type="number" 
              id="guestCount" 
              name="guestCount" 
              value={eventData.guestCount} 
              onChange={handleInputChange}
              placeholder="לדוגמה: 100"
              required
              min="1"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="notes">הערות נוספות</label>
            <textarea 
              id="notes" 
              name="notes" 
              value={eventData.notes} 
              onChange={handleInputChange}
              placeholder="הערות נוספות לגבי האירוע או המקום"
              rows="4"
            ></textarea>
          </div>
          
          <div className="form-actions">
            <button type="button" className="cancel-button" onClick={handleGoBack}>
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