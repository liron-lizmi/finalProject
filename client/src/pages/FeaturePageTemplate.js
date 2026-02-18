/**
 * FeaturePageTemplate.js - Reusable Feature Page Layout
 *
 * Template component providing consistent layout for all event feature pages.
 * Includes header with navigation and event context.
 *
 * Usage: Wrap feature page content with this template
 *
 * Props:
 * - title: Page title text
 * - icon: Emoji or icon for the feature
 * - description: Optional feature description
 * - children: Page content to render
 *
 * Features:
 * - Consistent header with back button
 * - Logo with home navigation
 * - Auto-fetch event details
 * - RTL/LTR support based on language
 * - Responsive layout
 *
 * Layout:
 * - Main header (back button + logo)
 * - Feature header (icon + title)
 * - Children content area
 */
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import '../styles/FeaturePage.css';

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
          <div className="header-logo" onClick={() => navigate('/')}>
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