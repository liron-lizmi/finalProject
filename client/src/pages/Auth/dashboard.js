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
  const [error, setError] = useState(null);

  useEffect(() => {
    const checkUserSession = async () => {
      const isGoogleAuth = localStorage.getItem('googleAuth') === 'true';
      
      try {
        const localUser = localStorage.getItem('user');
        
        if (localUser && !isGoogleAuth) {
          const parsedUser = JSON.parse(localUser);
          setUser(parsedUser);
          setLoading(false);
          return; 
        }
        
        try {
          const userData = await account.get();
          
          if (isGoogleAuth) {
            localStorage.removeItem('googleAuth'); 
            
            try {
              const response = await axios.post('/api/auth/check-user-exists', { 
                email: userData.email 
              });
              
              if (!response.data.exists) {
                console.log('Creating new user from Google login');
                
                const names = userData.name ? userData.name.split(' ') : ['', ''];
                const firstName = names[0] || '';
                const lastName = names.slice(1).join(' ') || '';
                
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
          
          try {
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
    
    const fetchEvents = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          console.error('No token found');
          navigate('/login');
          return;
        }
        
        const response = await axios.get('/api/events', {
          headers: {
            'x-auth-token': token
          }
        });
        
        setEvents(response.data);
      } catch (err) {
        console.error('Error fetching events:', err);
        setError('אירעה שגיאה בטעינת האירועים');
      }
    };
    
    fetchEvents();
    
  }, [navigate]);

  const handleLogout = async () => {
    try {
      try {
        await account.deleteSession('current');
      } catch (error) {
        console.error('Appwrite logout error:', error);
      }
      
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  const handleCreateEvent = () => {
    navigate('/create-event');
  };
  
  const handleEventDetails = (eventId) => {
    // בעתיד, זה ינווט לפרטי האירוע
    console.log('Viewing details for event:', eventId);
    // navigate(`/event/${eventId}`);
    
    alert(`פרטי האירוע עם מזהה: ${eventId} יוצגו בקרוב`);
  };
  
  const handleDeleteEvent = async (eventId, eventTitle) => {
    if (window.confirm(`האם אתה בטוח שברצונך למחוק את האירוע "${eventTitle}"?`)) {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('לא מחובר. נא להתחבר מחדש.');
          navigate('/login');
          return;
        }
        
        await axios.delete(`/api/events/${eventId}`, {
          headers: {
            'x-auth-token': token
          }
        });
        
        setEvents(events.filter(event => event._id !== eventId));
        
      } catch (err) {
        console.error('Error deleting event:', err);
        setError('אירעה שגיאה במחיקת האירוע');
      }
    }
  };

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
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <div className="dashboard-content">
        <div className="dashboard-section">
          <h2 className="events-title">האירועים שלי</h2>
          <div className="events-container">
            {events.length > 0 ? (
              events.map(event => (
                <div 
                  key={event._id} 
                  className="event-card"
                >
                  <h3>{event.title}</h3>
                  <p className="event-date">{new Date(event.date).toLocaleDateString('he-IL')}</p>
                  
                  <div className="event-actions">
                    <button 
                      className="event-details-button"
                      onClick={() => handleEventDetails(event._id)}
                    >
                      פרטי האירוע
                    </button>
                    <button 
                      className="event-delete-button"
                      onClick={() => handleDeleteEvent(event._id, event.title)}
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