/**
 * TableDetailsModal.js - Table Configuration Modal
 *
 * Modal for viewing and editing table details and guest assignments.
 *
 * Props:
 * - isOpen: Whether modal is visible
 * - table: Table object to edit
 * - guests: All guests data
 * - seatingArrangement: Current assignments
 * - onClose: Close callback
 * - onUpdateTable: Save table changes
 * - onDeleteTable: Delete table callback
 * - onSeatGuest: Assign guest to table
 * - onUnseatGuest: Remove guest from table
 * - isSeparatedSeating: Gender-separated mode
 * - genderFilter: Current gender filter
 * - maleTables/femaleTables: Gender assignments
 * - maleArrangement/femaleArrangement: Gender-specific mappings
 * - canEdit: Whether editing allowed
 *
 * Table Properties:
 * - name: Table display name
 * - capacity: Maximum guests
 * - type: round or rectangular
 * - notes: Optional notes
 *
 * Features:
 * - Edit table properties
 * - View seated guests
 * - Add/remove guests from table
 * - Capacity validation
 * - Delete confirmation
 * - Gender filtering for separated seating
 */
import React, { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const TableDetailsModal = ({
  isOpen,
  table,
  guests,
  seatingArrangement,
  onClose,
  onUpdateTable,
  onDeleteTable,
  onSeatGuest,
  onUnseatGuest,
  isSeparatedSeating,
  genderFilter,
  maleTables,
  femaleTables,
  maleArrangement,
  femaleArrangement,
  canEdit = true
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'he';
  
  const [formData, setFormData] = useState({
    name: '',
    capacity: 12,
    type: 'round',
    notes: ''
  });

  const [showAddGuests, setShowAddGuests] = useState(false);
  const [searchGuestTerm, setSearchGuestTerm] = useState('');
  const [showInvalidCapacityModal, setShowInvalidCapacityModal] = useState(false);
  const [showCapacityTooSmallModal, setShowCapacityTooSmallModal] = useState(false);
  const [showNotEnoughSpaceModal, setShowNotEnoughSpaceModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [capacityErrorData, setCapacityErrorData] = useState({ current: 0, requested: 0 });

  const [pendingAddedGuests, setPendingAddedGuests] = useState([]);
  const [pendingRemovedGuests, setPendingRemovedGuests] = useState([]);

  const tableInfo = useMemo(() => {
    if (!table || !isSeparatedSeating) {
      return { isNeutral: !isSeparatedSeating, gender: null };
    }

    const isMaleTable = maleTables && maleTables.some(t => t.id === table.id);
    const isFemaleTable = femaleTables && femaleTables.some(t => t.id === table.id);
    
    return {
      isNeutral: !isMaleTable && !isFemaleTable,
      gender: isMaleTable ? 'male' : isFemaleTable ? 'female' : null
    };
  }, [table, isSeparatedSeating, maleTables, femaleTables]);

  const availableGuests = useMemo(() => {
    if (!guests) return [];

    const pendingAddedIds = pendingAddedGuests.map(g => g.guestId.toString());

    if (isSeparatedSeating) {
      const guestsWithGender = [];

      guests.forEach(guest => {
        const hasMales = (guest.maleCount || 0) > 0;
        const hasFemales = (guest.femaleCount || 0) > 0;

        if (hasMales) {
          const maleGuestId = `${guest._id}_male`;
          const maleAssigned = Object.values(maleArrangement || {}).flat().includes(guest._id.toString());
          const isPendingAdded = pendingAddedIds.includes(maleGuestId);
          if (!maleAssigned && !isPendingAdded) {
            if (!table || tableInfo.isNeutral || tableInfo.gender === 'male') {
              guestsWithGender.push({
                ...guest,
                _id: maleGuestId,
                originalId: guest._id,
                displayGender: 'male',
                attendingCount: guest.maleCount
              });
            }
          }
        }

        if (hasFemales) {
          const femaleGuestId = `${guest._id}_female`;
          const femaleAssigned = Object.values(femaleArrangement || {}).flat().includes(guest._id.toString());
          const isPendingAdded = pendingAddedIds.includes(femaleGuestId);
          if (!femaleAssigned && !isPendingAdded) {
            if (!table || tableInfo.isNeutral || tableInfo.gender === 'female') {
              guestsWithGender.push({
                ...guest,
                _id: femaleGuestId,
                originalId: guest._id,
                displayGender: 'female',
                attendingCount: guest.femaleCount
              });
            }
          }
        }
      });

      return guestsWithGender;
    }

    let assignedGuestIds = [];
    if (seatingArrangement) {
      assignedGuestIds = Object.values(seatingArrangement).flat();
    }

    return guests.filter(guest => {
      const isAssigned = assignedGuestIds.includes(guest._id.toString());
      const isPendingAdded = pendingAddedIds.includes(guest._id.toString());
      return !isAssigned && !isPendingAdded;
    });
  }, [guests, seatingArrangement, maleArrangement, femaleArrangement, isSeparatedSeating, table, tableInfo, pendingAddedGuests]);

  const seatedGuestIds = useMemo(() => {
    if (!table) return [];

    let baseGuestIds = [];
    if (isSeparatedSeating && !tableInfo.isNeutral) {
      if (tableInfo.gender === 'male' && maleArrangement) {
        baseGuestIds = maleArrangement[table.id] || [];
      } else if (tableInfo.gender === 'female' && femaleArrangement) {
        baseGuestIds = femaleArrangement[table.id] || [];
      }
    } else {
      baseGuestIds = seatingArrangement ? (seatingArrangement[table.id] || []) : [];
    }

    const pendingAddedIds = pendingAddedGuests.map(g => g.guestId);
    const pendingRemovedIds = pendingRemovedGuests.map(g => g.guestId);

    const filteredIds = baseGuestIds.filter(id => {
      const normalizedId = id.toString().replace(/_male$|_female$/, '');
      return !pendingRemovedIds.some(removedId =>
        removedId.toString().replace(/_male$|_female$/, '') === normalizedId
      );
    });

    return [...filteredIds, ...pendingAddedIds];
  }, [table, seatingArrangement, isSeparatedSeating, tableInfo, maleArrangement, femaleArrangement, pendingAddedGuests, pendingRemovedGuests]);

  const seatedGuests = useMemo(() => {
    if (!guests || !seatedGuestIds) return [];
    return seatedGuestIds
      .map(id => guests.find(g => g._id.toString() === id.toString().replace(/_male$|_female$/, '')))
      .filter(Boolean);
  }, [seatedGuestIds, guests]);

  const currentOccupancy = useMemo(() => {
    if (!seatedGuests || seatedGuests.length === 0) return 0;

    const pendingAddedIds = pendingAddedGuests.map(g => g.guestId.toString());

    return seatedGuests.reduce((sum, guest) => {
      const guestIdStr = guest._id.toString();

      const pendingEntry = pendingAddedGuests.find(g =>
        g.guestId.toString().replace(/_male$|_female$/, '') === guestIdStr
      );

      if (isSeparatedSeating && table && !tableInfo.isNeutral) {
        if (tableInfo.gender === 'male') {
          return sum + (guest.maleCount || 0);
        } else if (tableInfo.gender === 'female') {
          return sum + (guest.femaleCount || 0);
        }
      }

      if (isSeparatedSeating && table && tableInfo.isNeutral) {
        const isMaleInThisTable = (maleArrangement && maleArrangement[table.id] &&
                                  maleArrangement[table.id].includes(guestIdStr)) ||
                                  (pendingEntry && pendingEntry.guestId.toString().includes('_male'));
        const isFemaleInThisTable = (femaleArrangement && femaleArrangement[table.id] &&
                                    femaleArrangement[table.id].includes(guestIdStr)) ||
                                    (pendingEntry && pendingEntry.guestId.toString().includes('_female'));

        let guestCount = 0;
        if (isMaleInThisTable) {
          guestCount += (guest.maleCount || 0);
        }
        if (isFemaleInThisTable) {
          guestCount += (guest.femaleCount || 0);
        }

        if (!isMaleInThisTable && !isFemaleInThisTable) {
          guestCount = guest.attendingCount || 1;
        }

        return sum + guestCount;
      }

      return sum + (guest.attendingCount || 1);
    }, 0);
  }, [seatedGuests, isSeparatedSeating, table, tableInfo, maleArrangement, femaleArrangement, pendingAddedGuests]);

  const minAllowedCapacity = useMemo(() => {
    return Math.max(8, currentOccupancy);
  }, [currentOccupancy]);

  const isOvercapacity = useMemo(() => {
    if (!table) return false;
    return currentOccupancy > table.capacity;
  }, [currentOccupancy, table]);

  const filteredAvailableGuests = useMemo(() => {
    return availableGuests.filter(guest => {
      if (!searchGuestTerm) return true;
      const searchLower = searchGuestTerm.toLowerCase();
      const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
      return fullName.includes(searchLower);
    });
  }, [availableGuests, searchGuestTerm]);

  useEffect(() => {
    if (table) {
      setFormData({
        name: table.name || '',
        capacity: table.capacity || 12,
        type: table.type || 'round',
        notes: table.notes || ''
      });
      setPendingAddedGuests([]);
      setPendingRemovedGuests([]);
    }
  }, [table]);

  if (!isOpen || !table) return null;

  const calculateTableSize = (type, capacity) => {
    const baseSize = 120;
    
    switch (type) {
      case 'round':
        return { width: baseSize, height: baseSize };
      case 'square':
        return { width: baseSize, height: baseSize };
      case 'rectangular':
        const width = baseSize * 1.5;
        const height = baseSize * 0.8;
        return { width, height };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  const handleSave = () => {
    const capacity = parseInt(formData.capacity, 10);

    if (isNaN(capacity) || capacity < 8 || capacity > 36) {
      setShowInvalidCapacityModal(true);
      return;
    }

    if (capacity < currentOccupancy) {
      setCapacityErrorData({ current: currentOccupancy, requested: capacity });
      setShowCapacityTooSmallModal(true);
      return;
    }

    const newSize = calculateTableSize(formData.type, capacity);

    pendingRemovedGuests.forEach(({ guestId }) => {
      onUnseatGuest(guestId);
    });

    pendingAddedGuests.forEach(({ guestId, tableId }) => {
      onSeatGuest(guestId, tableId);
    });

    onUpdateTable(table.id, {
      name: formData.name,
      capacity: capacity,
      type: formData.type,
      notes: formData.notes,
      isDraft: false,
      size: newSize
    });

    setPendingAddedGuests([]);
    setPendingRemovedGuests([]);

    onClose(true);
  };

  const handleDelete = () => {
  setShowDeleteConfirmModal(true);
};

const confirmDelete = () => {
  onDeleteTable(table.id);
  setShowDeleteConfirmModal(false);
  onClose();
};

const cancelDelete = () => {
  setShowDeleteConfirmModal(false);
};

  const handleCapacityChange = (newCapacity, fromButton = false) => {
    const capacity = parseInt(newCapacity, 10);

    if (fromButton) {
      if (!isNaN(capacity) && capacity >= minAllowedCapacity && capacity <= 36) {
        setFormData(prev => ({ ...prev, capacity }));
      }
      return;
    }

    if (!isNaN(capacity) && capacity >= 1 && capacity <= 36) {
      setFormData(prev => ({ ...prev, capacity }));
    }
  };

  const handleAddGuest = (guestIdParam) => {
    const guest = guests.find(g => g._id === guestIdParam || g._id.toString() === guestIdParam.toString().replace(/_male$|_female$/, ''));
    if (!guest) {
      return;
    }

    let guestSize = guest.attendingCount || 1;
    
    if (isSeparatedSeating) {
      if (!tableInfo.isNeutral) {
        if (tableInfo.gender === 'male') {
          guestSize = guest.maleCount || 0;
        } else if (tableInfo.gender === 'female') {
          guestSize = guest.femaleCount || 0;
        }
      } else {
        if (guestIdParam.toString().includes('_male')) {
          guestSize = guest.maleCount || 0;
        } else if (guestIdParam.toString().includes('_female')) {
          guestSize = guest.femaleCount || 0;
        }
      }
    }

    if (currentOccupancy + guestSize > table.capacity) {
      setShowNotEnoughSpaceModal(true);
      return;
    }

    setPendingAddedGuests(prev => [...prev, { guestId: guestIdParam, tableId: table.id }]);
    setSearchGuestTerm('');
  };

  const handleRemoveGuest = (guestIdParam) => {
    const isGenderSpecific = guestIdParam.toString().includes('_male') || guestIdParam.toString().includes('_female');
    const guestId = isGenderSpecific ? guestIdParam.toString().replace(/_male$|_female$/, '') : guestIdParam.toString();

    let fullGuestId;
    if (isSeparatedSeating && !tableInfo.isNeutral) {
      if (tableInfo.gender === 'male') {
        fullGuestId = `${guestId}_male`;
      } else if (tableInfo.gender === 'female') {
        fullGuestId = `${guestId}_female`;
      } else {
        fullGuestId = guestId;
      }
    } else {
      fullGuestId = guestId;
    }

    const wasPendingAdded = pendingAddedGuests.some(g =>
      g.guestId.toString().replace(/_male$|_female$/, '') === guestId
    );

    if (wasPendingAdded) {
      setPendingAddedGuests(prev => prev.filter(g =>
        g.guestId.toString().replace(/_male$|_female$/, '') !== guestId
      ));
    } else {
      setPendingRemovedGuests(prev => [...prev, { guestId: fullGuestId }]);
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

  const getOccupancyFillStyle = () => {
    const width = Math.min((currentOccupancy / table.capacity) * 100, 100);
    const backgroundColor = isOvercapacity ? '#f44336' : 
                           currentOccupancy === table.capacity ? '#ff9800' : '#4caf50';
    return { width: `${width}%`, backgroundColor };
  };

  return (
    <div className="modal-overlay" onClick={() => onClose(false)}>
      <div className="modal-content table-details-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('seating.table.details')}</h3>
          <button className="modal-close" onClick={() => onClose(false)}>×</button>
        </div>

        <div className="modal-body">
          <div className="table-info-section">
            <h4>{t('seating.table.information')}</h4>
            
            <div className="form-group">
              <label>{t('seating.table.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="form-input"
                disabled={!canEdit}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('seating.table.type')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="form-select"
                  disabled={!canEdit}
                >
                  <option value="round">{t('seating.tableTypes.round')}</option>
                  <option value="rectangular">{t('seating.tableTypes.rectangular')}</option>
                  <option value="square">{t('seating.tableTypes.square')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>
                  {t('seating.table.capacity')}
                  {currentOccupancy > 0 && (
                    <span className="capacity-hint">
                      &nbsp;({t('seating.table.minCapacity')}: {minAllowedCapacity})
                    </span>
                  )}
                </label>
                <div className="capacity-input-group">
                  <button
                    type="button"
                    onClick={() => handleCapacityChange(formData.capacity - 1, true)}
                    disabled={!canEdit || formData.capacity <= minAllowedCapacity}
                    className="capacity-btn"
                    title={formData.capacity <= minAllowedCapacity ? t('seating.table.cannotReduceCapacity') : ''}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min="8"
                    max="36"
                    step="1"
                    value={formData.capacity}
                    onChange={(e) => handleCapacityChange(e.target.value, false)}
                    className="form-input capacity-input"
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    onClick={() => handleCapacityChange(formData.capacity + 1, true)}
                    disabled={!canEdit || formData.capacity >= 36}
                    className="capacity-btn"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            <div className="form-group">
              <label>{t('seating.table.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                className="form-textarea"
                rows="3"
                placeholder={t('seating.table.notesPlaceholder')}
                disabled={!canEdit}
              />
            </div>
          </div>

          <div className="occupancy-section">
            <h4>{t('seating.table.occupancy')}</h4>
            <div className={`occupancy-indicator ${isOvercapacity ? 'overcapacity' : ''}`}>
              <div className="occupancy-bar">
                <div 
                  className="occupancy-fill"
                  style={getOccupancyFillStyle()}
                />
              </div>
              <div className="occupancy-text">
                {currentOccupancy} / {table.capacity} {t('seating.table.seats')}
                {isOvercapacity && (
                  <span className="overcapacity-warning">
                    ⚠️ {t('seating.table.overcapacity')}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="seated-guests-section">
            <div className="section-header-with-action">
              <h4>{t('seating.table.seatedGuests')} ({seatedGuests.length})</h4>
              {canEdit && (
                <button
                  className="add-guests-button"
                  onClick={() => setShowAddGuests(!showAddGuests)}
                >
                  {showAddGuests ? `X ${t('seating.table.cancelAddGuests')}` : `+ ${t('seating.table.addGuests')}`}
                </button>
              )}
            </div>

            {showAddGuests && (
              <div className="add-guests-section">
                <div className="add-guests-search">
                  <input
                    type="text"
                    placeholder={t('seating.table.searchGuestPlaceholder')}
                    value={searchGuestTerm}
                    onChange={(e) => setSearchGuestTerm(e.target.value)}
                    className="guest-search-input"
                  />
                </div>
                
                {availableGuests.length > 0 ? (
                  <div className="available-guests-dropdown">
                    {filteredAvailableGuests.map(guest => {
                      let guestSize = guest.attendingCount || 1;
                      
                      if (isSeparatedSeating && table && !tableInfo.isNeutral) {
                        if (tableInfo.gender === 'male') {
                          guestSize = guest.maleCount || 0;
                        } else if (tableInfo.gender === 'female') {
                          guestSize = guest.femaleCount || 0;
                        }
                      }
                      
                      const canFit = currentOccupancy + guestSize <= table.capacity;
                      
                      return (
                        <div 
                          key={guest._id} 
                          className={`guest-dropdown-item ${!canFit ? 'cannot-fit' : ''}`}
                          onClick={() => canFit && handleAddGuest(guest._id)}
                        >
                          <div className="guest-dropdown-info">
                            <div className="guest-dropdown-name">
                              {isSeparatedSeating && guest.displayGender && (
                                <span>{guest.displayGender === 'male' ? '♂️ ' : '♀️ '}</span>
                              )}
                              {guest.firstName} {guest.lastName}
                              {guestSize > 1 && (
                                <span className="attending-count">
                                  +{guestSize - 1}
                                </span>
                              )}
                            </div>
                            <div className="guest-dropdown-details">
                              <span className="guest-group">
                                {getGroupDisplayName(guest)}
                              </span>
                              {guestSize > 1 && (
                                <span className="total-people">
                                  ({guestSize} {t('seating.guestsList.people')})
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="add-guest-indicator">
                            {canFit ? '➕' : '🚫'}
                          </span>
                        </div>
                      );
                    })}
                    
                    {filteredAvailableGuests.length === 0 && searchGuestTerm && (
                      <div className="no-guests-found">
                        {t('seating.table.noGuestsFound')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="no-available-guests">
                    {t('seating.table.noAvailableGuests')}
                  </div>
                )}
              </div>
            )}

            {seatedGuests.length > 0 ? (
              <div className="seated-guests-list">
                {seatedGuests.map(guest => {
                  let actualCount = guest.attendingCount || 1;
                  
                  if (isSeparatedSeating && table && !tableInfo.isNeutral) {
                    if (tableInfo.gender === 'male') {
                      actualCount = guest.maleCount || 0;
                    } else if (tableInfo.gender === 'female') {
                      actualCount = guest.femaleCount || 0;
                    }
                  }
                  
                  return (
                    <div key={guest._id} className="seated-guest-item">
                      <div className="guest-info">
                        <div className="guest-name">
                          {guest.firstName} {guest.lastName}
                          {actualCount > 1 && (
                            <span className="attending-count">
                              +{actualCount - 1}
                            </span>
                          )}
                        </div>
                        <div className="guest-details">
                          <span className="guest-group">
                            {getGroupDisplayName(guest)}
                          </span>
                        </div>
                      </div>
                      <button
                        className="remove-guest-button"
                        onClick={() => handleRemoveGuest(guest._id)}
                        title={t('seating.table.removeGuest')}
                        disabled={!canEdit}
                      >
                        ❌
                      </button>
                    </div>
                  );
                    
                })}
              </div>
            ) : (
              <div className="empty-table-message">
                {t('seating.table.noGuestsSeated')}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button
            className="cancel-button"
            onClick={() => onClose(false)}
          >
            {t('common.cancel')}
          </button>
          <button
            className="save-button"
            onClick={handleSave}
            disabled={!canEdit}
          >
            {t('common.save')}
          </button>
        </div>
      </div>

      {showInvalidCapacityModal && (
        <div className="modal-overlay" onClick={() => setShowInvalidCapacityModal(false)}>
          <div className={`modal-content ${isRTL ? 'rtl' : 'ltr'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('general.error')}</h3>
              <button className="modal-close" onClick={() => setShowInvalidCapacityModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>{t('seating.table.invalidCapacity')}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowInvalidCapacityModal(false)}>
                {t('general.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCapacityTooSmallModal && (
        <div className="modal-overlay" onClick={() => setShowCapacityTooSmallModal(false)}>
          <div className={`modal-content ${isRTL ? 'rtl' : 'ltr'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('general.error')}</h3>
              <button className="modal-close" onClick={() => setShowCapacityTooSmallModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>{t('seating.table.capacityTooSmall', { 
                current: capacityErrorData.current, 
                requested: capacityErrorData.requested 
              })}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowCapacityTooSmallModal(false)}>
                {t('general.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showNotEnoughSpaceModal && (
        <div className="modal-overlay" onClick={() => setShowNotEnoughSpaceModal(false)}>
          <div className={`modal-content ${isRTL ? 'rtl' : 'ltr'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('general.error')}</h3>
              <button className="modal-close" onClick={() => setShowNotEnoughSpaceModal(false)}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>{t('seating.table.notEnoughSpace')}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={() => setShowNotEnoughSpaceModal(false)}>
                {t('general.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirmModal && (
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className={`modal-content ${isRTL ? 'rtl' : 'ltr'}`} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('seating.table.confirmDelete')}</h3>
              <button className="modal-close" onClick={cancelDelete}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <p>{t('seating.table.deleteTableConfirm')}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel" onClick={cancelDelete}>
                {t('common.cancel')}
              </button>
              <button className="modal-btn delete" onClick={confirmDelete}>
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDetailsModal;