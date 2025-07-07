import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import '../../styles/EventDetailsPage.css';
import { useTranslation } from 'react-i18next';

const EventDetailsPage = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';
  
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
    
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
      case 'rides':
        navigate(`/event/${id}/rides`);
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
      <div className="event-page-wrapper">
        <div className="event-details-container">
          <div className="event-loader">
            <div className="loading-spinner"></div>
            <p>{t('general.loading')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="event-page-wrapper">
        <div className="event-details-container">
          <div className="error-container">
            <div className="error-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="error-message">{error}</div>
            <button className="back-button" onClick={handleBack}>
              <span className="back-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </span>
              {t('dashboard.backToDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="event-page-wrapper">
        <div className="event-details-container">
          <div className="error-container">
            <div className="error-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            </div>
            <div className="error-message">{t('events.eventNotFound')}</div>
            <button className="back-button" onClick={handleBack}>
              <span className="back-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12"></line>
                  <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
              </span>
              {t('dashboard.backToDashboard')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const eventDate = new Date(event.date);
  const formattedDate = eventDate.toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  const eventTime = event.time || '18:00';
  
  const today = new Date();
  const daysRemaining = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

  const progress = calculateProgress(event);

  return (
    <div className="event-page-wrapper">
      <div className="page-header">
        <div className="header-top">
        <div className="app-logo">
          <img src="/images/logo.png" alt={t('general.appLogo')} />
        </div>
        <button className="back-button" onClick={handleBack}>
          <span className="back-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </span>
          {t('events.backToMyEvents')}
        </button>
      </div>
    </div>
    <div className="event-details-container">
      <header className="event-header">
        <div className="event-info-container">
          <h1 className="event-title">{event.title}</h1>
          
          <div className="event-meta">
            <div className="event-datetime">
              <span className="date-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="16" y1="2" x2="16" y2="6"></line>
                  <line x1="8" y1="2" x2="8" y2="6"></line>
                  <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
              </span>
              <span>{formattedDate} {t('events.atTime')} {eventTime}</span>
            </div>
            <div className={`days-counter ${daysRemaining <= 30 ? 'urgent' : ''}`}>
              <span className="counter-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
              </span>
              <span>
                {daysRemaining > 0 
                  ? t('events.daysRemaining', { days: daysRemaining }) 
                  : daysRemaining === 0 
                    ? t('events.eventToday') 
                    : t('events.eventPassed')}
              </span>
            </div>
          </div>
          
          <div className="progress-container">
            <div className="progress-info">
              <h3>{t('events.planningProgress')}</h3>
              <span className="progress-percentage">{progress}%</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill" 
                style={{ width: `${progress}%` }}
                data-progress={`${progress}%`}>
              </div>
            </div>
          </div>
        </div>
      </header>

        <section className="event-features-section">
          <div className="features-grid">
            <div className="feature-card" onClick={() => handleFeatureClick('venue')}>
              <div className="feature-emoji">🏢</div>
              <div className="feature-content">
                <h3>{t('events.features.venues.title')}</h3>
                <p>{t('events.features.venues.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('vendors')}>
              <div className="feature-emoji">👨‍🍳</div>
              <div className="feature-content">
                <h3>{t('events.features.vendors.title')}</h3>
                <p>{t('events.features.vendors.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('guests')}>
              <div className="feature-emoji">👥</div>
              <div className="feature-content">
                <h3>{t('events.features.guests.title')}</h3>
                <p>
                  {event.guestCount > 0 
                    ? t('events.features.guests.count', { count: event.guestCount }) 
                    : t('events.features.guests.add')}
                </p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('seating')}>
              <div className="feature-emoji">🪑</div>
              <div className="feature-content">
                <h3>{t('events.features.seating.title')}</h3>
                <p>{t('events.features.seating.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('timeline')}>
              <div className="feature-emoji">📅</div>
              <div className="feature-content">
                <h3>{t('events.features.tasks.title')}</h3>
                <p>{t('events.features.tasks.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('rides')}>
              <div className="feature-emoji">🚎</div>
              <div className="feature-content">
                <h3>{t('events.features.rides.title')}</h3>
                <p>{t('events.features.rides.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('weather')}>
              <div className="feature-emoji">☀️</div>
              <div className="feature-content">
                <h3>{t('events.features.weather.title')}</h3>
                <p>{t('events.features.weather.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('budget')}>
              <div className="feature-emoji">💰</div>
              <div className="feature-content">
                <h3>{t('events.features.budget.title')}</h3>
                <p>{t('events.features.budget.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>

            <div className="feature-card" onClick={() => handleFeatureClick('share')}>
              <div className="feature-emoji">🔗</div>
              <div className="feature-content">
                <h3>{t('events.features.share.title')}</h3>
                <p>{t('events.features.share.description')}</p>
              </div>
              <div className="feature-action">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const calculateProgress = (event) => {
  let completedSteps = 0;
  let totalSteps = 9; 

  if (event.venue && event.venue.name) {
    completedSteps += 1;
  }

  if (event.guestCount > 0) {
    completedSteps += 1;
  }
  
  return Math.round((completedSteps / totalSteps) * 100);
};

export default EventDetailsPage;