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
  const { t } = useTranslation();
  
  const [formData, setFormData] = useState({
    name: '',
    capacity: 12,
    type: 'round',
    notes: ''
  });

  const [showAddGuests, setShowAddGuests] = useState(false);
  const [searchGuestTerm, setSearchGuestTerm] = useState('');

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
    
    if (isSeparatedSeating) {
      const guestsWithGender = [];
      
      guests.forEach(guest => {
        const hasMales = (guest.maleCount || 0) > 0;
        const hasFemales = (guest.femaleCount || 0) > 0;
        
        if (hasMales) {
          const maleAssigned = Object.values(maleArrangement || {}).flat().includes(guest._id.toString());
          if (!maleAssigned) {
            if (!table || tableInfo.isNeutral || tableInfo.gender === 'male') {
              guestsWithGender.push({
                ...guest,
                _id: `${guest._id}_male`,
                originalId: guest._id,
                displayGender: 'male',
                attendingCount: guest.maleCount
              });
            }
          }
        }
        
        if (hasFemales) {
          const femaleAssigned = Object.values(femaleArrangement || {}).flat().includes(guest._id.toString());
          if (!femaleAssigned) {
            if (!table || tableInfo.isNeutral || tableInfo.gender === 'female') {
              guestsWithGender.push({
                ...guest,
                _id: `${guest._id}_female`,
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
    
    return guests.filter(guest => 
      !assignedGuestIds.includes(guest._id.toString())
    );
  }, [guests, seatingArrangement, maleArrangement, femaleArrangement, isSeparatedSeating, table, tableInfo]);

  const seatedGuestIds = useMemo(() => {
    if (!table) return [];
    
    if (isSeparatedSeating && !tableInfo.isNeutral) {
      if (tableInfo.gender === 'male' && maleArrangement) {
        return maleArrangement[table.id] || [];
      } else if (tableInfo.gender === 'female' && femaleArrangement) {
        return femaleArrangement[table.id] || [];
      }
    }
    
    if (!seatingArrangement) return [];
    return seatingArrangement[table.id] || [];
  }, [table, seatingArrangement, isSeparatedSeating, tableInfo, maleArrangement, femaleArrangement]);

  const seatedGuests = useMemo(() => {
    if (!guests || !seatedGuestIds) return [];
    return seatedGuestIds
      .map(id => guests.find(g => g._id.toString() === id.toString().replace(/_male$|_female$/, '')))
      .filter(Boolean);
  }, [seatedGuestIds, guests]);

  const currentOccupancy = useMemo(() => {
    return seatedGuests.reduce((sum, guest) => {
      if (isSeparatedSeating && table && !tableInfo.isNeutral) {
        if (tableInfo.gender === 'male') {
          return sum + (guest.maleCount || 0);
        } else if (tableInfo.gender === 'female') {
          return sum + (guest.femaleCount || 0);
        }
      }
      
      return sum + (guest.attendingCount || 1);
    }, 0);
  }, [seatedGuests, isSeparatedSeating, table, tableInfo]);

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
    }
  }, [table]);

  if (!isOpen || !table) return null;

  const calculateTableSize = (type, capacity) => {
    const baseSize = Math.max(80, Math.min(250, 60 + (capacity * 6)));
    
    switch (type) {
      case 'round':
        return { width: baseSize, height: baseSize };
      case 'square':
        return { width: baseSize, height: baseSize };
      case 'rectangular':
        const width = Math.max(140, baseSize * 1.5);
        const height = Math.max(70, baseSize * 0.8);
        return { width, height };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  const handleSave = () => {
    const capacity = parseInt(formData.capacity, 10);
    
    if (isNaN(capacity) || capacity < 8 || capacity > 24) {
      alert(t('seating.table.invalidCapacity'));
      return;
    }

    if (capacity < currentOccupancy) {
      alert(t('seating.table.capacityTooSmall', { 
        current: currentOccupancy, 
        requested: capacity 
      }));
      return;
    }
    
    const newSize = calculateTableSize(formData.type, capacity);
    
    onUpdateTable(table.id, {
      name: formData.name,
      capacity: capacity,
      type: formData.type,
      notes: formData.notes,
      size: newSize
    });
    
    onClose();
  };

  const handleDelete = () => {
    if (window.confirm(t('seating.table.confirmDelete'))) {
      onDeleteTable(table.id);
      onClose();
    }
  };

  const handleCapacityChange = (newCapacity) => {
    const capacity = parseInt(newCapacity, 10);
    if (!isNaN(capacity) && capacity >= minAllowedCapacity && capacity <= 24) {
      setFormData(prev => ({ ...prev, capacity }));
    }
  };

  const handleAddGuest = (guestIdParam) => {
    const guest = guests.find(g => g._id === guestIdParam || g._id.toString() === guestIdParam.toString().replace(/_male$|_female$/, ''));
    if (!guest) return;

    let guestSize = guest.attendingCount || 1;
    
    if (isSeparatedSeating && !tableInfo.isNeutral) {
      if (tableInfo.gender === 'male') {
        guestSize = guest.maleCount || 0;
      } else if (tableInfo.gender === 'female') {
        guestSize = guest.femaleCount || 0;
      }
    }

    if (currentOccupancy + guestSize > table.capacity) {
      alert(t('seating.table.notEnoughSpace'));
      return;
    }

    onSeatGuest(guestIdParam, table.id);
    setShowAddGuests(false);
    setSearchGuestTerm('');
  };

  const handleRemoveGuest = (guestIdParam) => {
    const isGenderSpecific = guestIdParam.toString().includes('_male') || guestIdParam.toString().includes('_female');
    const guestId = isGenderSpecific ? guestIdParam.toString().replace(/_male$|_female$/, '') : guestIdParam.toString();
    
    if (isSeparatedSeating && !tableInfo.isNeutral) {
      if (tableInfo.gender === 'male') {
        onUnseatGuest(`${guestId}_male`);
      } else if (tableInfo.gender === 'female') {
        onUnseatGuest(`${guestId}_female`);
      }
    } else {
      onUnseatGuest(guestId);
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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content table-details-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          {/* 🔧 הסרת התגיות */}
          <h3>{t('seating.table.details')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
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
                      ({t('seating.table.minCapacity')}: {minAllowedCapacity})
                    </span>
                  )}
                </label>
                <div className="capacity-input-group">
                  <button
                    type="button"
                    onClick={() => handleCapacityChange(formData.capacity - 1)}
                    disabled={!canEdit || formData.capacity <= minAllowedCapacity}
                    className="capacity-btn"
                    title={formData.capacity <= minAllowedCapacity ? t('seating.table.cannotReduceCapacity') : ''}
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={minAllowedCapacity}
                    max="24"
                    step="1"
                    value={formData.capacity}
                    onChange={(e) => handleCapacityChange(e.target.value)}
                    className="form-input capacity-input"
                    disabled={!canEdit}
                  />
                  <button
                    type="button"
                    onClick={() => handleCapacityChange(formData.capacity + 1)}
                    disabled={!canEdit || formData.capacity >= 24}
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
                  {showAddGuests ? `✖️ ${t('seating.table.cancelAddGuests')}` : `➕ ${t('seating.table.addGuests')}`}
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
                        </div>
                        <div className="guest-details">
                          <span className="guest-group">
                            {getGroupDisplayName(guest)}
                          </span>
                          {actualCount > 1 && (
                            <span className="attending-count">
                              +{actualCount - 1} ({actualCount} {t('seating.guestsList.people')})
                            </span>
                          )}
                        </div>
                        {guest.guestNotes && (
                          <div className="guest-notes">
                            💬 {guest.guestNotes}
                          </div>
                        )}
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

          <div className="table-statistics-section">
            <h4>{t('seating.table.statistics')}</h4>
            <div className="table-stats-grid">
              <div className="stat-item">
                <span className="stat-label">{t('seating.table.utilization')}</span>
                <span className="stat-value">
                  {((currentOccupancy / table.capacity) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('seating.table.availableSeats')}</span>
                <span className="stat-value">
                  {Math.max(0, table.capacity - currentOccupancy)}
                </span>
              </div>
              <div className="stat-item">
                <span className="stat-label">{t('seating.table.efficiency')}</span>
                <span className="stat-value">
                  {currentOccupancy === 0 ? '0%' : 
                   isOvercapacity ? t('seating.table.overbooked') :
                   currentOccupancy === table.capacity ? t('seating.table.full') :
                   t('seating.table.partiallyFilled')}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            <button
              className="delete-button"
              onClick={handleDelete}
              disabled={!canEdit}
            >
              🗑️ {t('seating.table.deleteTable')}
            </button>
          </div>
          <div className="footer-right">
            <button
              className="cancel-button"
              onClick={onClose}
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
      </div>
    </div>
  );
};

export default TableDetailsModal;