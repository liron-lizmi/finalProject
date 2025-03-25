import React from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';
import { FaChair, FaHandshake, FaWallet, FaMapMarkerAlt, FaAddressBook, FaRegCalendarAlt } from 'react-icons/fa';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="homepage-container">
      {/* Header */}
      <header className="header">
        <img src="/logo.png" alt="PlanIt Logo" className="logo" />
        <nav>
          <button className="btn" onClick={() => navigate('/register')}>הירשם</button>
          <button className="btn" onClick={() => navigate('/login')}>התחבר</button>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="overlay"></div>
        <h1 className="text-gradient">PlanIt - תכנון וניהול אירועים</h1>
        <p className="subheader">הכלים המתקדמים ביותר לניהול האירוע המושלם שלך!</p>
        <button className="btn cta">התחל עכשיו</button>
      </section>

      {/* Features Section */}
      <section className="features">
        <div className="features-grid">
          <div className="feature-card">
            <FaMapMarkerAlt className="feature-icon" />
            <h3>בחירת מקום</h3>
            <p>מצא את המקום המושלם לאירוע שלך עם סינון חכם לפי קריטריונים שונים.</p>
          </div>
          <div className="feature-card">
            <FaHandshake className="feature-icon" />
            <h3>ניהול ספקים</h3>
            <p>נהל את כל הספקים שלך במקום אחד - מוזיקה, קייטרינג ועוד.</p>
          </div>
          <div className="feature-card">
            <FaAddressBook className="feature-icon" />
            <h3>רשימת מוזמנים</h3>
            <p>נהל רשימות מוזמנים בקלות, שלח הזמנות ונהל אישורי הגעה.</p>
          </div>
          <div className="feature-card">
            <FaChair className="feature-icon" />
            <h3>סידורי הושבה</h3>
            <p>אלגוריתם AI לסידור מושבים אופטימלי לאורחים שלך.</p>
          </div>
          <div className="feature-card">
            <FaRegCalendarAlt className="feature-icon" />
            <h3>ניהול לו"ז</h3>
            <p>תכנן את האירוע שלך עם לו"ז חכם לכל שלב באירוע.</p>
          </div>
          <div className="feature-card">
            <FaWallet className="feature-icon" />
            <h3>ניהול תקציב</h3>
            <p>עקוב אחר התקציב שלך והוצאות האירוע בזמן אמת.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <img src="/logo.png" alt="PlanIt Logo" className="footer-logo" />
        <p>כל הזכויות שמורות © 2025 PlanIt</p>
      </footer>
    </div>
  );
};

export default HomePage;