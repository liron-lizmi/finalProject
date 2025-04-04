import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { account } from '../../appwrite';
import axios from 'axios';
import '../../styles/AuthPages.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // בדיקה אם יש מידע משתמש בלוקל סטורג'
    const checkUserSession = async () => {
      const isGoogleAuth = localStorage.getItem('googleAuth') === 'true';
      
      try {
        // נסה לקבל מידע מהלוקל סטורג'
        const localUser = localStorage.getItem('user');
        
        if (localUser && !isGoogleAuth) {
          const parsedUser = JSON.parse(localUser);
          setUser(parsedUser);
          setLoading(false);
          return; 
        }
        
        // אם זה לא מהלוקל סטורג' או שזה התחברות גוגל, בדוק מול Appwrite
        try {
          const userData = await account.get();
          
          // אם זה התחברות עם גוגל, בדוק אם המשתמש קיים במערכת
          if (isGoogleAuth) {
            localStorage.removeItem('googleAuth'); // נקה את הדגל
            
            try {
              // בדוק אם המשתמש קיים במערכת
              const response = await axios.post('/api/auth/check-user-exists', { 
                email: userData.email 
              });
              
              if (!response.data.exists) {
                // המשתמש לא רשום - נרשום אותו אוטומטית
                console.log('Creating new user from Google login');
                
                const names = userData.name ? userData.name.split(' ') : ['', ''];
                const firstName = names[0] || '';
                const lastName = names.slice(1).join(' ') || '';
                
                // יצירת משתמש חדש עם נתוני גוגל
                const registerResponse = await axios.post('/api/auth/register-oauth', {
                  email: userData.email,
                  firstName: firstName,
                  lastName: lastName,
                  provider: 'google',
                  providerId: userData.$id
                });
                
                if (registerResponse.data.token) {
                  localStorage.setItem('token', registerResponse.data.token);
                  localStorage.setItem('user', JSON.stringify(registerResponse.data.user));
                  
                  setUser(registerResponse.data.user);
                  setLoading(false);
                  return;
                }
              }
            } catch (error) {
              console.error('Error creating/checking user:', error);
            }
          }
          
          // המשתמש קיים או שהצלחנו ליצור אותו - נבדוק אם יש לנו את הנתונים שלו מהשרת
          try {
            // נסה להתחבר עם המייל שקיבלנו מגוגל
            const loginResponse = await axios.post('/api/auth/login-oauth', {
              email: userData.email,
              provider: 'google',
              providerId: userData.$id
            });
            
            if (loginResponse.data.token) {
              localStorage.setItem('token', loginResponse.data.token);
              localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
              
              setUser(loginResponse.data.user);
              setLoading(false);
              return;
            }
          } catch (loginError) {
            console.error('OAuth login error:', loginError);
          }
          
          // אם הגענו לכאן, נשתמש במידע מ-Appwrite
          const userInfo = {
            id: userData.$id,
            email: userData.email,
            name: userData.name || userData.email
          };
          
          localStorage.setItem('user', JSON.stringify(userInfo));
          setUser(userInfo);
          setLoading(false);
        } catch (error) {
          console.error('Session check error:', error);
          // אם יש שגיאה, המשתמש לא מחובר - החזר לדף ההתחברות
          navigate('/login');
          return;
        }
      } catch (error) {
        console.error('Dashboard error:', error);
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkUserSession();
    
    // טען את האירועים מהלוקל סטורג' עם מניעת כפילויות
    const loadEvents = () => {
      const eventsData = localStorage.getItem('events');
      if (eventsData) {
        try {
          const parsedEvents = JSON.parse(eventsData);
          
          // מניעת כפילויות על ידי שימוש ב-Map עם מזהי אירועים כמפתחות
          const uniqueEvents = Array.from(
            new Map(parsedEvents.map(event => [event.id, event])).values()
          );
          
          setEvents(uniqueEvents);
          
          // שמירת המערך ללא כפילויות חזרה ל-localStorage
          if (uniqueEvents.length !== parsedEvents.length) {
            localStorage.setItem('events', JSON.stringify(uniqueEvents));
            console.log(`תוקן: הוסרו ${parsedEvents.length - uniqueEvents.length} אירועים כפולים`);
          }
        } catch (error) {
          console.error('שגיאה בניתוח נתוני האירועים:', error);
        }
      }
    };
    
    loadEvents();
    
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
    // ניווט ישיר לדף יצירת אירוע
    navigate('/create-event');
  };
  
  // פונקציה לטיפול בלחיצה על כפתור פרטי אירוע
  const handleEventDetails = (eventId) => {
    // בעתיד, זה ינווט לפרטי האירוע
    console.log('Viewing details for event:', eventId);
    // navigate(`/event/${eventId}`);
    
    // כרגע, נציג התראה פשוטה
    alert(`פרטי האירוע עם מזהה: ${eventId} יוצגו בקרוב`);
  };
  
  // פונקציה למחיקת אירוע
  const handleDeleteEvent = (eventId, eventTitle) => {
    // אישור לפני מחיקה
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${eventTitle}"?`)) {
      try {
        // קבל את הרשימה הנוכחית מהלוקל סטורג'
        const eventsData = localStorage.getItem('events');
        if (eventsData) {
          const parsedEvents = JSON.parse(eventsData);
          
          // סנן את האירוע שרוצים למחוק
          const updatedEvents = parsedEvents.filter(event => event.id !== eventId);
          
          // שמור את הרשימה המעודכנת
          localStorage.setItem('events', JSON.stringify(updatedEvents));
          
          // עדכן את המצב
          setEvents(updatedEvents);
          
          console.log(`אירוע נמחק בהצלחה: ${eventTitle}`);
        }
      } catch (error) {
        console.error('שגיאה במחיקת האירוע:', error);
      }
    }
  };

  // אם עדיין טוען, נציג מסך טעינה
  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <h2>טוען...</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>ברוך הבא, {user?.name || user?.firstName || user?.email}</h1>
        <div className="header-actions">
          <button className="logout-button" onClick={handleLogout}>התנתק</button>
        </div>
      </div>
      
      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2 className="events-title">האירועים שלי</h2>
          <div className="events-container">
            {events.length > 0 ? (
              events.map(event => (
                <div 
                  key={event.id} 
                  className="event-card"
                >
                  <h3>{event.title}</h3>
                  <p className="event-date">{new Date(event.date).toLocaleDateString('he-IL')}</p>
                  
                  <div className="event-actions">
                    <button 
                      className="event-details-button"
                      onClick={() => handleEventDetails(event.id)}
                    >
                      פרטי האירוע
                    </button>
                    <button 
                      className="event-delete-button"
                      onClick={() => handleDeleteEvent(event.id, event.title)}
                    >
                      מחק
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p>עדיין אין לך אירועים. צור את האירוע הראשון שלך!</p>
            )}
          </div>
        </div>
        
        <div className="dashboard-section">
          <h2 className="create-title">צור אירוע חדש</h2>
          <p>צור אירוע חדש כדי לארגן ולנהל את כל פרטי האירוע שלך במקום אחד - בחירת מקום, הזמנות, אישורי הגעה, סידורי ישיבה ועוד.</p>
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