// pages/Events/Features/FeaturePageTemplate.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../../../styles/FeaturePage.css';

const FeaturePageTemplate = ({ 
  title, 
  icon, 
  description, 
  children 
}) => {
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

  const handleBack = () => {
    navigate(`/event/${id}`);
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
        <button className="back-button" onClick={handleBack}>חזרה לפרטי האירוע</button>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="feature-page-container">
        <div className="error-message">האירוע לא נמצא</div>
        <button className="back-button" onClick={handleBack}>חזרה לפרטי האירוע</button>
      </div>
    );
  }

  return (
    <div className="feature-page-container">
      <div className="feature-page-header">
        <button className="back-button" onClick={handleBack}>
          חזרה לפרטי האירוע
        </button>
        
        <div className="feature-title-section">
          <div className="feature-header-content">
            <div className="feature-icon">{icon}</div>
            <h1>{title}</h1>
          </div>
          <p className="feature-description">{description}</p>
        </div>
      </div>

      <div className="feature-page-content">
        <div className="event-info-panel">
          <h2>{event.title}</h2>
          <p className="event-date">
            {new Date(event.date).toLocaleDateString('he-IL', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </p>
        </div>
        
        <div className="feature-main-content">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FeaturePageTemplate;