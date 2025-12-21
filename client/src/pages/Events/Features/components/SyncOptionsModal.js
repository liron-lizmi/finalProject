import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/SyncOptionsModal.css';

const SyncOptionsModal = ({
  isOpen,
  onClose,
  options = [],
  affectedGuests = [],
  pendingTriggers = [],
  onApplyOption,
  onMoveToUnassigned,
  canEdit = true,
  isSeparatedSeating = false
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState(null);
  const [showingDetails, setShowingDetails] = useState({});

  if (!isOpen) return null;

  const handleApplyOption = () => {
    if (selectedOption) {
      if (selectedOption.id === 'unassigned') {
        handleMoveToUnassigned();
      } else if (onApplyOption) {
        onApplyOption(selectedOption.id);
      }
    }
  };

  const handleMoveToUnassigned = () => {
    const guestsWithGender = affectedGuests.map(guest => ({
      id: guest.id,
      gender: guest.gender
    }));
    
    if (onMoveToUnassigned && guestsWithGender.length > 0) {
      onMoveToUnassigned(guestsWithGender);
    }
  };

  const toggleDetails = (optionId, event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setShowingDetails(prev => ({
      ...prev,
      [optionId]: !prev[optionId]
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="sync-options-modal">
        <div className="sync-changes-summary">
          <h4>{t('seating.sync.changesDetected')}</h4>
          <div className="affected-guests-list">
            <h5>{t('seating.sync.affectedGuests')} ({affectedGuests.length})</h5>
            {affectedGuests.map(guest => {
              let displayCount = guest.attendingCount || 1;
              if (isSeparatedSeating && guest.gender) {
                displayCount = guest.gender === 'male' 
                  ? (guest.maleCount || 0) 
                  : (guest.femaleCount || 0);
              }
              
              const getGroupDisplayName = (group) => {
                if (!group) return '';
                if (['family', 'friends', 'work', 'other'].includes(group)) {
                  return t(`guests.groups.${group}`);
                }
                return group;
              };
              
              return (
                <div key={guest.id} className="affected-guest-item">
                  <span className="guest-name">{guest.name}</span>
                  {displayCount > 1 && (
                    <span className="attending-count">({displayCount})</span>
                  )}
                  {guest.gender && isSeparatedSeating && (
                    <span className="guest-gender">
                      {t(`seating.genderFilter.${guest.gender}`)}
                    </span>
                  )}
                  <span className="guest-group">{getGroupDisplayName(guest.group)}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="sync-options">
          {options.map(option => (
            <div key={option.id} className="sync-option">
              <div className="option-header">
                <label className="option-selector">
                  <input
                    type="radio"
                    name="syncOption"
                    value={option.id}
                    checked={selectedOption?.id === option.id}
                    onChange={() => setSelectedOption(option)}
                  />
                  <span className="option-title">
                      {option.strategy === 'conservative' 
                        ? t('seating.sync.conservativeTitle')
                        : t('seating.sync.optimalTitle')
                      }
                  </span>
                </label>
                
                <button 
                  className="details-toggle"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    toggleDetails(option.id, e);
                  }}
                  type="button"
                >
                  {showingDetails[option.id] 
                    ? t('seating.sync.hideDetails')
                    : t('seating.sync.showDetails')
                  }
                </button>
              </div>
              
              <div className="option-description">
                {option.strategy === 'conservative' 
                  ? t('seating.sync.conservativeDescription')
                  : t('seating.sync.optimalDescription')
                }
              </div>

              {showingDetails[option.id] && (
                <div className="option-details">
                  <div className="actions-list">
                    <h6>{t('seating.sync.plannedActions')}</h6>
                    {option.actions?.map((action, index) => (
                      <div key={index} className={`action-item ${action.action}`}>
                        <span className="action-icon">
                          {getActionIcon(action.action)}
                        </span>
                        <span className="action-description">
                          {getActionDescription(action, t)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          
          <div className="sync-option">
            <div className="option-header">
              <label className="option-selector">
                <input
                  type="radio"
                  name="syncOption"
                  value="unassigned"
                  checked={selectedOption?.id === 'unassigned'}
                  onChange={() => setSelectedOption({ id: 'unassigned', strategy: 'unassigned' })}
                />
                <span className="option-title">
                  {t('seating.sync.moveAllToUnassigned')}
                </span>
              </label>
            </div>
            
            <div className="option-description">
              {t('seating.sync.alternativeDescription')}
            </div>
          </div>

          <div className="sync-option-apply-wrapper">
            <button 
              className="apply-button"
              onClick={() => {
                if (selectedOption?.id === 'unassigned') {
                  handleMoveToUnassigned();
                } else {
                  handleApplyOption();
                }
              }}
              disabled={!canEdit || !selectedOption}
            >
              {t('seating.sync.applySelected')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const getActionIcon = (actionType) => {
  const icons = {
    guest_seated: '✅',
    guest_moved: '🔄',
    guest_removed: '❌',
    guest_updated: '📝',
    table_created: '🆕',
    table_removed: '🗑️',
    arrangement_optimized: '⚡'
  };
  return icons[actionType];
};

const getActionDescription = (action, t) => {
  const { details } = action;
  
  switch (action.action) {
    case 'guest_seated':
      return t('seating.sync.actionDescriptions.guestSeated', {
        guestName: details?.guestName || t('seating.unknownGuest'),
        tableName: details?.tableName || t('seating.unknownTable')
      });
    case 'guest_moved':
      return t('seating.sync.actionDescriptions.guestMoved', {
        guestName: details?.guestName || t('seating.unknownGuest'),
        fromTable: details?.fromTable || t('seating.unknownTable'),
        toTable: details?.toTable || t('seating.unknownTable')
      });
    case 'guest_removed':
      return t('seating.sync.actionDescriptions.guestRemoved', {
        guestName: details?.guestName || t('seating.unknownGuest'),
        tableName: details?.tableName || t('seating.unknownTable')
      });
    case 'guest_updated':
      return t('seating.sync.actionDescriptions.guestUpdated', {
        guestName: details?.guestName || t('seating.unknownGuest'),
        tableName: details?.tableName || t('seating.unknownTable')
      });
    case 'table_created':
      return t('seating.sync.actionDescriptions.tableCreated', {
        tableName: details?.tableName || t('seating.tableName', { number: '?' }),
        capacity: details?.capacity || 0
      });
    case 'table_removed':
      return t('seating.sync.actionDescriptions.tableRemoved');
    default:
      return '';
  }
};

export default SyncOptionsModal;