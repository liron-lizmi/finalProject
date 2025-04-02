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
              // אם נכשל ברישום, נמשיך לבדוק אם נוכל להתחבר
              // נגיע לקוד למטה, ששם ננסה לקבל נתונים למשתמש
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
    
    // Check if there's any event data in localStorage
    // This is temporary until we implement backend storage
    const checkForEvents = () => {
      const eventData = localStorage.getItem('eventData');
      if (eventData) {
        try {
          const parsedEvent = JSON.parse(eventData);
          // Add a unique ID and format date/time for display
          const formattedEvent = {
            id: 'event-' + Date.now(),
            title: parsedEvent.eventName,
            date: new Date(parsedEvent.eventDate).toLocaleDateString('he-IL'),
            location: parsedEvent.venue.name,
            address: parsedEvent.venue.address,
            guestCount: parsedEvent.guestCount,
            type: parsedEvent.eventType,
            // Keep the full data for later use
            fullData: parsedEvent
          };
          setEvents([formattedEvent]);
        } catch (error) {
          console.error('Error parsing event data:', error);
        }
      }
    };
    
    checkForEvents();
    
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
    // תחילה נפנה למסך בחירת מקום האירוע
    navigate('/venues');
  };
  
  // Function to handle clicking on an event
  const handleEventClick = (eventId) => {
    // In the future, this would navigate to event details
    console.log('Clicked on event:', eventId);
    // navigate(`/event/${eventId}`);
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
        <h1>ברוך הבא, {user?.name}</h1>
        <button className="logout-button" onClick={handleLogout}>התנתק</button>
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
                  onClick={() => handleEventClick(event.id)}
                >
                  <h3>{event.title}</h3>
                  <p className="event-date">{event.date}</p>
                  <p className="event-location">{event.location}</p>
                  <div className="event-details">
                    <span className="event-guests">{event.guestCount} אורחים</span>
                    <span className="event-type">{
                      event.type === 'wedding' ? 'חתונה' :
                      event.type === 'bar_mitzvah' ? 'בר/בת מצווה' :
                      event.type === 'birthday' ? 'יום הולדת' :
                      event.type === 'corporate' ? 'אירוע חברה' :
                      event.type === 'conference' ? 'כנס' : 'אירוע'
                    }</span>
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