import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../../styles/EventDetailsPage.css';

const EventDetailsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEventDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('לא מחובר. נא להתחבר מחדש.');
          navigate('/login');
          return;
        }

        const response = await axios.get(`/api/events/${id}`, {
          headers: {
            'x-auth-token': token
          }
        });

        setEvent(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError('אירעה שגיאה בטעינת פרטי האירוע');
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate]);

  const handleFeatureClick = (feature) => {
    switch (feature) {
      case 'venue':
        navigate(`/event/${id}/venue`);
        break;
      case 'vendors':
        navigate(`/event/${id}/vendors`);
        break;
      case 'guests':
        navigate(`/event/${id}/guests`);
        break;
      case 'seating':
        navigate(`/event/${id}/seating`);
        break;
      case 'timeline':
        navigate(`/event/${id}/timeline`);
        break;
      case 'templates':
        navigate(`/event/${id}/templates`);
        break;
      case 'weather':
        navigate(`/event/${id}/weather`);
        break;
      case 'budget':
        navigate(`/event/${id}/budget`);
        break;
      case 'share':
        navigate(`/event/${id}/share`);
        break;
      default:
        break;
    }
  };

  const handleBack = () => {
    navigate('/dashboard');
  };

  if (loading) {
    return (
      <div className="event-details-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-details-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={handleBack}>חזרה לדשבורד</button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-details-container">
        <div className="error-message">האירוע לא נמצא</div>
        <button className="back-button" onClick={handleBack}>חזרה לדשבורד</button>
      </div>
    );
  }

  // Format the date
  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  // Calculate days remaining
  const today = new Date();
  const daysRemaining = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

  return (
    <div className="event-details-container">
      <div className="event-details-header">
        <button className="back-button" onClick={handleBack}>
          חזרה לאירועים שלי
        </button>
        <div className="event-title-section">
          <h1>{event.title}</h1>
          <div className="event-meta">
            <p className="event-date">{formattedDate}</p>
            <p className="days-remaining">{daysRemaining > 0 ? `נותרו ${daysRemaining} ימים` : 'האירוע התקיים'}</p>
          </div>
        </div>
      </div>

      <div className="event-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${calculateProgress(event)}%` }}></div>
        </div>
        <p className="progress-text">{calculateProgress(event)}% הושלם</p>
      </div>

      <div className="event-features">
        <div className="feature-card" onClick={() => handleFeatureClick('venue')}>
          <div className="feature-icon venue-icon">🏢</div>
          <h3>בחירת מקום</h3>
          <p>בחר את המקום המושלם לאירוע שלך</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('vendors')}>
          <div className="feature-icon vendors-icon">👨‍🍳</div>
          <h3>בחירת ספקים</h3>
          <p>צלם, תקליטן, קייטרינג ועוד</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('guests')}>
          <div className="feature-icon guests-icon">👥</div>
          <h3>רשימת מוזמנים</h3>
          <p>{event.guestCount > 0 ? `${event.guestCount} מוזמנים` : 'הוסף מוזמנים'}</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('seating')}>
          <div className="feature-icon seating-icon">🪑</div>
          <h3>סידורי הושבה</h3>
          <p>ארגון שולחנות ומקומות ישיבה</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('timeline')}>
          <div className="feature-icon timeline-icon">📅</div>
          <h3>ניהול לו"ז ומשימות</h3>
          <p>תכנון זמנים ומשימות לביצוע</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('templates')}>
          <div className="feature-icon templates-icon">📝</div>
          <h3>טמפלייטים</h3>
          <p>הזמנות, ברכות ועוד</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('weather')}>
          <div className="feature-icon weather-icon">☀️</div>
          <h3>תחזית מזג אוויר</h3>
          <p>צפייה בתחזית ליום האירוע</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('budget')}>
          <div className="feature-icon budget-icon">💰</div>
          <h3>ניהול תקציב</h3>
          <p>מעקב אחר הוצאות והכנסות</p>
        </div>

        <div className="feature-card" onClick={() => handleFeatureClick('share')}>
          <div className="feature-icon share-icon">🔗</div>
          <h3>שיתוף אירוע</h3>
          <p>שתף פרטים עם אורחים ומשתתפים</p>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate progress percentage based on completed features
const calculateProgress = (event) => {
  let completedSteps = 0;
  let totalSteps = 9; // Total number of features

  // Check if venue is selected
  if (event.venue && event.venue.name) {
    completedSteps += 1;
  }

  // Check if guests are added
  if (event.guestCount > 0) {
    completedSteps += 1;
  }

  // You can add more checks for other features as they are implemented
  
  return Math.round((completedSteps / totalSteps) * 100);
};

export default EventDetailsPage;