// pages/Events/Features/EventBudgetPage.js
import React from 'react';
import FeaturePageTemplate from './FeaturePageTemplate';

const EventBudgetPage = () => {
  return (
    <FeaturePageTemplate
      title="ניהול תקציב"
      icon="💰"
      description="נהל את תקציב האירוע שלך: הוצאות, הכנסות ותשלומים"
    >
      <div className="budget-content">
        <h3>ניהול תקציב האירוע</h3>
        <p>כאן תוכל לנהל את התקציב של האירוע שלך.</p>
        <div className="coming-soon-message">
          <p>תכונה זו תהיה זמינה בקרוב!</p>
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventBudgetPage;