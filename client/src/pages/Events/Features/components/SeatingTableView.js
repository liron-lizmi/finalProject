import React, { useState, useMemo, useCallback } from 'react';
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
  canEdit = true,
  isSeparatedSeating = false,
  genderFilter = 'all',
  maleTables = [],
  femaleTables = [],
  maleArrangement = {},
  femaleArrangement = {}
}) => {
  const { t } = useTranslation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [showEmptyTables, setShowEmptyTables] = useState(true);
  const [selectedTableForGuest, setSelectedTableForGuest] = useState(null);
  const [selectedGuest, setSelectedGuest] = useState(null);
  const [newTableCapacity, setNewTableCapacity] = useState(12);

  const getCurrentTablesAndArrangement = useMemo(() => {

    if (!isSeparatedSeating) {
      return {
        currentTables: tables,
        currentArrangement: seatingArrangement
      };
    }

    if (genderFilter === 'male') {
      return {
        currentTables: maleTables,
        currentArrangement: maleArrangement
      };
    } else if (genderFilter === 'female') {
      return {
        currentTables: femaleTables,
        currentArrangement: femaleArrangement
      };
    } else {
      const allTables = [...tables, ...maleTables, ...femaleTables];
      const uniqueTables = allTables.filter((table, index, self) => 
        index === self.findIndex(t => t.id === table.id)
      );
            
      return {
        currentTables: uniqueTables,
        currentArrangement: { ...seatingArrangement, ...maleArrangement, ...femaleArrangement }
      };
    }
  }, [isSeparatedSeating, genderFilter, tables, seatingArrangement, maleTables, femaleTables, maleArrangement, femaleArrangement]);

  const getTableGender = useCallback((tableId) => {
    if (!isSeparatedSeating) return null;
    
    if (maleTables.some(t => t.id === tableId)) return 'male';
    if (femaleTables.some(t => t.id === tableId)) return 'female';
    if (tables.some(t => t.id === tableId)) return null;
    return null;
  }, [isSeparatedSeating, maleTables, femaleTables, tables]);

  const tablesWithDetails = useMemo(() => {
    const { currentTables, currentArrangement } = getCurrentTablesAndArrangement;

    const result = currentTables.map(table => {
      const tableGender = getTableGender(table.id);
      const tableGuests = currentArrangement[table.id] || [];
      
      const guestDetails = tableGuests.map(guestId => {
        const guest = guests.find(g => g._id === guestId);
        return guest ? {
          ...guest,
          guestId: guest._id
        } : null;
      }).filter(Boolean);

      let currentOccupancy = 0;
      
      if (isSeparatedSeating && tableGender) {
        currentOccupancy = guestDetails.reduce((sum, guest) => {
          if (tableGender === 'male') {
            return sum + (guest.maleCount || 0);
          } else if (tableGender === 'female') {
            return sum + (guest.femaleCount || 0);
          }
          return sum;
        }, 0);
      } else {
        currentOccupancy = guestDetails.reduce((sum, guest) => 
          sum + (guest.attendingCount || 1), 0
        );
      }

      const utilizationRate = table.capacity > 0 ? (currentOccupancy / table.capacity) * 100 : 0;

      return {
        ...table,
        gender: tableGender,
        guests: guestDetails,
        occupancy: currentOccupancy,
        utilizationRate,
        availableSeats: table.capacity - currentOccupancy,
        status: currentOccupancy === 0 ? 'empty' : 
                currentOccupancy === table.capacity ? 'full' :
                currentOccupancy > table.capacity ? 'overcapacity' : 'partial'
      };
    });

    return result;
  }, [getCurrentTablesAndArrangement, guests, isSeparatedSeating, getTableGender]);

  const unassignedGuests = useMemo(() => {
    if (!isSeparatedSeating) {
      const assignedGuestIds = new Set(Object.values(seatingArrangement).flat());
      return guests.filter(guest => !assignedGuestIds.has(guest._id));
    }

    const maleAssignedIds = new Set(Object.values(maleArrangement).flat());
    const femaleAssignedIds = new Set(Object.values(femaleArrangement).flat());

    return guests.filter(guest => {
      const hasMales = (guest.maleCount || 0) > 0;
      const hasFemales = (guest.femaleCount || 0) > 0;
      
      const maleNotSeated = hasMales && !maleAssignedIds.has(guest._id);
      const femaleNotSeated = hasFemales && !femaleAssignedIds.has(guest._id);

      if (genderFilter === 'male') {
        return maleNotSeated;
      } else if (genderFilter === 'female') {
        return femaleNotSeated;
      } else {
        return maleNotSeated || femaleNotSeated;
      }
    }).map(guest => {
      if (isSeparatedSeating) {
        const results = [];
        
        if ((guest.maleCount || 0) > 0 && (genderFilter === 'all' || genderFilter === 'male')) {
          const maleNotSeated = !maleAssignedIds.has(guest._id);
          if (maleNotSeated) {
            results.push({
              ...guest,
              _id: `${guest._id}_male`,
              originalId: guest._id,
              displayGender: 'male',
              gender: 'male',
              attendingCount: guest.maleCount,
              maleCount: guest.maleCount,
              femaleCount: 0
            });
          }
        }
        
        if ((guest.femaleCount || 0) > 0 && (genderFilter === 'all' || genderFilter === 'female')) {
          const femaleNotSeated = !femaleAssignedIds.has(guest._id);
          if (femaleNotSeated) {
            results.push({
              ...guest,
              _id: `${guest._id}_female`,
              originalId: guest._id,
              displayGender: 'female',
              gender: 'female',
              attendingCount: guest.femaleCount,
              maleCount: 0,
              femaleCount: guest.femaleCount
            });
          }
        }
        
        return results;
      }
      
      return [guest];
    }).flat();
  }, [guests, seatingArrangement, maleArrangement, femaleArrangement, isSeparatedSeating, genderFilter]);

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

  const handleAddTable = () => {
    if (!canEdit) return;
    
    const currentGender = isSeparatedSeating ? genderFilter : null;
    
    let position;
    
    if (isSeparatedSeating && currentGender && currentGender !== 'all') {
      const relevantTables = currentGender === 'male' ? maleTables : femaleTables;
      const tableCounter = relevantTables.length;

      position = {
        x: 300 + (tableCounter % 3) * 200,
        y: 300 + Math.floor(tableCounter / 3) * 200
      };
    } else {
      const tableCounter = tables.length;
      position = {
        x: 300 + (tableCounter % 3) * 200,
        y: 300 + Math.floor(tableCounter / 3) * 200
      };
    }
    
    const type = 'round';
    const capacity = newTableCapacity;
    const size = capacity <= 10 
      ? { width: 120, height: 120 }
      : { width: 160, height: 100 };
    
    const newTable = {
      id: `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      capacity,
      position,
      rotation: 0,
      size,
      gender: currentGender && currentGender !== 'all' ? currentGender : null
    };

    onAddTable(newTable);
  };

  const getGenderIcon = (gender) => {
    if (!isSeparatedSeating || !gender) return '';
    return gender === 'male' ? '♂️ ' : '♀️ ';
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
          <div className="add-table-group">
            <select
              value={newTableCapacity}
              onChange={(e) => setNewTableCapacity(parseInt(e.target.value))}
              className="capacity-select"
              disabled={!canEdit}
            >
              {[8, 10, 12, 14, 16, 18, 20, 22, 24].map(capacity => (
                <option key={capacity} value={capacity}>
                  {capacity} {t('seating.table.seats')}
                </option>
              ))}
            </select>
            <button 
              className="add-table-btn" 
              onClick={handleAddTable}
              disabled={!canEdit}
            >
              ➕ {t('seating.tableView.addTable')}
            </button>
          </div>
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

        <div className="tables-rows-container" style={{ maxHeight: 'none', overflow: 'visible', height: 'auto'  }}>
          {filteredTables.length > 0 ? (
            filteredTables.map(table => (
              <div key={table.id} className={`table-row ${table.status}`}>
                <div className="table-cell table-name-cell">
                  <div className="table-info">
                    <div className="table-name">
                      {getGenderIcon(table.gender)}
                      {table.name}
                    </div>
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
                      {table.guests.map((guest, index) => {
                        let guestCount = guest.attendingCount || 1;
                        
                        if (isSeparatedSeating && table.gender) {
                          if (table.gender === 'male') {
                            guestCount = guest.maleCount || 0;
                          } else if (table.gender === 'female') {
                            guestCount = guest.femaleCount || 0;
                          }
                        }

                        return (
                          <span key={guest.guestId}>
                            {guest.firstName} {guest.lastName}
                            {guestCount > 1 && (
                              <span className="attending-count-inline">
                                (+{guestCount - 1})
                              </span>
                            )}
                            {index < table.guests.length - 1 && ', '}
                          </span>
                        );
                      })}
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
            ))
          ) : (
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

    </div>
  );
};

export default SeatingTableView;