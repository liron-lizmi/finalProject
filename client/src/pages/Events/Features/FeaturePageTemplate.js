// pages/Events/Features/FeaturePageTemplate.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import '../../../styles/FeaturePage.css';

const FeaturePageTemplate = ({
  title,
  icon,
  description,
  children
}) => {

  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';

    document.documentElement.lang = isRTL ? 'he' : 'en';

    const fetchEventDetails = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) {
              setError(t('errors.notLoggedIn'));
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
        setError(t('errors.eventLoadFailed'));
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate, t, i18n.language, isRTL]);

  const handleBack = () => {
    navigate(`/event/${id}`);
  };

  if (loading) {
    return (
      <div>
        <div className={`main-header ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="header-content">
            <button className="back-button" onClick={handleBack}>
              {t('general.backToEventDetails')}
            </button>
            <div className="header-logo">
              <img src="/images.png" alt="Logo" className="logo-image" />
            </div>
          </div>
        </div>
        
        <div className={`feature-page-container ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

 
  if (error) {
    return (
      <div>
        <div className={`main-header ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="header-content">
            <button className="back-button" onClick={handleBack}>
              {t('general.back')}
            </button>
            <div className="header-logo">
              <img src="/images/logo.png" alt="Logo" className="logo-image" />
            </div>
          </div>
        </div>
        
        <div className={`feature-page-container ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="error-message">{error}</div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div>
        <div className={`main-header ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="header-content">
            <button className="back-button" onClick={handleBack}>
              {t('general.back')}
            </button>
            <div className="header-logo">
              <img src="/images/logo.png" alt="Logo" className="logo-image" />
            </div>
          </div>
        </div>
        
        <div className={`feature-page-container ${isRTL ? 'rtl' : 'ltr'}`}>
          <div className="error-message">{t('errors.eventNotFound')}</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className={`main-header ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="header-content">
          <button className="back-button" onClick={handleBack}>
            {t('general.backToEventDetails')}
          </button>
          <div className="header-logo">
            <img src="/images/logo.png" alt="Logo" className="logo-image" />
          </div>
        </div>
      </div>
      
      <div className={`feature-page-container ${isRTL ? 'rtl' : 'ltr'}`}>
        <div className="feature-page-header">
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
            {isRTL 
              ? new Date(event.date).toLocaleDateString('he-IL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })
              : new Date(event.date).toLocaleDateString('en-US', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                }).toUpperCase()
            }
            </p>
          </div>
         
          <div className="feature-main-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturePageTemplate;