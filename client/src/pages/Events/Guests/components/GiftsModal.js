/**
 * GiftsModal.js - Guest Gift Tracking Modal
 *
 * Modal for recording and editing gift information for a guest.
 *
 * Props:
 * - isOpen: Whether modal is visible
 * - onClose: Close callback
 * - guest: Guest object to track gift for
 * - onUpdateGift: Save gift callback
 *
 * Gift Data:
 * - hasGift: Whether guest gave a gift
 * - giftDescription: Description of the gift
 * - giftValue: Monetary value (optional)
 *
 * Features:
 * - Toggle gift received status
 * - Text description field
 * - Numeric value input
 * - Pre-populated from guest data
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const GiftsModal = ({ isOpen, onClose, guest, onUpdateGift }) => {
  const { t } = useTranslation();
  const [hasGift, setHasGift] = useState(false);
  const [giftDescription, setGiftDescription] = useState('');
  const [giftValue, setGiftValue] = useState('');

  useEffect(() => {
    if (guest && guest.gift) {
      setHasGift(guest.gift.hasGift || false);
      setGiftDescription(guest.gift.description || '');
      setGiftValue(guest.gift.value || '');
    } else {
      setHasGift(false);
      setGiftDescription('');
      setGiftValue('');
    }
  }, [guest]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const giftData = {
      hasGift,
      giftDescription: hasGift ? giftDescription : '',
      giftValue: hasGift && giftValue ? parseFloat(giftValue) : 0
    };

    onUpdateGift(guest._id, giftData);
  };

  if (!isOpen || !guest) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content gifts-modal">
        <div className="modal-header">
          <h2>{t('guests.gifts.editGifts')}</h2>
          <button 
            className="modal-close-button"
            onClick={onClose}
            type="button"
          >
            ✕
          </button>
        </div>

        <div className="guest-info-display">
          <p><strong>{guest.firstName} {guest.lastName}</strong></p>
          <p>{guest.phone}</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="gifts-form-section">
            <div className="gift-status-options">
              <label className="gift-option">
                <input
                  type="radio"
                  name="hasGift"
                  checked={hasGift === true}
                  onChange={() => setHasGift(true)}
                />
                <span>{t('guests.gifts.hasGift')}</span>
              </label>
              
              <label className="gift-option">
                <input
                  type="radio"
                  name="hasGift"
                  checked={hasGift === false}
                  onChange={() => setHasGift(false)}
                />
                <span>{t('guests.gifts.noGift')}</span>
              </label>
            </div>

            {hasGift && (
              <div className="gift-details">
                <div className="form-group">
                  <label>{t('guests.gifts.giftDescription')} ({t('guests.gifts.optional')})</label>
                  <textarea
                    value={giftDescription}
                    onChange={(e) => setGiftDescription(e.target.value)}
                    placeholder={t('guests.gifts.giftDescription')}
                    rows={3}
                    className="gift-description-input"
                  />
                </div>
                
                <div className="form-group">
                  {/* <label>{t('guests.gifts.giftValue')} ({t('guests.gifts.optional')})</label> */}
                  <label>{t('guests.gifts.giftValue')}</label>
                  <input
                    type="number"
                    value={giftValue}
                    onChange={(e) => setGiftValue(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="10"
                    required
                    className="gift-value-input"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="modal-actions">
            <button
              type="submit"
              className="modal-submit-button"
            >
              {t('general.save')}
            </button>
            <button
              type="button"
              className="modal-cancel-button"
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

export default GiftsModal;