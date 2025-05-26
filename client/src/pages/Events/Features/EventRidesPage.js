// pages/Events/Features/EventRidesPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventRidesPage = () => {
  return (
    <FeaturePageTemplate
      title="טרמפים"
      icon="🚎"
      description="צור הזמנות, ברכות ומסמכים נוספים עבור האירוע שלך"
    >
      <div className="rides-content">
        <h3>טרמפים לאירוע</h3>
        <p>תיאום טרמפים בין משתתפי האירוע</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventRidesPage;