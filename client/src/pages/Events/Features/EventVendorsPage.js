// pages/Events/Features/EventVendorsPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventVendorsPage = () => {
  return (
    <FeaturePageTemplate
      title="בחירת ספקים"
      icon="👨‍🍳"
      description="בחר את הספקים המושלמים לאירוע שלך - צלמים, תקליטנים, קייטרינג ועוד"
    >
      <div className="vendors-content">
        <h3>בחירת ספקים</h3>
        <p>כאן תוכל לנהל את הספקים השונים לאירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventVendorsPage;