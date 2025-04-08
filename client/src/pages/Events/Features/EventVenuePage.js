// pages/Events/Features/EventVenuePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import FeaturePageTemplate from './FeaturePageTemplate';
import VenuePage from '../VenuePage';

const EventVenuePage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVenuePage, setShowVenuePage] = useState(false);
  const [venueUpdateSuccess, setVenueUpdateSuccess] = useState(false);

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

  const handleVenueSelect = async (venue) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('לא מחובר. נא להתחבר מחדש.');
        navigate('/login');
        return;
      }

      const venueData = {
        name: venue.name,
        address: venue.address || venue.formatted_address || venue.vicinity,
        phone: venue.phone || venue.formatted_phone_number || '',
        website: venue.website || ''
      };

      await axios.put(`/api/events/${id}`, 
        { venue: venueData },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-auth-token': token
          }
        }
      );

      // After saving the venue, fetch updated event data
      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });

      setEvent(response.data);
      setVenueUpdateSuccess(true); // הגדרת הצלחת העדכון
      setShowVenuePage(false);

      // אחרי 3 שניות, מסתירים את הודעת ההצלחה
      setTimeout(() => {
        setVenueUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating venue:', err);
      setError('אירעה שגיאה בשמירת המקום');
    }
  };

  if (loading) {
    return (
      <div className="feature-page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feature-page-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate(`/event/${id}`)}>
          חזרה לפרטי האירוע
        </button>
      </div>
    );
  }

  if (showVenuePage) {
    // העברת פונקציית הקולבק ומזהה האירוע לדף בחירת המקום
    return <VenuePage onSelectVenue={handleVenueSelect} />;
  }

  return (
    <FeaturePageTemplate
      title="בחירת מקום לאירוע"
      icon="🏢"
      description="בחר את המקום המושלם לאירוע שלך"
    >
      {venueUpdateSuccess && (
        <div className="success-message">
          המקום נוסף בהצלחה לאירוע שלך
        </div>
      )}
      
      {event.venue && event.venue.name ? (
        <div className="selected-venue">
          <h3>המקום שנבחר</h3>
          <div className="venue-details-card">
            <h4>{event.venue.name}</h4>
            {event.venue.address && <p><strong>כתובת:</strong> {event.venue.address}</p>}
            {event.venue.phone && <p><strong>טלפון:</strong> {event.venue.phone}</p>}
            {event.venue.website && (
              <p>
                <strong>אתר:</strong>{' '}
                <a href={event.venue.website} target="_blank" rel="noopener noreferrer">
                  {event.venue.website}
                </a>
              </p>
            )}
          </div>
          <button className="change-venue-button" onClick={() => setShowVenuePage(true)}>
            שנה מקום
          </button>
        </div>
      ) : (
        <div className="no-venue-selected">
          <p>לא נבחר מקום לאירוע שלך עדיין.</p>
          <button className="select-venue-button" onClick={() => setShowVenuePage(true)}>
            חפש וסנן מקומות לאירוע
          </button>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventVenuePage;