import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from './FeaturePageTemplate';
import '../../../styles/EventGuestsPage.css';

const EventGuestsPage = () => {
  const { t } = useTranslation();
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    group: 'other'
  });

  const formatPhoneNumber = (value) => {
    const cleanedValue = value.replace(/\D/g, '');
    
    if (cleanedValue.startsWith('05') && cleanedValue.length <= 10) {
      if (cleanedValue.length <= 3) {
        return cleanedValue;
      } else {
        return `${cleanedValue.slice(0, 3)}-${cleanedValue.slice(3)}`;
      }
    }
    
    if (cleanedValue.length <= 10) {
      if (cleanedValue.length <= 3) {
        return cleanedValue;
      } else {
        return `${cleanedValue.slice(0, 3)}-${cleanedValue.slice(3)}`;
      }
    }
    
    return value.slice(0, -1); 
  };

  const handlePhoneChange = (e) => {
    const formattedPhone = formatPhoneNumber(e.target.value);
    setGuestForm({...guestForm, phone: formattedPhone});
  };

  const validateForm = () => {
    setError('');
    
    if (!guestForm.firstName.trim()) {
      setError(t('validation.firstNameRequired'));
      return false;
    }
    if (!guestForm.lastName.trim()) {
      setError(t('validation.lastNameRequired'));
      return false;
    }
    if (!guestForm.phone.trim()) {
      setError(t('validation.phoneRequired'));
      return false;
    }
    if (!/^05\d-\d{7}$/.test(guestForm.phone)) {
      setError(t('validation.invalidPhoneFormat'));
      return false;
    }
    return true;
  };

  const getAuthToken = useCallback(() => {
    let token = localStorage.getItem('token');
    if (token) return token;

    token = sessionStorage.getItem('token');
    if (token) return token;

    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      return token;
    }

    return null;
  }, []);

  const handleAuthError = useCallback(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setError(t('errors.authError'));
    setTimeout(() => {
      navigate('/login');
    }, 2000);
  }, [navigate, t]);

  const fetchGuests = useCallback(async () => {
    try {
      const token = getAuthToken();
      
      if (!token) {
        handleAuthError();
        return;
      }

      const response = await fetch(`/api/events/${eventId}/guests`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setGuests(data);
        setError('');
      } else if (response.status === 401) {
        handleAuthError();
        return;
      } else if (response.status === 404) {
        setError(t('errors.eventNotFound'));
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.fetchGuests'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  }, [eventId, getAuthToken, handleAuthError, t]);

  const makeApiRequest = useCallback(async (url, options = {}) => {
    const token = getAuthToken();
    
    if (!token) {
      handleAuthError();
      return null;
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, mergedOptions);
      
      if (response.status === 401) {
        handleAuthError();
        return null;
      }

      return response;
    } catch (err) {
      throw err;
    }
  }, [getAuthToken, handleAuthError]);

  const handleAddGuest = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests`, {
        method: 'POST',
        body: JSON.stringify(guestForm)
      });

      if (!response) return;

      if (response.ok) {
        const newGuest = await response.json();
        setGuests([...guests, newGuest]);
        setGuestForm({
          firstName: '',
          lastName: '',
          phone: '',
          group: 'other'
        });
        setShowAddForm(false);
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.addGuest'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const handleDeleteGuest = async (guestId) => {
    if (!window.confirm(t('guests.confirmDelete'))) return;

    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests/${guestId}`, {
        method: 'DELETE'
      });

      if (!response) return;

      if (response.ok) {
        setGuests(guests.filter(guest => guest._id !== guestId));
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.deleteGuest'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const filteredGuests = guests.filter(guest => {
    const matchesGroup = selectedGroup === 'all' || guest.group === selectedGroup;
    const matchesSearch = searchTerm === '' || 
      guest.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.phone.includes(searchTerm);
    
    return matchesGroup && matchesSearch;
  });

  const stats = {
    total: guests.length,
    confirmed: guests.filter(g => g.rsvpStatus === 'confirmed').length,
    declined: guests.filter(g => g.rsvpStatus === 'declined').length,
    pending: guests.filter(g => g.rsvpStatus === 'pending').length
  };

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  if (loading) {
    return (
      <FeaturePageTemplate
        title={t('guests.title')}
        icon="👥"
        description={t('guests.description')}
      >
        <div className="guests-empty-message">
          {t('common.loading')}
        </div>
      </FeaturePageTemplate>
    );
  }

  return (
    <FeaturePageTemplate
      title={t('guests.title')}
      icon="👥"
      description={t('guests.description')}
    >
      <div className="guests-container">
        {error && (
          <div className="guests-error-message">
            {error}
          </div>
        )}

        <div className="guests-stats">
          <div className="guests-stat-card total">
            <div className="guests-stat-number">{stats.total}</div>
            <div className="guests-stat-label">{t('guests.stats.total')}</div>
          </div>
          <div className="guests-stat-card confirmed">
            <div className="guests-stat-number">{stats.confirmed}</div>
            <div className="guests-stat-label">{t('guests.stats.confirmed')}</div>
          </div>
          <div className="guests-stat-card declined">
            <div className="guests-stat-number">{stats.declined}</div>
            <div className="guests-stat-label">{t('guests.stats.declined')}</div>
          </div>
          <div className="guests-stat-card pending">
            <div className="guests-stat-number">{stats.pending}</div>
            <div className="guests-stat-label">{t('guests.stats.pending')}</div>
          </div>
        </div>

        <div className="guests-controls">
          <button
            className="guests-add-button"
            onClick={() => {
              setShowAddForm(true);
              setError('');
            }}
          >
            {t('guests.addGuest')}
          </button>

          <input
            type="text"
            className="guests-search-input"
            placeholder={t('guests.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <select
            className="guests-filter-select"
            value={selectedGroup}
            onChange={(e) => setSelectedGroup(e.target.value)}
          >
            <option value="all">{t('guests.groups.all')}</option>
            <option value="family">{t('guests.groups.family')}</option>
            <option value="friends">{t('guests.groups.friends')}</option>
            <option value="work">{t('guests.groups.work')}</option>
            <option value="other">{t('guests.groups.other')}</option>
          </select>
        </div>

        {showAddForm && (
          <div className="guests-form">
            <h3>{t('guests.addNewGuest')}</h3>
            <form onSubmit={handleAddGuest}>
              <div className="guests-form-grid">
                <input
                  type="text"
                  className="guests-form-input"
                  placeholder={t('guests.form.firstName')}
                  value={guestForm.firstName}
                  onChange={(e) => setGuestForm({...guestForm, firstName: e.target.value})}
                  onBlur={() => {
                    if (!guestForm.firstName.trim()) {
                      setError(t('validation.firstNameRequired'));
                    } else if (error === t('validation.firstNameRequired')) {
                      setError('');
                    }
                  }}
                  style={{
                    borderColor: error === t('validation.firstNameRequired') ? '#dc3545' : '#ddd'
                  }}
                  required
                />
                <input
                  type="text"
                  className="guests-form-input"
                  placeholder={t('guests.form.lastName')}
                  value={guestForm.lastName}
                  onChange={(e) => setGuestForm({...guestForm, lastName: e.target.value})}
                  onBlur={() => {
                    if (!guestForm.lastName.trim()) {
                      setError(t('validation.lastNameRequired'));
                    } else if (error === t('validation.lastNameRequired')) {
                      setError('');
                    }
                  }}
                  style={{
                    borderColor: error === t('validation.lastNameRequired') ? '#dc3545' : '#ddd'
                  }}
                  required
                />
                <input
                  type="tel"
                  className="guests-form-input"
                  placeholder={t('guests.form.phone')}
                  value={guestForm.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => {
                    // בדיקת פורמט טלפון כאשר המשתמש יוצא מהשדה
                    if (guestForm.phone && !/^05\d-\d{7}$/.test(guestForm.phone)) {
                      setError(t('validation.invalidPhoneFormat'));
                    } else if (error === t('validation.invalidPhoneFormat')) {
                      setError(''); // נקה שגיאה אם הטלפון תוקן
                    }
                  }}
                  style={{
                    borderColor: error === t('validation.invalidPhoneFormat') || 
                                error === t('validation.phoneRequired') ? '#dc3545' : '#ddd'
                  }}
                  required
                />
                <select
                  className="guests-form-input"
                  value={guestForm.group}
                  onChange={(e) => setGuestForm({...guestForm, group: e.target.value})}
                  required
                >
                  <option value="family">{t('guests.groups.family')}</option>
                  <option value="friends">{t('guests.groups.friends')}</option>
                  <option value="work">{t('guests.groups.work')}</option>
                  <option value="other">{t('guests.groups.other')}</option>
                </select>
              </div>

              <div className="guests-form-actions">
                <button
                  type="submit"
                  className="guests-form-submit"
                >
                  {t('common.add')}
                </button>
                <button
                  type="button"
                  className="guests-form-cancel"
                  onClick={() => {
                    setShowAddForm(false);
                    setGuestForm({
                      firstName: '',
                      lastName: '',
                      phone: '',
                      group: 'other'
                    });
                    setError('');
                  }}
                >
                  {t('common.cancel')}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="guests-list">
          {filteredGuests.length === 0 ? (
            <div className="guests-empty-message">
              {guests.length === 0 ? t('guests.noGuests') : t('guests.noFilteredGuests')}
            </div>
          ) : (
            <div className="guests-table">
              {filteredGuests.map((guest) => (
                <div key={guest._id} className="guests-table-row">
                  <div className="guest-info">
                    <div className="guest-name">
                      {guest.firstName} {guest.lastName}
                    </div>
                    <div className="guest-phone">
                      {guest.phone}
                    </div>
                    {guest.guestNotes && (
                      <div className="guest-notes">
                        {t('guests.guestNote')}: {guest.guestNotes}
                      </div>
                    )}
                  </div>
                  
                  <div className="guest-group">
                    {t(`guests.groups.${guest.group}`)}
                  </div>
                  
                  <div className={`guest-rsvp-status ${guest.rsvpStatus}`}>
                    {t(`guests.rsvp.${guest.rsvpStatus}`)}
                  </div>
                  
                  <div className="guest-invitation-status">
                    {guest.invitationSent ? t('guests.invitationSent') : t('guests.invitationNotSent')}
                  </div>
                  
                  <div className="guest-actions">
                    <button
                      onClick={() => handleDeleteGuest(guest._id)}
                      className="guest-delete-button"
                      title={t('common.delete')}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </FeaturePageTemplate>
  );
};

export default EventGuestsPage;