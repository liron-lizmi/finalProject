// pages/Events/Features/EventSharePage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventSharePage = () => {
  return (
    <FeaturePageTemplate
      title="שיתוף אירוע"
      icon="🔗"
      description="שתף את פרטי האירוע שלך עם אורחים או שותפים לארגון"
    >
      <div className="share-content">
        <h3>שיתוף פרטי האירוע</h3>
        <p>כאן תוכל לשתף את פרטי האירוע שלך עם אחרים.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventSharePage;