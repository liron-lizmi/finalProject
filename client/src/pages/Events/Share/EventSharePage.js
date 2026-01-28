/**
 * EventSharePage.js - Event Sharing Management Page
 *
 * Share event access with other users via email invitation.
 *
 * Route: /event/:id/share
 *
 * Features:
 * - Share event with other users by email
 * - Set permission level (view/edit)
 * - View list of shared users
 * - Remove shared access
 * - Owner-only actions (only owner can share)
 *
 * Permissions:
 * - view: Can only view event data
 * - edit: Can modify event data
 *
 * Shared User Data:
 * - Email address
 * - Permission level
 * - Share date
 *
 * Validation:
 * - Valid email format required
 * - Cannot share with self
 * - Cannot share with existing shared user
 */
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useModal } from '../../../hooks/useModal';
import FeaturePageTemplate from '../shared/FeaturePageTemplate';
import { apiFetch } from '../../../utils/api';
import '../../../styles/EventSharePage.css';

const EventSharePage = () => {
  const { t } = useTranslation();
  const { id: eventId } = useParams();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('view');
  const [sharedUsers, setSharedUsers] = useState([]);
  const [eventInfo, setEventInfo] = useState(null);
  const [canEdit, setCanEdit] = useState(null); 
  const [emailError, setEmailError] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const { showSuccessModal, showErrorModal, showConfirmModal, Modal } = useModal();

  useEffect(() => {
    const loadInitialData = async () => {
      setInitialLoading(true);
      await Promise.all([
        loadEventInfo(),
        loadSharedUsers(),
        checkEditPermission()
      ]);
      setInitialLoading(false);
    };
    
    loadInitialData();
  }, [eventId]);

  const loadEventInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept-Language': localStorage.getItem('language') || 'he'
        }
      });

      if (response.ok) {
        const event = await response.json();
        setEventInfo(event);
      }
    } catch (error) {
      // Error loading event info
    }
  };

  const loadSharedUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/shared-users`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept-Language': localStorage.getItem('language') || 'he'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSharedUsers(data.sharedWith || []);
        setIsOwner(data.isOwner || false);
      }
    } catch (error) {
      setSharedUsers([]);
      setIsOwner(false);
    }
  };

  const checkEditPermission = async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await apiFetch(`/api/events/${eventId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept-Language': localStorage.getItem('language') || 'he'
      }
    });

    if (response.ok) {
      const eventData = await response.json();
      setCanEdit(eventData.canEdit || false);
      
      setEventInfo(eventData);
    }
  } catch (error) {
    setCanEdit(false);
  }
};

  const handleShareEvent = async (e) => {
    e.preventDefault();
  
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(shareEmail)) {
      setEmailError(t('validation.emailInvalid'));
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept-Language': localStorage.getItem('language') || 'he'
        },
        body: JSON.stringify({
          email: shareEmail,
          permission: sharePermission
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        showSuccessModal(data.message);
        setShareEmail('');
        setSharePermission('view');
        loadSharedUsers();
      } else {
        const messageText = data.message || '';
        const isAlreadyShared = messageText.includes('כבר שותף') || 
                                messageText.includes('already shared') || 
                                messageText.includes('כבר קיבל גישה') ||
                                data.alreadyShared === true;
        
        if (isAlreadyShared) {
          showErrorModal(t('events.features.share.alreadyShared') || data.message);
        } else {
          showErrorModal(data.message || t('errors.serverError'));
        }
      }
    } catch (error) {
      showErrorModal(t('errors.serverError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveShare = async (shareId) => {
    showConfirmModal(t('events.features.share.confirmRemove'), async () => {
      await executeRemoveShare(shareId);
    });
  };

  const executeRemoveShare = async (shareId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/share/${shareId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept-Language': localStorage.getItem('language') || 'he'
        }
      });

      const data = await response.json();
      
      if (response.ok) {
        showSuccessModal(data.message);
        loadSharedUsers();
      } else {
        showErrorModal(data.message || t('errors.serverError'));
      }
    } catch (error) {
      showErrorModal(t('errors.serverError'));
    }
  };

  const handleUpdatePermission = async (shareId, newPermission) => {
    try {
      const token = localStorage.getItem('token');
      const response = await apiFetch(`/api/events/${eventId}/share/${shareId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept-Language': localStorage.getItem('language') || 'he'
        },
        body: JSON.stringify({ permission: newPermission })
      });

      const data = await response.json();
      
      if (response.ok) {
        loadSharedUsers();
      } else {
        showErrorModal(data.message || t('errors.serverError'));
      }
    } catch (error) {
      showErrorModal(t('errors.serverError'));
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('he-IL');
  };

  const getPermissionText = (permission) => {
    return permission === 'edit' ? t('events.features.share.editAccess') : t('events.features.share.viewOnly');
  };

  return (
    <FeaturePageTemplate
      title={t('events.features.share.shareEvent')}
      icon="🔗"
      description={t('events.features.share.shareDescription')}
    >
      <div className="share-content">
        {initialLoading ? (
          <div className="loading-container">
            <p>{t('general.loading')}</p>
          </div>
        ) : (
          <>
            {/* Info Section */}
            <div className="info-section">
              <div className="info-card">
                <div className="info-header">
                  <span className="info-icon">ℹ️</span>
                  <h4>{t('events.features.share.importantInfo')}</h4>
                </div>
                <div className="info-content">
                  <ul>
                    <li>
                      <span className="list-icon">👁️</span>
                      {t('events.features.share.viewPermissionInfo')}
                    </li>
                    <li>
                      <span className="list-icon">✏️</span>
                      {t('events.features.share.editPermissionInfo')}
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {eventInfo && !isOwner && (
              <div className="shared-event-alert">
                <div className="alert-icon">👥</div>
                <div className="alert-text">
                  <h4>{t('events.features.share.sharedEventInfo')}</h4>
                  <p>{t('events.features.share.yourPermission')}: {getPermissionText(canEdit ? 'edit' : 'view')}</p>
                </div>
              </div>
            )}

            {isOwner && (
              <div className="share-form-section">
                <h3 className="section-title">
                  {t('events.features.share.shareWith')}
                </h3>
                
                <form onSubmit={handleShareEvent} className="modern-share-form">
                  <div className="form-row">
                    <div className="input-group">
                      <label htmlFor="shareEmail" className="input-label">
                        {t('events.features.share.emailLabel')}
                      </label>
                      <input
                        id="shareEmail"
                        type="email"
                        value={shareEmail}
                        onChange={(e) => {
                          setShareEmail(e.target.value);
                          setEmailError('');
                        }}
                        placeholder={t('events.features.share.emailPlaceholder')}
                        className="email-input"
                        disabled={loading}
                        />
                        {emailError && (
                          <div className="email-error">
                            {emailError}
                          </div>
                        )}
                      </div>

                      <div className="input-group">
                      <label htmlFor="sharePermission" className="input-label">
                        {t('events.features.share.permissions')}
                      </label>
                      <select
                        id="sharePermission"
                        value={sharePermission}
                        onChange={(e) => setSharePermission(e.target.value)}
                        className="permission-select"
                        disabled={loading}
                      >
                        <option value="view">{t('events.features.share.viewOnly')}</option>
                        <option value="edit">{t('events.features.share.editAccess')}</option>
                      </select>
                    </div>

                    <button
                      type="submit"
                      className="share-submit-btn"
                      disabled={loading || !shareEmail.trim()}
                    >
                      <span className="btn-icon">📤</span>
                      {loading ? t('common.loading') : t('events.features.share.shareButton')}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {isOwner && (
              <div className="shared-users-section">
                <h3 className="section-title">
                  {t('events.features.share.sharedWith')}
                </h3>
                
                {sharedUsers.length === 0 ? (
                  <div className="empty-state">
                    <div className="empty-icon">📭</div>
                    <h4>{t('events.features.share.noSharedUsers')}</h4>
                    <p>{t('events.features.share.shareToCollaborate')}</p>
                  </div>
                ) : (
                  <div className="shared-users-list">
                    {sharedUsers.map((share) => (
                      <div key={share._id} className="shared-user-card">
                        <div className="user-avatar">
                          <span className="avatar-icon">👤</span>
                        </div>
                        
                        <div className="user-details">
                          <div className="user-primary">
                            <h4 className="user-email">{share.email}</h4>
                            {share.userId && (
                              <p className="user-name">
                                {share.userId.firstName} {share.userId.lastName}
                              </p>
                            )}
                          </div>
                          
                          <div className="user-meta">
                            <span className="share-date">
                              {t('events.features.share.sharedOn')}: {formatDate(share.sharedAt)}
                            </span>
                            <span className={`status-indicator ${share.accepted ? 'accepted' : 'pending'}`}>
                              <span className="status-dot"></span>
                              {share.accepted ? t('events.features.share.accepted') : t('events.features.share.pending')}
                            </span>
                          </div>
                        </div>

                        <div className="user-actions">
                          {isOwner ? (
                            <>
                              <div className="permission-control">
                                <select
                                  value={share.permission}
                                  onChange={(e) => handleUpdatePermission(share._id, e.target.value)}
                                  className="permission-select-inline"
                                >
                                  <option value="view">{t('events.features.share.viewOnly')}</option>
                                  <option value="edit">{t('events.features.share.editAccess')}</option>
                                </select>
                              </div>

                              <button
                                onClick={() => handleRemoveShare(share._id)}
                                className="remove-btn"
                                title={t('events.features.share.removeAccess')}
                              >
                                <span className="btn-icon">🗑️</span>
                              </button>
                            </>
                          ) : (
                            <div className="permission-display">
                              <span className={`permission-badge ${share.permission}`}>
                                <span className="badge-icon">
                                  {share.permission === 'edit' ? '✏️' : '👁️'}
                                </span>
                                {getPermissionText(share.permission)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {Modal}

    </FeaturePageTemplate>
  );
};

export default EventSharePage;