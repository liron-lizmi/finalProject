// pages/Events/Features/EventTemplatesPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventTemplatesPage = () => {
  return (
    <FeaturePageTemplate
      title="טמפלייטים"
      icon="📝"
      description="צור הזמנות, ברכות ומסמכים נוספים עבור האירוע שלך"
    >
      <div className="templates-content">
        <h3>טמפלייטים לאירוע</h3>
        <p>כאן תוכל ליצור ולנהל טמפלייטים שונים עבור האירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventTemplatesPage;