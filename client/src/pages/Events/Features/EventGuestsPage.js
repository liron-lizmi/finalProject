// pages/Events/Features/EventGuestsPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventGuestsPage = () => {
  return (
    <FeaturePageTemplate
      title="רשימת מוזמנים"
      icon="👥"
      description="נהל את רשימת המוזמנים שלך, שלח הזמנות וקבל אישורי הגעה"
    >
      <div className="guests-content">
        <h3>ניהול רשימת מוזמנים</h3>
        <p>כאן תוכל לנהל את רשימת המוזמנים לאירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventGuestsPage;