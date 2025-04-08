// pages/Events/Features/EventWeatherPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventWeatherPage = () => {
  return (
    <FeaturePageTemplate
      title="תחזית מזג אוויר"
      icon="☀️"
      description="צפה בתחזית מזג האוויר ליום האירוע שלך"
    >
      <div className="weather-content">
        <h3>תחזית מזג אוויר</h3>
        <p>כאן תוכל לראות את תחזית מזג האוויר ליום האירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventWeatherPage;