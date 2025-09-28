import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

const SeatingTableView = ({
  tables,
  guests,
  seatingArrangement,
  onSeatGuest,
  onUnseatGuest,
  onEditTable,
  onAddTable,
  onDeleteTable,
  canEdit = true
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showEmptyTables, setShowEmptyTables] = useState(true);
  const [selectedTableForGuest, setSelectedTableForGuest] = useState(null);
  const [selectedGuest, setSelectedGuest] = useState(null);

  const tablesWithDetails = useMemo(() => {
    return tables.map(table => {
      const tableGuests = seatingArrangement[table.id] || [];
      const guestDetails = tableGuests.map(guestId => {
        const guest = guests.find(g => g._id === guestId);
        return guest ? {
          ...guest,
          guestId: guest._id
        } : null;
      }).filter(Boolean);

      const currentOccupancy = guestDetails.reduce((sum, guest) => 
        sum + (guest.attendingCount || 1), 0
      );

      const utilizationRate = (currentOccupancy / table.capacity) * 100;

      return {
        ...table,
        guests: guestDetails,
        occupancy: currentOccupancy,
        utilizationRate,
        availableSeats: table.capacity - currentOccupancy,
        status: currentOccupancy === 0 ? 'empty' : 
                currentOccupancy === table.capacity ? 'full' :
                currentOccupancy > table.capacity ? 'overcapacity' : 'partial'
      };
    });
  }, [tables, seatingArrangement, guests]);

  const unassignedGuests = useMemo(() => {
    const assignedGuestIds = new Set(Object.values(seatingArrangement).flat());
    return guests.filter(guest => !assignedGuestIds.has(guest._id));
  }, [guests, seatingArrangement]);

  const filteredTables = useMemo(() => {
    let filtered = [...tablesWithDetails]; 

    if (searchTerm.trim()) {
      const searchLower = searchTerm.trim().toLowerCase();
      filtered = filtered.filter(table => {
        const tableNameMatch = table.name.toLowerCase().includes(searchLower);
        
        const guestNameMatch = table.guests.some(guest => {
          const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
          return fullName.includes(searchLower) || 
                 guest.firstName.toLowerCase().includes(searchLower) ||
                 guest.lastName.toLowerCase().includes(searchLower);
        });
        
        return tableNameMatch || guestNameMatch;
      });
    }

    if (!showEmptyTables) {
      filtered = filtered.filter(table => table.occupancy > 0);
    }

    filtered.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortBy) {
        case 'name':
          const getTableNumber = (name) => {
            const match = name.match(/(\d+)/);
            return match ? parseInt(match[1], 10) : 0;
          };
          valueA = getTableNumber(a.name);
          valueB = getTableNumber(b.name);
          if (valueA === valueB) {
            valueA = a.name.toLowerCase();
            valueB = b.name.toLowerCase();
          }
          break;
        case 'capacity':
          valueA = a.capacity;
          valueB = b.capacity;
          break;
        case 'occupancy':
          valueA = a.occupancy;
          valueB = b.occupancy;
          break;
        case 'utilization':
          valueA = a.utilizationRate;
          valueB = b.utilizationRate;
          break;
        default:
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
      }

      if (sortOrder === 'asc') {
        return valueA < valueB ? -1 : valueA > valueB ? 1 : 0;
      } else {
        return valueA > valueB ? -1 : valueA < valueB ? 1 : 0;
      }
    });

    return filtered;
  }, [tablesWithDetails, searchTerm, showEmptyTables, sortBy, sortOrder]);

  const getGroupDisplayName = (guest) => {
    if (guest.customGroup) {
      return guest.customGroup;
    }
    
    if (['family', 'friends', 'work', 'other'].includes(guest.group)) {
      return t(`guests.groups.${guest.group}`);
    }
    
    return guest.group;
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const getSortIcon = (field) => {
    if (sortBy !== field) return '↕️';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  const handleMoveGuest = (guestId, targetTableId) => {
    onSeatGuest(guestId, targetTableId);
    setSelectedTableForGuest(null);
    setSelectedGuest(null);
  };

  const openGuestAssignmentModal = (guest) => {
    setSelectedGuest(guest);
    setSelectedTableForGuest(true);
  };

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

  const handleAddTable = () => {
    const capacity = 8;
    const size = calculateTableSize('round', capacity);

    const newTable = {
      id: `table_${Date.now()}`,
      name: `${t('seating.tableName')} ${tables.length + 1}`,
      type: 'round',
      capacity,
      position: { x: 100, y: 100 },
      rotation: 0,
      size
    };
    
    onAddTable(newTable);
  };

  return (
    <div className="seating-table-view">
      <div className="table-view-controls">
        <div className="search-and-filters">
          <input
            type="text"
            placeholder={t('seating.tableView.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showEmptyTables}
              onChange={(e) => setShowEmptyTables(e.target.checked)}
            />
            {t('seating.tableView.showEmptyTables')}
          </label>
        </div>

        <div className="table-actions">
          <button 
            className="add-table-btn" 
            onClick={handleAddTable}
            disabled={!canEdit}
          >
            ➕ {t('seating.tableView.addTable')}
          </button>
        </div>
      </div>

      <div className="tables-grid">
        <div className="tables-header">
          <div 
            className="header-cell table-name-header"
            onClick={() => handleSort('name')}
          >
            {t('seating.tableView.tableName')} {getSortIcon('name')}
          </div>
          <div 
            className="header-cell"
            onClick={() => handleSort('capacity')}
          >
            {t('seating.tableView.capacity')} {getSortIcon('capacity')}
          </div>
          <div 
            className="header-cell"
            onClick={() => handleSort('occupancy')}
          >
            {t('seating.tableView.occupancy')} {getSortIcon('occupancy')}
          </div>
          <div 
            className="header-cell"
            onClick={() => handleSort('utilization')}
          >
            {t('seating.tableView.utilization')} {getSortIcon('utilization')}
          </div>
          <div className="header-cell guests-header">
            {t('seating.tableView.guests')}
          </div>
          <div className="header-cell actions-header">
            {t('seating.tableView.actions')}
          </div>
        </div>

        <div className="tables-rows-container">
          {filteredTables.map(table => (
            <div key={table.id} className={`table-row ${table.status}`}>
              <div className="table-cell table-name-cell">
                <div className="table-info">
                  <div className="table-name">{table.name}</div>
                  <div className="table-type">
                    {t(`seating.tableTypes.${table.type}`)}
                  </div>
                </div>
              </div>

              <div className="table-cell capacity-cell">
                <span className="capacity-number">{table.capacity}</span>
              </div>

              <div className="table-cell occupancy-cell">
                <div className="occupancy-info">
                  <span className={`occupancy-number ${table.status}`}>
                    {table.occupancy}
                  </span>
                  <span className="available-seats">
                    ({table.availableSeats} {t('seating.tableView.available')})
                  </span>
                </div>
              </div>

              <div className="table-cell utilization-cell">
                <div className="utilization-bar">
                  <div 
                    className={`utilization-fill ${table.status}`}
                    style={{ width: `${Math.min(table.utilizationRate, 100)}%` }}
                  />
                </div>
                <span className="utilization-percentage">
                  {table.utilizationRate.toFixed(0)}%
                </span>
              </div>

              <div className="table-cell guests-cell">
                {table.guests.length > 0 ? (
                  <div className="guests-compact-display">
                    {table.guests.map((guest, index) => (
                      <span key={guest.guestId}>
                        {guest.firstName} {guest.lastName}
                        {guest.attendingCount > 1 && (
                          <span className="attending-count-inline">
                            (+{guest.attendingCount - 1})
                          </span>
                        )}
                        {index < table.guests.length - 1 && ', '}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="empty-table-indicator">
                    {t('seating.tableView.emptyTable')}
                  </div>
                )}
              </div>

              <div className="table-cell actions-cell">
                <button
                  className="edit-table-btn"
                  onClick={() => onEditTable(table)}
                  title={t('seating.tableView.editTable')}
                  disabled={!canEdit}
                >
                  ✏️
                </button>
                <button
                  className="delete-table-btn"
                  onClick={() => {
                    if (window.confirm(t('seating.tableView.confirmDeleteTable'))) {
                      onDeleteTable(table.id);
                    }
                  }}
                  title={t('seating.tableView.deleteTable')}
                  disabled={!canEdit}
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}

          {filteredTables.length === 0 && (
            <div className="no-tables-message">
              {searchTerm || !showEmptyTables ? 
                t('seating.tableView.noTablesMatch') : 
                t('seating.tableView.noTables')
              }
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="clear-search-btn"
                >
                  {t('seating.tableView.clearSearch')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {unassignedGuests.length > 0 && (
        <div className="unassigned-guests-section">
          <h3>{t('seating.tableView.unassignedGuests')} ({unassignedGuests.length})</h3>
          <div className="unassigned-guests-grid">
            {unassignedGuests.map(guest => (
              <div key={guest._id} className="unassigned-guest-item">
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
                  className="assign-guest-btn"
                  onClick={() => openGuestAssignmentModal(guest)}
                >
                  📍 {t('seating.tableView.assignToTable')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedTableForGuest && selectedGuest && (
        <div className="modal-overlay" onClick={() => setSelectedTableForGuest(null)}>
          <div className="modal-content guest-assignment-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('seating.tableView.assignGuestToTable')}</h3>
              <button 
                className="modal-close" 
                onClick={() => setSelectedTableForGuest(null)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="selected-guest-info">
                <h4>{t('seating.tableView.selectedGuest')}</h4>
                <div className="guest-details">
                  <span className="guest-name">
                    {selectedGuest.firstName} {selectedGuest.lastName}
                  </span>
                  <span className="guest-group">
                    {getGroupDisplayName(selectedGuest)}
                  </span>
                  <span className="attending-count">
                    {selectedGuest.attendingCount || 1} {t('seating.guestsList.people')}
                  </span>
                </div>
              </div>

              <div className="available-tables">
                <h4>{t('seating.tableView.availableTables')}</h4>
                <div className="tables-list">
                  {tables.map(table => {
                    const currentOccupancy = (seatingArrangement[table.id] || []).reduce((sum, guestId) => {
                      const guest = guests.find(g => g._id === guestId);
                      return sum + (guest?.attendingCount || 1);
                    }, 0);
                    
                    const guestSize = selectedGuest.attendingCount || 1;
                    const canFit = currentOccupancy + guestSize <= table.capacity;
                    const availableSpace = table.capacity - currentOccupancy;

                    return (
                      <div 
                        key={table.id} 
                        className={`table-option ${!canFit ? 'cannot-fit' : ''}`}
                      >
                        <div className="table-info">
                          <div className="table-name">{table.name}</div>
                          <div className="table-capacity">
                            {currentOccupancy}/{table.capacity} - 
                            {availableSpace} {t('seating.tableView.available')}
                          </div>
                        </div>
                        <button
                          className="assign-btn"
                          disabled={!canFit || !canEdit}
                          onClick={() => handleMoveGuest(selectedGuest._id, table.id)}
                        >
                          {canFit ? t('seating.tableView.assign') : t('seating.tableView.full')}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button 
                className="cancel-button" 
                onClick={() => setSelectedTableForGuest(null)}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-view-summary">
        <div className="summary-stats">
          <div className="stat-item">
            <span className="stat-label">{t('seating.tableView.totalTables')}</span>
            <span className="stat-value">{tables.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('seating.tableView.occupiedTables')}</span>
            <span className="stat-value">{Object.keys(seatingArrangement).length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('seating.tableView.totalCapacity')}</span>
            <span className="stat-value">
              {tables.reduce((sum, table) => sum + table.capacity, 0)}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('seating.tableView.unassignedGuests')}</span>
            <span className="stat-value">{unassignedGuests.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('seating.tableView.tablesShown')}</span>
            <span className="stat-value">{filteredTables.length} {t('seating.tableView.outOf')} {tables.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SeatingTableView;