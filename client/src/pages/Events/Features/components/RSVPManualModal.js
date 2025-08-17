// src/components/RSVPManualModal.js
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/RSVPManualModal.css';

const RSVPManualModal = ({ isOpen, onClose, guest, onUpdateRSVP }) => {
  const { t } = useTranslation();
  const [rsvpStatus, setRsvpStatus] = useState('pending');
  const [attendingCount, setAttendingCount] = useState(1);
  const [guestNotes, setGuestNotes] = useState('');

  useEffect(() => {
    if (isOpen && guest) {
      setRsvpStatus(guest.rsvpStatus || 'pending');
      setAttendingCount(guest.attendingCount || 1);
      setGuestNotes(guest.guestNotes || '');
    }
  }, [isOpen, guest]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!guest) return;

    onUpdateRSVP({
      guestId: guest._id,
      rsvpStatus,
      attendingCount: rsvpStatus === 'confirmed' ? attendingCount : 0,
      guestNotes
    });
  };

  if (!isOpen || !guest) return null;

  return (
    <div className="rsvp-modal-overlay">
      <div className="rsvp-modal-content">
        <div className="rsvp-modal-header">
          <h3>{t('guests.rsvp.editRSVPFor', { name: `${guest.firstName} ${guest.lastName}` })}</h3>
          <button
            className="rsvp-modal-close"
            onClick={onClose}
          >
            ✖️
          </button>
        </div>

        <form onSubmit={handleSubmit} className="rsvp-modal-form">
          <div className="guest-info-display">
            <p><strong>{guest.firstName} {guest.lastName}</strong></p>
            <p>{guest.phone}</p>
          </div>

          {rsvpStatus === 'confirmed' && (
            <div className="rsvp-form-group">
              <label htmlFor="attending-count">
                {t('guests.rsvp.howManyAttending')}
              </label>
              <div className="count-input-container">
                <button
                  type="button"
                  className="count-button decrease"
                  onClick={() => setAttendingCount(prev => prev > 1 ? prev - 1 : 1)}
                >
                  −
                </button>
                <input
                  type="number"
                  id="attending-count"
                  value={attendingCount}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (value >= 1) {
                      setAttendingCount(value);
                    }
                  }}
                  min="1"
                  className="count-input"
                />
                <button
                  type="button"
                  className="count-button increase"
                  onClick={() => setAttendingCount(prev => prev + 1)}
                >
                  +
                </button>
              </div>
            </div>
          )}

          <div className="rsvp-form-group">
            <label htmlFor="rsvp-status">
              {t('guests.rsvp.status')}
            </label>
            <select
              id="rsvp-status"
              value={rsvpStatus}
              onChange={(e) => setRsvpStatus(e.target.value)}
              className="rsvp-form-input"
            >
              <option value="pending">{t('guests.rsvp.pending')}</option>
              <option value="confirmed">{t('guests.rsvp.confirmed')}</option>
              <option value="declined">{t('guests.rsvp.declined')}</option>
              <option value="no_response">{t('guests.rsvp.no_response')}</option>
            </select>
          </div>

          <div className="rsvp-form-group">
            <label htmlFor="guest-notes">
              {t('guests.rsvp.notes')} ({t('guests.rsvp.optional')})
            </label>
            <textarea
              id="guest-notes"
              value={guestNotes}
              onChange={(e) => setGuestNotes(e.target.value)}
              className="rsvp-form-textarea"
              placeholder={t('guests.rsvp.notesPlaceholder')}
              rows="3"
              maxLength="500"
            />
            <small className="character-count">
              {guestNotes.length}/500
            </small>
          </div>

          <div className="rsvp-modal-actions">
            <button
              type="submit"
              className="rsvp-submit-button"
            >
              {t('guests.rsvp.updateRSVP')}
            </button>
            <button
              type="button"
              className="rsvp-cancel-button"
              onClick={onClose}
            >
              {t('common.cancel')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RSVPManualModal;