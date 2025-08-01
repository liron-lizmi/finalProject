// pages/Events/Features/EventVendorsPage.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import FeaturePageTemplate from './FeaturePageTemplate';
import VendorsPage from '../VendorsPage';

const EventVendorsPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showVendorsPage, setShowVendorsPage] = useState(false);
  const [vendorUpdateSuccess, setVendorUpdateSuccess] = useState(false);
  const [vendorDeleteSuccess, setVendorDeleteSuccess] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualVendor, setManualVendor] = useState({
    name: '',
    category: '',
    phone: '',
    notes: ''
  });
  const [phoneError, setPhoneError] = useState('');
  const [showVendorSelectionModal, setShowVendorSelectionModal] = useState(false);
  const [vendorActionType, setVendorActionType] = useState(null);
  const [vendorToChangeIndex, setVendorToChangeIndex] = useState(null);
 
  const isRTL = i18n.language === 'he' || i18n.language === 'he-IL';

  const validatePhone = (phoneNumber) => {
    const phoneRegex = /^[0-9+\-\s()*]*$/;
    return phoneRegex.test(phoneNumber);
  };

  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.body.dir = isRTL ? 'rtl' : 'ltr';
   
    const fetchEventDetails = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError(t('errors.notLoggedIn'));
          navigate('/login');
          return;
        }

        const response = await axios.get(`/api/events/${id}`, {
          headers: {
            'x-auth-token': token
          }
        });

        setEvent(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching event details:', err);
        setError(t('errors.eventLoadFailed'));
        setLoading(false);
      }
    };

    fetchEventDetails();
  }, [id, navigate, t, i18n.language, isRTL]);

  const handleVendorSelect = async (vendor) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }
 
      setVendorDeleteSuccess(false);
 
      const vendorData = {
        name: vendor.name,
        category: vendor.category || 'other',
        phone: vendor.phone || vendor.formatted_phone_number || '',
        notes: vendor.notes || ''
      };
 
      const eventVendors = event.vendors || [];
      let updatedEvent = { ...event };
     
      if (vendorActionType === 'change' && vendorToChangeIndex !== null) {
        updatedEvent.vendors = [...eventVendors];
        updatedEvent.vendors[vendorToChangeIndex] = vendorData;
      } else {
        updatedEvent.vendors = [...eventVendors, vendorData];
      }
     
      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
 
      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });
 
      setEvent(response.data);
      setVendorUpdateSuccess(true);
      setShowVendorsPage(false);
      setVendorToChangeIndex(null);
      setVendorActionType(null);
 
      setTimeout(() => {
        setVendorUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating vendor:', err);
      setError(t('errors.generalError'));
    }
  };

  const handleManualVendorChange = (e) => {
    const { name, value } = e.target;
   
    if (name === 'phone') {
      if (!validatePhone(value)) {
        setPhoneError(t('errors.invalidPhoneFormat'));
      } else {
        setPhoneError('');
      }
    }
   
    setManualVendor(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleManualVendorSubmit = async (e) => {
    e.preventDefault();
     
    if (!manualVendor.phone || manualVendor.phone.trim() === '') {
      setPhoneError(t('errors.invalidPhoneFormat'));
      return;
    }
   
    if (!validatePhone(manualVendor.phone)) {
      setPhoneError(t('errors.invalidPhoneFormat'));
      return;
    }
   
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }
 
      setVendorDeleteSuccess(false);
 
      const eventVendors = event.vendors || [];
     
      const vendorToSubmit = {
        name: manualVendor.name,
        category: manualVendor.category || 'other',
        phone: manualVendor.phone.trim(),
        notes: manualVendor.notes || ''
      };
         
      let updatedEvent = { ...event };
     
      if (vendorActionType === 'change' && vendorToChangeIndex !== null) {
        updatedEvent.vendors = [...eventVendors];
        updatedEvent.vendors[vendorToChangeIndex] = vendorToSubmit;
      } else {
        updatedEvent.vendors = [...eventVendors, vendorToSubmit];
      }
     
      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
 
      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });
 
      setEvent(response.data);
      setVendorUpdateSuccess(true);
      setShowManualForm(false);
      setVendorToChangeIndex(null);
      setVendorActionType(null);
      setManualVendor({
        name: '',
        category: '',
        phone: '',
        notes: ''
      });
      setPhoneError('');
 
      setTimeout(() => {
        setVendorUpdateSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error updating vendor:', err);
      setError(t('errors.generalError'));
    }
  };

  const handleDeleteVendor = async (index) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError(t('errors.notLoggedIn'));
        navigate('/login');
        return;
      }
 
      setVendorUpdateSuccess(false);
 
      let updatedEvent = { ...event };
      const updatedVendors = [...(event.vendors || [])];
      updatedVendors.splice(index, 1);
      updatedEvent.vendors = updatedVendors;
 
      await axios.put(`/api/events/${id}`, updatedEvent, {
        headers: {
          'Content-Type': 'application/json',
          'x-auth-token': token
        }
      });
 
      const response = await axios.get(`/api/events/${id}`, {
        headers: {
          'x-auth-token': token
        }
      });
 
      setEvent(response.data);
      setVendorDeleteSuccess(true);
 
      setTimeout(() => {
        setVendorDeleteSuccess(false);
      }, 3000);
    } catch (err) {
      console.error('Error deleting vendor:', err);
      setError(t('errors.generalError'));
    }
  };

  const handleShowVendorOptions = (actionType, vendorIndex = null) => {
    setVendorActionType(actionType);
    setVendorToChangeIndex(vendorIndex);
    setShowVendorSelectionModal(true);
  };

  const handleSelectAPIVendors = () => {
    setShowVendorSelectionModal(false);
    setShowVendorsPage(true);
  };

  const handleSelectManualVendor = () => {
    setShowVendorSelectionModal(false);
    setShowManualForm(true);
  };

  const handleDirectAPIVendors = () => {
    setVendorActionType('add');
    setShowVendorsPage(true);
  };

  const handleDirectManualVendor = () => {
    setVendorActionType('add');
    setShowManualForm(true);
  };

  const getCategoryIcon = (category) => {
    switch(category?.toLowerCase()) {
      case 'catering':
        return '🍽️';
      case 'photography':
        return '📸';
      case 'flowers':
        return '💐';
      case 'music':
        return '🎵';
      case 'dj':
        return '🎧';
      case 'decoration':
        return '🎨';
      case 'lighting':
        return '💡';
      case 'makeup':
        return '💄';
      case 'transportation':
        return '🚗';
      case 'other':
        return '👨';
      default:
        return '👨';
    }
  };

  // const getCategoryName = (category) => {
  //   console.log("getCategoryName called with:", category);
   
  //   if (!category || category === 'other' || category === '') {
  //     const translation = t('events.features.vendors.categories.other');
  //     console.log("Translation for 'other':", translation);
     
  //     if (translation === 'events.features.vendors.categories.other') {
  //       return t('events.features.vendors.categories.other');
  //     }
  //     return translation;
  //   }
   
  //   const translationKey = `events.features.vendors.categories.${category?.toLowerCase()}`;
  //   const translation = t(translationKey);
  //   console.log(`Translation for ${translationKey}:`, translation);
   
  //   if (translation === translationKey) {
  //     const fallbackTranslation = t('events.features.vendors.categories.other');
  //     if (fallbackTranslation === 'events.features.vendors.categories.other') {
  //       return t('events.features.vendors.categories.other');
  //     }
  //     return fallbackTranslation;
  //   }
   
  //   return translation;
  // };

  const getCategoryName = (category) => {
  const categoryToUse = category || 'other' || '';
  return t(`events.features.vendors.categories.${categoryToUse}`);
};

  if (loading) {
    return (
      <div className="feature-page-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="feature-page-container">
        <div className="error-message">{error}</div>
        <button className="back-button" onClick={() => navigate(`/event/${id}`)}>
          {t('general.back')}
        </button>
      </div>
    );
  }

  if (showVendorsPage) {
    return <VendorsPage onSelectVendor={handleVendorSelect} />;
  }

  return (
    <FeaturePageTemplate
      title={t('events.features.vendors.title')}
      icon="👨‍🍳"
      description={t('events.features.vendors.description')}
    >
      {vendorUpdateSuccess && (
        <div className="success-message">
          {t('events.features.vendors.vendorAddedSuccess')}
        </div>
      )}
     
      {vendorDeleteSuccess && (
        <div className="success-message">
          {t('events.features.vendors.vendorDeletedSuccess')}
        </div>
      )}
     
      {showVendorSelectionModal && (
        <div className="vendor-selection-modal">
          <div className="vendor-selection-modal-content">
            <h3>
              {vendorActionType === 'change'
                ? t('events.features.vendors.changeVendorOptions')
                : t('events.features.vendors.addVendorOptions')}
            </h3>
            <div className="vendor-selection-options">
              <button
                className="select-vendor-button"
                onClick={handleSelectAPIVendors}
              >
                {t('events.features.vendors.searchAndFilterButton')}
              </button>
              <button
                className="add-manual-vendor-button"
                onClick={handleSelectManualVendor}
              >
                {t('events.features.vendors.addManuallyButton')}
              </button>
            </div>
            <button
              className="cancel-button"
              onClick={() => {
                setShowVendorSelectionModal(false);
                setVendorActionType(null);
                setVendorToChangeIndex(null);
              }}
            >
              {t('general.cancel')}
            </button>
          </div>
        </div>
      )}
     
      {showManualForm ? (
        <div className={`manual-vendor-form ${isRTL ? 'rtl' : 'ltr'}`}>
          <form onSubmit={handleManualVendorSubmit}>
            <div className="form-group">
              <label htmlFor="name">
                {t('events.features.vendors.vendorDetails.name')}*
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={manualVendor.name}
                onChange={handleManualVendorChange}
                required
                placeholder=""
              />
            </div>
            <div className="form-group">
              <label htmlFor="category">
                {t('events.features.vendors.vendorDetails.category')}*
              </label>
              <select
                id="category"
                name="category"
                value={manualVendor.category}
                onChange={handleManualVendorChange}
                required
              >
                <option value="">{t('general.select')}</option>
                <option value="catering">{t('events.features.vendors.categories.catering')}</option>
                <option value="photography">{t('events.features.vendors.categories.photography')}</option>
                <option value="flowers">{t('events.features.vendors.categories.flowers')}</option>
                <option value="music">{t('events.features.vendors.categories.music')}</option>
                <option value="dj">{t('events.features.vendors.categories.dj')}</option>
                <option value="decoration">{t('events.features.vendors.categories.decoration')}</option>
                <option value="makeup">{t('events.features.vendors.categories.makeup')}</option>
                <option value="transportation">{t('events.features.vendors.categories.transportation')}</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="phone">
                {t('events.features.vendors.vendorDetails.phone')}*
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={manualVendor.phone}
                onChange={handleManualVendorChange}
                required
                placeholder=""
              />
              {phoneError && <p className="error-text">{phoneError}</p>}
            </div>
            <div className="form-group">
              <label htmlFor="notes">
                {t('events.features.vendors.vendorDetails.notes')}
              </label>
              <textarea
                id="notes"
                name="notes"
                value={manualVendor.notes}
                onChange={handleManualVendorChange}
                placeholder=""
                className="notes-field"
              />
          </div>
            <div className="form-actions">
              <button type="submit" className="save-vendor-button">
                {t('general.save')}
              </button>
              <button
                type="button"
                className="cancel-button"
                onClick={() => {
                  setShowManualForm(false);
                  setPhoneError('');
                  setVendorActionType(null);
                  setManualVendor({
                    name: '',
                    category: '',
                    phone: '',
                    notes: ''
                  });
                }}
              >
                {t('general.cancel')}
              </button>
            </div>
          </form>
        </div>
      ) : event.vendors && event.vendors.length > 0 ? (
        <div className="selected-vendors">
          <h3>{t('events.features.vendors.selectedVendors')}</h3>
          {event.vendors.map((vendor, index) => (
            <div key={index} className="vendor-details-card">
              <div className="vendor-card-header">
                <div className="vendor-icon-name">
                  <span className="vendor-icon">{getCategoryIcon(vendor.category)}</span>
                  <h4>{vendor.name}</h4>
                </div>
                <span className="vendor-category">{getCategoryName(vendor.category)}</span>
              </div>
             
              {vendor.phone && (
                <p><strong>{t('events.features.vendors.vendorDetails.phone')}:</strong> {vendor.phone}</p>
              )}
             
              {vendor.notes && (
                <p><strong>{t('events.features.vendors.vendorDetails.notes')}:</strong> {vendor.notes}</p>
              )}
             
              <div className="vendor-actions">
                <button
                  className="change-vendor-button"
                  onClick={() => handleShowVendorOptions('change', index)}
                >
                  {t('events.features.vendors.changeVendor')}
                </button>
                <button className="delete-vendor-button" onClick={() => handleDeleteVendor(index)}>
                  {t('events.features.vendors.deleteVendor')}
                </button>
              </div>
            </div>
          ))}
         
          <div className="add-more-vendors">
            <button
              className="add-vendor-button"
              onClick={() => handleShowVendorOptions('add')}
            >
              {t('events.features.vendors.addAnotherVendor')}
            </button>
          </div>
        </div>
      ) : (
        <div className="no-vendor-selected">
          <p>{t('events.features.vendors.noVendorSelected')}</p>
          <div className="vendor-selection-options">
            <button className="select-vendor-button" onClick={handleDirectAPIVendors}>
              {t('events.features.vendors.searchAndFilterButton')}
            </button>
            <button className="add-manual-vendor-button" onClick={handleDirectManualVendor}>
              {t('events.features.vendors.addManuallyButton')}
            </button>
          </div>
        </div>
      )}
    </FeaturePageTemplate>
  );
};

export default EventVendorsPage;