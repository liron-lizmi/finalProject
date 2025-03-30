import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { account } from '../../appwrite';
import '../../styles/AuthPages.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);

  useEffect(() => {
    // בדיקה אם יש מידע משתמש בלוקל סטורג'
    const checkUserSession = async () => {
      const localUser = localStorage.getItem('user');
      
      if (localUser) {
        const parsedUser = JSON.parse(localUser);
        setUser(parsedUser);
        return; 
      }
      
      // אם אין מידע בלוקל סטורג', בדוק מול Appwrite
      try {
        const userData = await account.get();
        
        const userInfo = {
          id: userData.$id,
          email: userData.email,
          name: userData.name || `${userData.firstName || ''} ${userData.lastName || ''}`.trim()
        };
        
        localStorage.setItem('user', JSON.stringify(userInfo));
        setUser(userInfo);
      } catch (error) {
        console.error('Session check error:', error);
        // אם יש שגיאה, המשתמש לא מחובר - החזר לדף ההתחברות
        navigate('/login');
      }
    };

    checkUserSession();
    
    // בעתיד - כאן לטעון את האירועים מהשרת
  }, [navigate]);

  // פונקציה להתנתקות
  const handleLogout = async () => {
    try {
      try {
        // נסה להתנתק מול Appwrite, אבל אל תפסיק אם יש שגיאה
        await account.deleteSession('current');
      } catch (error) {
        console.error('Appwrite logout error:', error);
        // התעלם משגיאות התנתקות מול Appwrite
      }
      
      // בכל מקרה, נקה את הלוקל סטורג'
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  // פונקציה ליצירת אירוע חדש
  const handleCreateEvent = () => {
    navigate('/create-event');
  };

  // קוד מייל

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>ברוך הבא, {user?.name || 'אורטל ניסים'}</h1>
        <button className="logout-button" onClick={handleLogout}>התנתק</button>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2 className="events-title">האירועים שלי</h2>
          <div className="events-container">
            {/* קוד מייל: renderEvents() */}
            <p>עדיין אין לך אירועים. צור את האירוע הראשון שלך!</p>
          </div>
        </div>
        
        <div className="dashboard-section">
          <h2 className="create-title">צור אירוע חדש</h2>
          <p>צור אירוע חדש כדי לארגן ולנהל את כל פרטי האירוע שלך במקום אחד - הזמנות, אישורי הגעה, סידורי ישיבה ועוד.</p>
          <button 
            className="create-event-button"
            onClick={handleCreateEvent}
          >
            יצירת אירוע חדש
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;