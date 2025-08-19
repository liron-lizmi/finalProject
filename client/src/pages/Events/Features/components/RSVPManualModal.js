import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const RSVPManualModal = ({ isOpen, onClose, guest, onUpdateRSVP }) => {
  const { t } = useTranslation();
  const [rsvpStatus, setRsvpStatus] = useState('pending');
  const [attendingCount, setAttendingCount] = useState(1);
  const [guestNotes, setGuestNotes] = useState('');

  useEffect(() => {
    if (guest) {
      setRsvpStatus(guest.rsvpStatus || 'pending');
      // הבטח שattendingCount תמיד יהיה מספר חוקי
      setAttendingCount(guest.attendingCount && guest.attendingCount > 0 ? guest.attendingCount : 1);
      setGuestNotes(guest.guestNotes || '');
    }
  }, [guest]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!guest) return;

    const updatedData = {
      guestId: guest._id,
      rsvpStatus,
      guestNotes,
      attendingCount: rsvpStatus === 'confirmed' ? Math.max(1, attendingCount) : 0
    };

    onUpdateRSVP(updatedData);
  };

  const handleAttendingCountChange = (newCount) => {
    // הבטח שהמספר תמיד יהיה לפחות 1 עבור אישור הגעה
    const validCount = Math.max(1, Math.min(10, newCount));
    setAttendingCount(validCount);
  };

  if (!isOpen || !guest) return null;

  return (
    <div className="rsvp-modal-overlay" onClick={onClose} style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div className="rsvp-modal" onClick={(e) => e.stopPropagation()} style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '20px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflowY: 'auto',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <div className="rsvp-modal-header" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #eee',
          paddingBottom: '10px'
        }}>
          <h3 style={{ margin: 0 }}>{t('guests.rsvp.editRSVP') || 'עריכת אישור הגעה'}</h3>
          <button className="rsvp-modal-close" onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '5px'
          }}>
            ✕
          </button>
        </div>

        <div className="rsvp-modal-content">
          <div className="guest-info" style={{
            marginBottom: '20px',
            padding: '10px',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px'
          }}>
            <h4 style={{ margin: '0 0 5px 0' }}>{guest.firstName} {guest.lastName}</h4>
            <p style={{ margin: 0, color: '#666' }}>{guest.phone}</p>
          </div>

          <form onSubmit={handleSubmit} className="rsvp-form">
            <div className="rsvp-form-group" style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '10px',
                fontWeight: 'bold'
              }}>{t('guests.rsvp.status') || 'סטטוס הגעה'}</label>
              <div className="rsvp-status-options" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                <label className="rsvp-radio-option" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="rsvpStatus"
                    value="confirmed"
                    checked={rsvpStatus === 'confirmed'}
                    onChange={(e) => setRsvpStatus(e.target.value)}
                  />
                  <span className="rsvp-radio-label confirmed" style={{ color: '#28a745' }}>
                    ✅ {t('guests.rsvp.confirmed') || 'מגיע'}
                  </span>
                </label>
                
                <label className="rsvp-radio-option" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="rsvpStatus"
                    value="declined"
                    checked={rsvpStatus === 'declined'}
                    onChange={(e) => setRsvpStatus(e.target.value)}
                  />
                  <span className="rsvp-radio-label declined" style={{ color: '#dc3545' }}>
                    ❌ {t('guests.rsvp.declined') || 'לא מגיע'}
                  </span>
                </label>

                <label className="rsvp-radio-option" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer'
                }}>
                  <input
                    type="radio"
                    name="rsvpStatus"
                    value="pending"
                    checked={rsvpStatus === 'pending'}
                    onChange={(e) => setRsvpStatus(e.target.value)}
                  />
                  <span className="rsvp-radio-label pending" style={{ color: '#ffc107' }}>
                    ⏳ {t('guests.rsvp.pending') || 'ממתין לתשובה'}
                  </span>
                </label>
              </div>
            </div>

            {rsvpStatus === 'confirmed' && (
              <div className="rsvp-form-group" style={{ marginBottom: '20px' }}>
                <label htmlFor="attending-count" style={{
                  display: 'block',
                  marginBottom: '10px',
                  fontWeight: 'bold'
                }}>
                  {t('guests.rsvp.attendingCount') || 'כמות מגיעים'}
                </label>
                <div className="count-input-container" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: '5px'
                }}>
                  <button
                    type="button"
                    className="count-button decrease"
                    onClick={() => handleAttendingCountChange(attendingCount - 1)}
                    disabled={attendingCount <= 1}
                    style={{
                      width: '50px',
                      height: '50px',
                      border: '2px solid #007bff',
                      backgroundColor: attendingCount <= 1 ? '#e9ecef' : '#ffffff',
                      color: attendingCount <= 1 ? '#6c757d' : '#007bff',
                      cursor: attendingCount <= 1 ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                    onMouseOver={(e) => {
                      if (attendingCount > 1) {
                        e.target.style.backgroundColor = '#007bff';
                        e.target.style.color = 'white';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (attendingCount > 1) {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.color = '#007bff';
                      }
                    }}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    id="attending-count"
                    value={attendingCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (!isNaN(value) && value >= 1) {
                        handleAttendingCountChange(value);
                      }
                    }}
                    min="1"
                    max="10"
                    className="count-input"
                    style={{
                      width: '80px',
                      height: '50px',
                      textAlign: 'center',
                      border: '2px solid #dee2e6',
                      borderRadius: '8px',
                      fontSize: '18px',
                      fontWeight: 'bold',
                      backgroundColor: '#ffffff'
                    }}
                  />
                  <button
                    type="button"
                    className="count-button increase"
                    onClick={() => handleAttendingCountChange(attendingCount + 1)}
                    disabled={attendingCount >= 20}
                    style={{
                      width: '50px',
                      height: '50px',
                      border: '2px solid #007bff',
                      backgroundColor: attendingCount >= 20 ? '#e9ecef' : '#ffffff',
                      color: attendingCount >= 20 ? '#6c757d' : '#007bff',
                      cursor: attendingCount >= 20 ? 'not-allowed' : 'pointer',
                      borderRadius: '8px',
                      fontSize: '24px',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                    onMouseOver={(e) => {
                      if (attendingCount < 20) {
                        e.target.style.backgroundColor = '#007bff';
                        e.target.style.color = 'white';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (attendingCount < 20) {
                        e.target.style.backgroundColor = '#ffffff';
                        e.target.style.color = '#007bff';
                      }
                    }}
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="rsvp-form-group" style={{ marginBottom: '20px' }}>
              <label htmlFor="guest-notes" style={{
                display: 'block',
                marginBottom: '10px',
                fontWeight: 'bold'
              }}>
                {t('guests.rsvp.notes') || 'הערות'} ({t('guests.rsvp.optional') || 'רשות'})
              </label>
              <textarea
                id="guest-notes"
                value={guestNotes}
                onChange={(e) => setGuestNotes(e.target.value)}
                placeholder={t('guests.rsvp.notesPlaceholder') || 'הערות נוספות...'}
                className="rsvp-form-textarea"
                rows="3"
                maxLength="500"
                style={{
                  width: '100%',
                  padding: '10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
              />
              <small className="character-count" style={{
                color: '#666',
                fontSize: '12px',
                float: 'right'
              }}>
                {guestNotes.length}/500
              </small>
            </div>

            <div className="rsvp-form-actions" style={{
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end',
              marginTop: '30px',
              paddingTop: '20px',
              borderTop: '1px solid #eee'
            }}>
              <button
                type="button"
                className="rsvp-cancel-button"
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  border: '1px solid #6c757d',
                  backgroundColor: '#f8f9fa',
                  color: '#495057',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {t('common.cancel') || 'ביטול'}
              </button>
              <button
                type="submit"
                className="rsvp-submit-button"
                style={{
                  padding: '12px 24px',
                  border: 'none',
                  backgroundColor: '#007bff',
                  color: 'white',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {t('guests.rsvp.updateRSVP') || 'עדכן אישור הגעה'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RSVPManualModal;