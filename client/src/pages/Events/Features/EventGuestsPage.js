import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from './FeaturePageTemplate';
import ImportModal from '../../components/ImportModal';
import RSVPManualModal from './components/RSVPManualModal';
import GiftsModal from './components/GiftsModal';
import '../../../styles/EventGuestsPage.css';

const EventGuestsPage = () => {
  const { t } = useTranslation();
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  const [guests, setGuests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showRSVPModal, setShowRSVPModal] = useState(false);
  const [editingRSVPGuest, setEditingRSVPGuest] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState('all');
  const [selectedRSVPStatus, setSelectedRSVPStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingGuest, setEditingGuest] = useState(null);
  const [selectedGuests, setSelectedGuests] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [duplicates, setDuplicates] = useState({ phone: [] });
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [rsvpLink, setRsvpLink] = useState('');
  const [showGiftsModal, setShowGiftsModal] = useState(false);
  const [editingGiftsGuest, setEditingGiftsGuest] = useState(null);
  const [eventDate, setEventDate] = useState(null);

  const [guestForm, setGuestForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    group: 'other',
    customGroup: ''
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


  const handleGroupChange = (e) => {
    const selectedGroup = e.target.value;
    setGuestForm({
      ...guestForm, 
      group: selectedGroup,
      customGroup: selectedGroup === 'other' ? guestForm.customGroup : ''
    });
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
    if (guestForm.group === 'other' && !guestForm.customGroup.trim()) {
      setError(t('validation.customGroupRequired'));
      return false;
    }
    return true;
  };

  const generateRSVPLink = async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests/rsvp-link`);
      if (response && response.ok) {
        const data = await response.json();
        setRsvpLink(data.rsvpLink);
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const copyRSVPLink = async () => {
    try {
      await navigator.clipboard.writeText(rsvpLink);
      alert(t('guests.rsvp.linkCopied'));
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const detectDuplicates = useCallback(() => {
    const phoneDuplicates = [];
    
    const phoneMap = new Map();

    guests.forEach(guest => {
      if (guest.phone && guest.phone.trim()) {
        const phone = guest.phone.trim();
        if (phoneMap.has(phone)) {
          const existingGuests = phoneMap.get(phone);
          if (existingGuests.length === 1) {
            phoneDuplicates.push({
              type: 'phone',
              value: phone,
              guests: [...existingGuests, guest]
            });
          } else {
            const duplicateGroup = phoneDuplicates.find(d => d.value === phone);
            if (duplicateGroup) {
              duplicateGroup.guests.push(guest);
            }
          }
          phoneMap.set(phone, [...existingGuests, guest]);
        } else {
          phoneMap.set(phone, [guest]);
        }
      }
    });

    setDuplicates({ phone: phoneDuplicates });
  }, [guests]);

  const handleDeleteDuplicate = async (guestId, duplicateType, duplicateValue) => {
    if (!window.confirm(t('guests.confirmDeleteDuplicate'))) return;

    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests/${guestId}`, {
        method: 'DELETE'
      });

      if (!response) return;

      if (response.ok) {
        setGuests(prevGuests => prevGuests.filter(guest => guest._id !== guestId));
        setError('');
        
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.deleteGuest'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const getGroupDisplayName = (guest) => {
    if (guest.customGroup) {
      return guest.customGroup;
    }
    
    if (['family', 'friends', 'work', 'other'].includes(guest.group)) {
      return t(`guests.groups.${guest.group}`);
    }
    
    return guest.group;
  };

  const getUniqueGroups = () => {
    const groups = new Set();
    guests.forEach(guest => {
      if (guest.customGroup) {
        groups.add(guest.customGroup);
      } else if (['family', 'friends', 'work'].includes(guest.group)) {
        groups.add(guest.group);
      } else {
        groups.add(guest.group);
      }
    });
    return Array.from(groups);
  };

  const handleGuestSelection = (guestId, isSelected) => {
    setSelectedGuests(prev => {
      const newSet = new Set(prev);
      if (isSelected) {
        newSet.add(guestId);
      } else {
        newSet.delete(guestId);
      }
      return newSet;
    });
  };

  const handleSelectAllGuests = (selectAll) => {
    if (selectAll) {
      setSelectedGuests(new Set(filteredGuests.map(guest => guest._id)));
    } else {
      setSelectedGuests(new Set());
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    setSelectedGuests(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedGuests.size === 0) return;

    const confirmMessage = t('guests.confirmBulkDelete', { count: selectedGuests.size });
    if (!window.confirm(confirmMessage)) return;

    try {
      setLoading(true);
      const guestIds = Array.from(selectedGuests);
      const deletePromises = guestIds.map(guestId =>
        makeApiRequest(`/api/events/${eventId}/guests/${guestId}`, {
          method: 'DELETE'
        })
      );

      const results = await Promise.allSettled(deletePromises);
      
      let successCount = 0;
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value && result.value.ok) {
          successCount++;
        } else {
          failedCount++;
          console.error(`Failed to delete guest ${guestIds[index]}:`, result.reason);
        }
      });

      if (successCount > 0) {
        setGuests(prevGuests => 
          prevGuests.filter(guest => !selectedGuests.has(guest._id))
        );
      }

      if (successCount === selectedGuests.size) {
        setError('');
      } else if (successCount > 0) {
        setError(t('guests.partialBulkDeleteSuccess', { 
          success: successCount, 
          failed: failedCount 
        }));
      } else {
        setError(t('guests.bulkDeleteFailed'));
      }

      setSelectedGuests(new Set());
      setIsSelectionMode(false);

    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
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

const fetchEventDate = useCallback(async () => {
  try {
    const response = await makeApiRequest(`/api/events/${eventId}`);
    if (response && response.ok) {
      const event = await response.json();
      setEventDate(new Date(event.date)); // שנה מ-eventDate ל-date
    }
  } catch (err) {
    console.error('Error fetching event date:', err);
  }
}, [eventId, makeApiRequest]);

const hasEventPassed = () => {
  if (!eventDate) return false;
  return new Date() > eventDate;
};

const handleGiftUpdate = async (guestId, giftData) => {
  try {
    const response = await makeApiRequest(`/api/events/${eventId}/guests/${guestId}/gift`, {
      method: 'PUT',
      body: JSON.stringify(giftData)
    });

    if (!response) return;

    if (response.ok) {
      const updatedGuest = await response.json();
      setGuests(prevGuests => 
        prevGuests.map(guest => 
          guest._id === guestId ? updatedGuest : guest
        )
      );
      setError('');
      setShowGiftsModal(false);
      setEditingGiftsGuest(null);
    } else {
      const errorData = await response.json().catch(() => ({}));
      setError(errorData.message || t('errors.updateGuest'));
    }
  } catch (err) {
    setError(t('errors.networkError'));
  }
};

const handleEditGifts = useCallback((guest) => {
  if (!hasEventPassed()) {
    return;
  }
  setEditingGiftsGuest(guest);
  setShowGiftsModal(true);
}, [hasEventPassed]);

const handlePhoneChange = (e) => {
  const formattedPhone = formatPhoneNumber(e.target.value);
  setGuestForm({...guestForm, phone: formattedPhone});
};


  const handleManualRSVPUpdate = async (guestData) => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests/${guestData.guestId}/rsvp`, {
        method: 'PUT',
        body: JSON.stringify({
          rsvpStatus: guestData.rsvpStatus,
          guestNotes: guestData.guestNotes,
          attendingCount: guestData.attendingCount
        })
      });

      if (!response) return;

      if (response.ok) {
        const updatedGuest = await response.json();
        setGuests(prevGuests => 
          prevGuests.map(guest => 
            guest._id === guestData.guestId ? { 
              ...guest, 
              rsvpStatus: guestData.rsvpStatus,
              guestNotes: guestData.guestNotes,
              attendingCount: guestData.attendingCount,
              rsvpReceivedAt: Date.now()
            } : guest
          )
        );
        setError('');
        setShowRSVPModal(false);
        setEditingRSVPGuest(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('errors.updateGuest'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  // תיקון הפונקציה שמטפלת בעריכת RSVP
  const handleEditRSVP = useCallback((guest) => {
    console.log('Opening RSVP modal for guest:', guest.firstName, guest.lastName);
    setEditingRSVPGuest(guest);
    setShowRSVPModal(true);
  }, []);

  const handleAddGuest = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let finalGroup = guestForm.group;
      let finalCustomGroup = undefined;

      if (guestForm.group === 'other' && guestForm.customGroup.trim()) {
        finalGroup = guestForm.customGroup.trim();
        finalCustomGroup = guestForm.customGroup.trim();
      }

      const guestData = {
        firstName: guestForm.firstName,
        lastName: guestForm.lastName,
        phone: guestForm.phone,
        group: finalGroup,
        customGroup: finalCustomGroup
      };

      const response = await makeApiRequest(`/api/events/${eventId}/guests`, {
        method: 'POST',
        body: JSON.stringify(guestData)
      });

      if (!response) return;

      if (response.ok) {
        const newGuest = await response.json();
        setGuests([...guests, newGuest]);
        setGuestForm({
          firstName: '',
          lastName: '',
          phone: '',
          group: 'other',
          customGroup: ''
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

  const handleEditGuest = (guest) => {
    setEditingGuest(guest._id);
    setGuestForm({
      firstName: guest.firstName,
      lastName: guest.lastName,
      phone: guest.phone,
      group: guest.customGroup ? 'other' : guest.group,
      customGroup: guest.customGroup || ''
    });
    setError('');
  };

  const handleUpdateGuest = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      let finalGroup = guestForm.group;
      let finalCustomGroup = undefined;

      if (guestForm.group === 'other' && guestForm.customGroup.trim()) {
        finalGroup = guestForm.customGroup.trim();
        finalCustomGroup = guestForm.customGroup.trim();
      }

      const guestData = {
        firstName: guestForm.firstName,
        lastName: guestForm.lastName,
        phone: guestForm.phone,
        group: finalGroup,
        customGroup: finalCustomGroup
      };

      const response = await makeApiRequest(`/api/events/${eventId}/guests/${editingGuest}`, {
        method: 'PUT',
        body: JSON.stringify(guestData)
      });

      if (!response) return;

      if (response.ok) {
        const updatedGuest = await response.json();
        setGuests(guests.map(guest => 
          guest._id === editingGuest ? updatedGuest : guest
        ));
        setEditingGuest(null);
        setGuestForm({
          firstName: '',
          lastName: '',
          phone: '',
          group: 'other',
          customGroup: ''
        });
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('import.errors.updateGuest'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  };

  const handleCancelEdit = () => {
    setEditingGuest(null);
    setGuestForm({
      firstName: '',
      lastName: '',
      phone: '',
      group: 'other',
      customGroup: ''
    });
    setError('');
  };

  const handleImportGuests = async (importedGuests) => {
    try {
      if (!importedGuests || importedGuests.length === 0) {
        setError(t('guest.errors.noData'));
        return;
      }

      setLoading(true);
      console.log(`Starting bulk import of ${importedGuests.length} guests...`);

      // הכנת הנתונים לייבוא
      const guestsToImport = importedGuests.map(guest => {
        const validatedGuest = {
          firstName: guest.firstName?.trim() || t('import.unknownContact'),
          lastName: guest.lastName?.trim() || '',
          phone: guest.phone?.trim() || '',
          group: guest.group || 'other',
          customGroup: undefined
        };

        if (!['family', 'friends', 'work', 'other'].includes(guest.group)) {
          validatedGuest.group = guest.group;
          validatedGuest.customGroup = guest.group;
        }

        // תיקון פורמט טלפון
        if (validatedGuest.phone && !/^05\d-\d{7}$/.test(validatedGuest.phone)) {
          const cleanPhone = validatedGuest.phone.replace(/\D/g, '');
          if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
            validatedGuest.phone = `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3)}`;
          }
        }

        return validatedGuest;
      });

      console.log('Sending bulk import request...');

      const response = await makeApiRequest(`/api/events/${eventId}/guests/bulk-import`, {
        method: 'POST',
        body: JSON.stringify({ guests: guestsToImport })
      });

      if (response && response.ok) {
        const result = await response.json();
        console.log(`Bulk import completed: ${result.imported} imported, ${result.duplicates} duplicates`);

        await fetchGuests();

        if (result.imported > 0) {
          setError('');
          console.log(`Successfully imported ${result.imported} guests`);
          
          if (result.duplicates > 0) {
            console.log(`${result.duplicates} duplicates found - will show in duplicates warning`);
          }
          
        } else if (result.duplicates > 0 && result.imported === 0) {
          setError('');
          console.log(`All guests were duplicates - duplicate warning will appear`);
          
        } else if (result.failed > 0) {
          setError(`${t('import.errors.importFailed')}: ${result.errors?.slice(0, 2).join(', ')}${result.errors?.length > 2 ? '...' : ''}`);
        } else {
          setError('');
        }
      } else {
        const errorData = await response?.json().catch(() => ({}));
        setError(errorData.message || t('import.errors.importFailed'));
      }

    } catch (err) {
      console.error('Bulk import error:', err);
      setError(t('import.errors.importFailed'));
    } finally {
      setLoading(false);
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
    const guestGroupName = guest.customGroup || guest.group;
    
    const matchesGroup = selectedGroup === 'all' || 
      guestGroupName === selectedGroup;
    
    const matchesRSVP = selectedRSVPStatus === 'all' || 
      guest.rsvpStatus === selectedRSVPStatus;
    
    const matchesSearch = searchTerm === '' || 
      guest.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      guest.phone.includes(searchTerm);
    
    return matchesGroup && matchesRSVP && matchesSearch;
  });

  const stats = {
    total: guests.length,
    confirmed: guests.filter(g => g.rsvpStatus === 'confirmed').length,
    declined: guests.filter(g => g.rsvpStatus === 'declined').length,
    pending: guests.filter(g => g.rsvpStatus === 'pending').length,
    totalAttending: guests.filter(g => g.rsvpStatus === 'confirmed')
                          .reduce((sum, guest) => sum + (guest.attendingCount || 1), 0)
  };

  useEffect(() => {
    detectDuplicates();
  }, [detectDuplicates]);

  useEffect(() => {
    fetchGuests();
  }, [fetchGuests]);

  useEffect(() => {
    if (eventId) {
      generateRSVPLink();
    }
  }, [eventId]);

  useEffect(() => {
  fetchEventDate();
}, [fetchEventDate]);

  const totalDuplicates = duplicates.phone.length;

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

        {/* RSVP Link Section */}
        <div className="guests-rsvp-link-section">
          <h3>📨 {t('guests.rsvp.shareLink')}</h3>
          <p>{t('guests.rsvp.shareLinkDescription')}</p>
          <div className="rsvp-link-container">
            <input
              type="text"
              className="rsvp-link-input"
              value={rsvpLink}
              readOnly
            />
            <button
              className="rsvp-copy-button"
              onClick={copyRSVPLink}
            >
              📋 {t('guests.rsvp.copyLink')}
            </button>
          </div>
        </div>

        {totalDuplicates > 0 && (
          <div className="guests-duplicates-warning">
            <div className="duplicates-warning-header">
              <span className="warning-icon">⚠️</span>
              <span className="warning-text">
                {t('guests.duplicatesFound', { count: totalDuplicates })}
              </span>
              <button
                className="duplicates-toggle-button"
                onClick={() => setShowDuplicates(!showDuplicates)}
              >
                {showDuplicates ? t('guests.hideDuplicates') : t('guests.showDuplicates')}
              </button>
            </div>
            
            {showDuplicates && (
              <div className="duplicates-list">
                {duplicates.phone.map((duplicate, index) => (
                  <div key={`phone-${index}`} className="duplicate-group">
                    <div className="duplicate-header">
                      <span className="duplicate-type">{t('guests.duplicatePhone')}</span>
                      <span className="duplicate-value">{duplicate.value}</span>
                    </div>
                    <div className="duplicate-guests">
                      {duplicate.guests.map(guest => (
                        <div key={guest._id} className="duplicate-guest">
                          <span className="duplicate-guest-name">
                            {guest.firstName} {guest.lastName}
                          </span>
                          <span className="duplicate-guest-group">
                            {getGroupDisplayName(guest)}
                          </span>
                          <button
                            className="duplicate-delete-button"
                            onClick={() => handleDeleteDuplicate(guest._id, 'phone', duplicate.value)}
                            title={t('guests.deleteDuplicate')}
                          >
                            🗑️
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
          <div className="guests-stat-card attending">
            <div className="guests-stat-number">{stats.totalAttending}</div>
            <div className="guests-stat-label">{t('guests.stats.totalAttending')}</div>
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

          <button
            className="guests-add-button"
            onClick={() => {
              setShowImportModal(true);
              setError('');
            }}
          >
            {t('import.importGuests')}
          </button>

          <button
            className={`guests-bulk-select-button ${isSelectionMode ? 'active' : ''}`}
            onClick={toggleSelectionMode}
          >
            {isSelectionMode ? t('guests.cancelSelection') : t('guests.selectMultiple')}
          </button>

          {isSelectionMode && selectedGuests.size > 0 && (
            <button
              className="guests-bulk-delete-button"
              onClick={handleBulkDelete}
            >
              {t('guests.deleteSelected')} ({selectedGuests.size})
            </button>
          )}

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
            {getUniqueGroups().filter(group => !['family', 'friends', 'work', 'other'].includes(group)).map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>

          <select
            className="guests-filter-select"
            value={selectedRSVPStatus}
            onChange={(e) => setSelectedRSVPStatus(e.target.value)}
          >
            <option value="all">{t('guests.rsvp.filters.all')}</option>
            <option value="confirmed">{t('guests.rsvp.confirmed')}</option>
            <option value="declined">{t('guests.rsvp.declined')}</option>
            <option value="pending">{t('guests.rsvp.pending')}</option>
          </select>
        </div>

        {isSelectionMode && (
          <div className="guests-selection-controls">
            <button
              className="guests-select-all-button"
              onClick={() => handleSelectAllGuests(true)}
            >
              {t('guests.selectAll')}
            </button>
            <button
              className="guests-deselect-all-button"
              onClick={() => handleSelectAllGuests(false)}
            >
              {t('guests.deselectAll')}
            </button>
            <span className="guests-selected-count">
              {t('guests.selectedCount', { count: selectedGuests.size })}
            </span>
          </div>
        )}

        {(showAddForm || editingGuest) && (
          <div className="guests-form">
            <h3>{editingGuest ? t('guests.editGuest') : t('guests.addNewGuest')}</h3>
            <form onSubmit={editingGuest ? handleUpdateGuest : handleAddGuest}>
              <div className="guests-form-grid">
                <input
                  type="text"
                  className={`guests-form-input ${error === t('validation.firstNameRequired') ? 'error' : ''}`}
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
                  required
                />
                <input
                  type="text"
                  className={`guests-form-input ${error === t('validation.lastNameRequired') ? 'error' : ''}`}
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
                  required
                />
                <input
                  type="tel"
                  className={`guests-form-input ${error === t('validation.invalidPhoneFormat') || error === t('validation.phoneRequired') ? 'error' : ''}`}
                  placeholder={t('guests.form.phone')}
                  value={guestForm.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => {
                    if (guestForm.phone && !/^05\d-\d{7}$/.test(guestForm.phone)) {
                      setError(t('validation.invalidPhoneFormat'));
                    } else if (error === t('validation.invalidPhoneFormat')) {
                      setError('');
                    }
                  }}
                  required
                />
                <select
                  className="guests-form-input"
                  value={guestForm.group}
                  onChange={handleGroupChange}
                  required
                >
                  <option value="family">{t('guests.groups.family')}</option>
                  <option value="friends">{t('guests.groups.friends')}</option>
                  <option value="work">{t('guests.groups.work')}</option>
                  <option value="other">{t('guests.groups.other')}</option>
                </select>
                
                {guestForm.group === 'other' && (
                  <input
                    type="text"
                    className={`guests-form-input ${error === t('validation.customGroupRequired') ? 'error' : ''}`}
                    placeholder={t('guests.form.customGroupPlaceholder')}
                    value={guestForm.customGroup}
                    onChange={(e) => setGuestForm({...guestForm, customGroup: e.target.value})}
                    required
                  />
                )}
              </div>

              <div className="guests-form-actions">
                <button
                  type="submit"
                  className="guests-form-submit"
                >
                  {editingGuest ? t('guests.updateGuest') : t('common.add')}
                </button>
                <button
                  type="button"
                  className="guests-form-cancel"
                  onClick={editingGuest ? handleCancelEdit : () => {
                    setShowAddForm(false);
                    setGuestForm({
                      firstName: '',
                      lastName: '',
                      phone: '',
                      group: 'other',
                      customGroup: ''
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
                <div key={guest._id} className={`guests-table-row ${selectedGuests.has(guest._id) ? 'selected' : ''}`}>
                  {isSelectionMode && (
                    <div className="guest-selection">
                      <input
                        type="checkbox"
                        checked={selectedGuests.has(guest._id)}
                        onChange={(e) => handleGuestSelection(guest._id, e.target.checked)}
                        className="guest-selection-checkbox"
                      />
                    </div>
                  )}
                  
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
                    {guest.rsvpStatus === 'confirmed' && guest.attendingCount > 1 && (
                      <div className="guest-attending-count">
                        {t('guests.rsvp.attendingCount')}: {guest.attendingCount}
                      </div>
                    )}
                  </div>
                  
                  <div className="guest-group">
                    {getGroupDisplayName(guest)}
                  </div>
                  
                  <div className={`guest-rsvp-status ${guest.rsvpStatus}`}>
                    {t(`guests.rsvp.${guest.rsvpStatus}`)}
                  </div>
                  
                  {!isSelectionMode && (
                    <div className="guest-actions">
                      <button
                        onClick={() => handleEditGuest(guest)}
                        className="guest-edit-button"
                        title={t('guests.editGuest')}
                        type="button"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          console.log('RSVP button clicked for guest:', guest.firstName, guest.lastName);
                          handleEditRSVP(guest);
                        }}
                        className="guest-rsvp-edit-button"
                        title={t('guests.rsvp.editRSVP')}
                        type="button"
                      >
                        📝
                      </button>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (hasEventPassed()) {
                            handleEditGifts(guest);
                          }
                        }}
                        className={`guest-gifts-button ${!hasEventPassed() ? 'disabled' : ''}`}
                        title={hasEventPassed() ? t('guests.gifts.editGifts') : t('guests.gifts.availableAfterEvent')}
                        type="button"
                        disabled={!hasEventPassed()}
                      >
                        🎁
                        {hasEventPassed() && (
                          <span className={`gift-status-indicator ${guest.gift?.hasGift ? 'has-gift' : 'no-gift'}`}>
                            {guest.gift?.hasGift ? '✓' : '✗'}
                          </span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteGuest(guest._id)}
                        className="guest-delete-button"
                        title={t('common.delete')}
                        type="button"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <ImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImport={handleImportGuests}
          eventId={eventId}
        />

        <RSVPManualModal
        
          isOpen={showRSVPModal}
          onClose={() => {
            console.log('Closing RSVP modal');
            setShowRSVPModal(false);
            setEditingRSVPGuest(null);
          }}
          guest={editingRSVPGuest}
          onUpdateRSVP={handleManualRSVPUpdate}
        />
        <GiftsModal
          isOpen={showGiftsModal}
          onClose={() => {
            setShowGiftsModal(false);
            setEditingGiftsGuest(null);
          }}
          guest={editingGiftsGuest}
          onUpdateGift={handleGiftUpdate}
        />
      </div>
    </FeaturePageTemplate>
  );
};

export default EventGuestsPage;