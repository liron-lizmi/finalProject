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
  const [event, setEvent] = useState({
    title: '',
    date: new Date()
  });

  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = isRTL ? 'he' : 'en';

    // טוען פרטי אירוע ברקע ללא הצגת מצב טעינה
    const fetchEventDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          navigate('/login');
          return;
        }

        const response = await axios.get(`/api/events/${id}`, {
          headers: {
            'x-auth-token': token
          }
        });

        setEvent(response.data);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setEvent({
          title: t('events.eventNotFound'),
          date: new Date()
        });
      }
    };

    fetchEventDetails();
  }, [id, navigate, t, i18n.language, isRTL]);

  const handleBack = () => {
    navigate(`/event/${id}`);
  };

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
          </div>
        </div>

        <div className="feature-page-content">
         
          <div className="feature-main-content">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeaturePageTemplate;