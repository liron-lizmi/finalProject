// pages/Events/Features/EventTimelinePage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventTimelinePage = () => {
  return (
    <FeaturePageTemplate
      title="ניהול לו״ז ומשימות"
      icon="📅"
      description="תכנן את לוח הזמנים של האירוע שלך ונהל את המשימות שיש לבצע"
    >
      <div className="timeline-content">
        <h3>תכנון לו״ז ומשימות</h3>
        <p>כאן תוכל לנהל את לוח הזמנים והמשימות של האירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventTimelinePage;