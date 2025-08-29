import React, { useState, useEffect } from 'react';
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
  onUnseatGuest
}) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: '',
    capacity: 8,
    type: 'round',
    notes: ''
  });

  const [showAddGuests, setShowAddGuests] = useState(false);
  const [selectedGuestToAdd, setSelectedGuestToAdd] = useState('');
  const [searchGuestTerm, setSearchGuestTerm] = useState('');

  const calculateTableSize = (type, capacity) => {
    const baseSize = Math.max(80, Math.min(200, 60 + (capacity * 8)));
    
    switch (type) {
      case 'round':
        return { width: baseSize, height: baseSize };
      case 'square':
        return { width: baseSize, height: baseSize };
      case 'rectangular':
        const width = Math.max(120, baseSize * 1.4);
        const height = Math.max(60, baseSize * 0.7);
        return { width, height };
      default:
        return { width: baseSize, height: baseSize };
    }
  };

  useEffect(() => {
    if (table) {
      setFormData({
        name: table.name || '',
        capacity: table.capacity || 8,
        type: table.type || 'round',
        notes: table.notes || ''
      });
    }
  }, [table]);

  if (!isOpen || !table) return null;

  const seatedGuestIds = seatingArrangement[table.id] || [];
  const seatedGuests = seatedGuestIds.map(id => guests.find(g => g._id === id)).filter(Boolean);
  const availableGuests = guests.filter(guest => 
    !Object.values(seatingArrangement).flat().includes(guest._id)
  );

  const currentOccupancy = seatedGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
  const isOvercapacity = currentOccupancy > table.capacity;

  const filteredAvailableGuests = availableGuests.filter(guest => {
    if (!searchGuestTerm) return true;
    const searchLower = searchGuestTerm.toLowerCase();
    const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
    return fullName.includes(searchLower);
  });

  const handleSave = () => {
    const capacity = parseInt(formData.capacity);
    const newSize = calculateTableSize(formData.type, capacity);
    
    onUpdateTable(table.id, {
      ...formData,
      capacity,
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

  const handleAddGuest = (guestId) => {
    const guest = guests.find(g => g._id === guestId);
    if (!guest) return;

    const guestSize = guest.attendingCount || 1;
    if (currentOccupancy + guestSize <= table.capacity) {
      onSeatGuest(guestId, table.id);
      setSelectedGuestToAdd('');
      setSearchGuestTerm('');
    }
  };

  const handleRemoveGuest = (guestId) => {
    onUnseatGuest(guestId);
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
                placeholder={t('seating.table.name')}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>{t('seating.table.type')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                  className="form-select"
                >
                  <option value="round">{t('seating.tableTypes.round')}</option>
                  <option value="rectangular">{t('seating.tableTypes.rectangular')}</option>
                  <option value="square">{t('seating.tableTypes.square')}</option>
                </select>
              </div>

              <div className="form-group">
                <label>{t('seating.table.capacity')}</label>
                <input
                  type="number"
                  min="2"
                  max="20"
                  value={formData.capacity}
                  onChange={(e) => setFormData(prev => ({ ...prev, capacity: e.target.value }))}
                  className="form-input"
                />
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
              {availableGuests.length > 0 && (
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
                    {filteredAvailableGuests.slice(0, 8).map(guest => {
                      const guestSize = guest.attendingCount || 1;
                      const canFit = currentOccupancy + guestSize <= table.capacity;
                      
                      return (
                        <div 
                          key={guest._id} 
                          className={`guest-dropdown-item ${!canFit ? 'cannot-fit' : ''}`}
                          onClick={() => canFit && handleAddGuest(guest._id)}
                        >
                          <div className="guest-dropdown-info">
                            <div className="guest-dropdown-name">
                              {guest.firstName} {guest.lastName}
                              {guest.attendingCount > 1 && (
                                <span className="attending-count">
                                  +{guest.attendingCount - 1}
                                </span>
                              )}
                            </div>
                            <div className="guest-dropdown-details">
                              <span className="guest-group">
                                {getGroupDisplayName(guest)}
                              </span>
                              {guest.attendingCount > 1 && (
                                <span className="total-people">
                                  ({guest.attendingCount} {t('seating.guestsList.people')})
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
                    
                    {filteredAvailableGuests.length > 8 && (
                      <div className="more-guests-note">
                        {t('seating.table.moreGuests', { count: filteredAvailableGuests.length - 8 })}
                      </div>
                    )}
                    
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
                {seatedGuests.map(guest => (
                  <div key={guest._id} className="seated-guest-item">
                    <div className="guest-info">
                      <div className="guest-name">
                        {guest.firstName} {guest.lastName}
                      </div>
                      <div className="guest-details">
                        <span className="guest-group">
                          {getGroupDisplayName(guest)}
                        </span>
                        {guest.attendingCount > 1 && (
                          <span className="attending-count">
                            +{guest.attendingCount - 1} ({guest.attendingCount} {t('seating.guestsList.people')})
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
                    >
                      ❌
                    </button>
                  </div>
                ))}
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