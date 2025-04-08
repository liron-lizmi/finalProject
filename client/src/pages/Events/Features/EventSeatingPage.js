// pages/Events/Features/EventSeatingPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventSeatingPage = () => {
  return (
    <FeaturePageTemplate
      title="סידורי הושבה"
      icon="🪑"
      description="תכנן את סידורי הישיבה באירוע שלך בצורה פשוטה ונוחה"
    >
      <div className="seating-content">
        <h3>תכנון סידורי הושבה</h3>
        <p>כאן תוכל לתכנן את סידורי הישיבה באירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventSeatingPage;