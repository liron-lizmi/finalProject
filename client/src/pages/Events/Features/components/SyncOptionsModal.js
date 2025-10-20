import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

const SyncOptionsModal = ({
  isOpen,
  onClose,
  options = [],
  affectedGuests = [],
  pendingTriggers = [],
  onApplyOption,
  onMoveToUnassigned,
  canEdit = true
}) => {
  const { t } = useTranslation();
  const [selectedOption, setSelectedOption] = useState(null);
  const [showingDetails, setShowingDetails] = useState({});

  if (!isOpen) return null;

  const handleApplyOption = () => {
    if (selectedOption && onApplyOption) {
      onApplyOption(selectedOption.id);
    }
  };

  const handleMoveToUnassigned = () => {
    const guestIds = affectedGuests.map(guest => guest.id);
    if (onMoveToUnassigned && guestIds.length > 0) {
      onMoveToUnassigned(guestIds);
    }
  };

  const toggleDetails = (optionId) => {
    setShowingDetails(prev => ({
      ...prev,
      [optionId]: !prev[optionId]
    }));
  };

  return (
    <div className="modal-overlay">
      <div className="sync-options-modal">
        <div className="modal-header">
          <h3>{t('seating.sync.modalTitle')}</h3>
          <button className="modal-close-button" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-content">
          <div className="sync-changes-summary">
            <h4>{t('seating.sync.changesDetected')}</h4>
            <div className="affected-guests-list">
              <h5>{t('seating.sync.affectedGuests')} ({affectedGuests.length})</h5>
              {affectedGuests.map(guest => (
                <div key={guest.id} className="affected-guest-item">
                  <span className="guest-name">{guest.name}</span>
                  {guest.attendingCount > 1 && (
                    <span className="attending-count">({guest.attendingCount})</span>
                  )}
                  <span className="guest-group">{guest.group}</span>
                </div>
              ))}
            </div>

            {pendingTriggers.length > 0 && (
              <div className="pending-triggers">
                <h5>{t('seating.sync.pendingChanges')}</h5>
                {pendingTriggers.map(trigger => (
                  <div key={trigger.id} className="trigger-item">
                    <span className="trigger-type">
                      {t(`seating.sync.triggerTypes.${trigger.changeType}`)}
                    </span>
                    <span className="trigger-time">
                      {new Date(trigger.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="sync-options">
            <h4>{t('seating.sync.chooseOption')}</h4>
            
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
                    <div className="option-info">
                      <h5 className="option-title">
                        {option.strategy === 'conservative' 
                          ? t('seating.sync.conservativeTitle')
                          : t('seating.sync.optimalTitle')
                        }
                      </h5>
                      <p className="option-description">
                        {option.strategy === 'conservative' 
                          ? t('seating.sync.conservativeDescription')
                          : t('seating.sync.optimalDescription')
                        }
                      </p>
                    </div>
                  </label>
                  
                  <button 
                    className="details-toggle"
                    onClick={() => toggleDetails(option.id)}
                  >
                    {showingDetails[option.id] 
                      ? t('seating.sync.hideDetails')
                      : t('seating.sync.showDetails')
                    }
                  </button>
                </div>

                {showingDetails[option.id] && (
                  <div className="option-details">
                    <div className="option-stats">
                      <div className="stat">
                        <span className="stat-label">{t('seating.stats.totalTables')}</span>
                        <span className="stat-value">{option.stats?.totalTables || 0}</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">{t('seating.sync.utilization')}</span>
                        <span className="stat-value">{option.stats?.utilizationRate || 0}%</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">{t('seating.sync.seatedPeople')}</span>
                        <span className="stat-value">{option.stats?.seatedPeople || 0}</span>
                      </div>
                    </div>

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
          </div>

          <div className="alternative-actions">
            <h4>{t('seating.sync.alternativeActions')}</h4>
            <p>{t('seating.sync.alternativeDescription')}</p>
            <button 
              className="move-to-unassigned-button"
              onClick={handleMoveToUnassigned}
              disabled={!canEdit}
            >
              {t('seating.sync.moveAllToUnassigned')}
            </button>
          </div>
        </div>

        <div className="modal-actions">
          <button className="cancel-button" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button 
            className="apply-button"
            onClick={handleApplyOption}
            disabled={!canEdit || !selectedOption}
          >
            {t('seating.sync.applySelected')}
          </button>
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
  return icons[actionType] || '📋';
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
      return details?.reason || t('seating.sync.actionDescriptions.unknown');
  }
};

export default SyncOptionsModal;