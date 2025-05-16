import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { account } from '../../appwrite';
import axios from 'axios';
import '../../styles/AuthPages.css';

const Dashboard = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isRTL = i18n.language === 'he'; 
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [eventToDelete, setEventToDelete] = useState(null);

  useEffect(() => {
    console.log("Dashboard mounted, search params:", location.search);
    
    const checkUserSession = async () => {
      try {
        const isGoogleAuth = new URLSearchParams(location.search).get('auth') === 'google';

        if (isGoogleAuth) {
          setLoading(false);
        }
        
        if (isGoogleAuth) {
          console.log("Google authentication redirect detected");
          
          try {
            const userData = await account.get();
            console.log("Appwrite user data:", userData);
            
            const checkResponse = await axios.post('/api/auth/check-user-exists', { 
              email: userData.email 
            });
            
            if (!checkResponse.data.exists) {
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
                navigate('/dashboard', { replace: true });
                return;
              }
            } else {
              const loginResponse = await axios.post('/api/auth/login-oauth', {
                email: userData.email,
                provider: 'google',
                providerId: userData.$id
              });
              
              if (loginResponse.data.token) {
                localStorage.setItem('token', loginResponse.data.token);
                localStorage.setItem('user', JSON.stringify(loginResponse.data.user));
                setUser(loginResponse.data.user);
                navigate('/dashboard', { replace: true });
                return;
              }
            }
          } catch (error) {
            console.error("Error during Google auth flow:", error);
            navigate('/login', { replace: true });
            return;
          }
        } else {
          const token = localStorage.getItem('token');
          const localUser = localStorage.getItem('user');
          
          if (token && localUser) {
            setUser(JSON.parse(localUser));
            setLoading(false);
          } else {
            try {
              const userData = await account.get();
              
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
              } else {
                navigate('/login', { replace: true });
              }
            } catch (err) {
              console.error("No authenticated session found:", err);
              navigate('/login', { replace: true });
            }
          }
        }
      } catch (error) {
        console.error('Dashboard session check error:', error);
        navigate('/login', { replace: true });
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
        setError(t('errors.loadEventsFailed', 'Error loading events'));
      }
    };
    
    if (!loading) {
      fetchEvents();
    }
  }, [navigate, location.search, t, i18n.language]);

  const handleLogout = async () => {
    try {
      try {
        await account.deleteSession('current');
      } catch (error) {
        console.error('Appwrite logout error:', error);
      }
      
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreateEvent = () => {
    navigate('/create-event');
  };

  const handleEventDetails = (eventId) => {
    navigate(`/event/${eventId}`);
  };

  const handleDeleteEventClick = (eventId, eventTitle) => {
    setEventToDelete({ id: eventId, title: eventTitle });
    setShowDeleteModal(true);
  };

  const confirmDeleteEvent = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn', 'Not logged in. Please login again.'));
        navigate('/login');
        return;
      }
      
      await axios.delete(`/api/events/${eventToDelete.id}`, {
        headers: {
          'x-auth-token': token
        }
      });
      
      setEvents(events.filter(event => event._id !== eventToDelete.id));
      setShowDeleteModal(false);
      setEventToDelete(null);
    } catch (err) {
      console.error('Error deleting event:', err);
      setError(t('errors.deleteEventFailed', 'Error deleting the event'));
      setShowDeleteModal(false);
      setEventToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setEventToDelete(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    if (i18n.language === 'en') {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } else {
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}/${month}/${year}`;
    }
  };

  const navigateToHome = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <div className="auth-container">
        <div className="auth-box" style={{ textAlign: 'center' }}>
          <h2>{t('general.loading')}</h2>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`dashboard-wrapper ${isRTL ? 'rtl' : 'ltr'}`} style={{ direction: isRTL ? 'rtl' : 'ltr' }}>
      <header className="dashboard-header">
        <div className="header-container">
          <div className={`header-${isRTL ? 'right' : 'left'}`}>
            <div className="logo" onClick={navigateToHome}>
              <img src="/images/logo.png" alt={t('general.appLogo')} />
            </div>
          </div>
          <div className="header-center">
            <div className="user-greeting">
              <span className="greeting-icon">
              👋
              </span>
              <span>{t('dashboard.welcome')}</span>
              <h2>{user?.name || user?.firstName || user?.email}</h2>
            </div>
          </div>
          <div className={`header-${isRTL ? 'left' : 'right'}`}>
            <button className="logout-btn" onClick={handleLogout}>
              <span className="logout-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                  <polyline points="16 17 21 12 16 7"></polyline>
                  <line x1="21" y1="12" x2="9" y2="12"></line>
                </svg>
              </span>
              {t('general.logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="container">
          {error && (
            <div className="error-alert">
              <div className="error-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="12" y1="8" x2="12" y2="12"></line>
                  <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
              </div>
              {error}
            </div>
          )}

          <div className="create-event-card">
            <div className="create-event-content">
              <div className="sparkle-icon">
                ✨
              </div>
              <div className="create-event-text">
                <h2>{t('dashboard.createEventTitle')}</h2>
                <p>{t('dashboard.createEventDescription')}</p>
              </div>
            </div>
            <button className="create-event-btn" onClick={handleCreateEvent}>
              {t('dashboard.createEventButton')}
            </button>
          </div>

          <div className="events-section">
            <div className="section-header">
              <h2>
                <span className="section-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                  </svg>
                </span>
                {t('dashboard.eventsTitle')}
              </h2>
            </div>
            <div className="events-grid">
              {events.length > 0 ? (
                events.map(event => (
                  <div key={event._id} className="event-card">
                    <div className="event-body">
                      <h3>{event.title}</h3>
                      <div className="event-meta">
                        <div className="event-date">
                          <span className="meta-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </span>
                          <span>{formatDate(event.date)}</span>
                        </div>
                        {event.time && (
                          <div className="event-time">
                            <span className="meta-icon">
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12 6 12 12 16 14"></polyline>
                              </svg>
                            </span>
                            <span>{event.time}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="event-footer">
                      <button className="event-details-btn" onClick={() => handleEventDetails(event._id)}>
                        {t('dashboard.viewDetails')}
                      </button>
                      <button className="event-delete-btn" onClick={() => handleDeleteEventClick(event._id, event.title)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="no-events">
                  <div className="no-events-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                      <line x1="16" y1="2" x2="16" y2="6"></line>
                      <line x1="8" y1="2" x2="8" y2="6"></line>
                      <line x1="3" y1="10" x2="21" y2="10"></line>
                      <circle cx="12" cy="15" r="2"></circle>
                    </svg>
                  </div>
                  <h3>{t('dashboard.noEvents')}</h3>
                  <p>{t('dashboard.noEventsDescription')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {showDeleteModal && (
        <div className="modal-overlay">
          <div className={`modal-content ${isRTL ? 'rtl' : 'ltr'}`}>
            <div className="modal-header">
              <h3>{t('dashboard.confirmDelete', 'אישור מחיקה')}</h3>
              <button className="modal-close" onClick={cancelDelete}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>{t('dashboard.deleteConfirm', 'האם אתה בטוח שברצונך למחוק את האירוע', { title: eventToDelete?.title })}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={cancelDelete}>
                {t('general.cancel', 'ביטול')}
              </button>
              <button className="modal-btn delete" onClick={confirmDeleteEvent}>
                {t('general.delete', 'מחיקה')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;