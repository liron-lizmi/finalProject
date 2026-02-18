/**
 * GuestsList.js - Draggable Guest List for Seating
 *
 * Displays guest list for drag-and-drop seating assignment.
 * Shows sync notifications and guest statuses.
 *
 * Props:
 * - guests: All guests data
 * - tables: Current tables
 * - seatingArrangement: Guest-to-table mapping
 * - onDragStart: Drag start callback
 * - onDragEnd: Drag end callback
 * - onUnseatGuest: Remove from table callback
 * - syncNotification: Sync status notification
 * - onSyncStatusChange: Sync status change handler
 * - isSeparatedSeating: Gender-separated mode
 * - genderFilter: Current gender filter (all/male/female)
 * - onGenderFilterChange: Gender filter change handler
 * - maleArrangement/femaleArrangement: Gender mappings
 * - canEdit: Whether editing allowed
 *
 * Features:
 * - Search guests by name
 * - Filter by group
 * - Filter seated/unseated
 * - Drag guests to tables
 * - Highlight sync changes
 * - Gender filter toggle
 * - Group color coding
 */
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import '../../../../styles/EventSeatingPage.css';

const GuestsList = ({
  guests,
  tables = [],
  seatingArrangement,
  onDragStart,
  onDragEnd,
  onUnseatGuest,
  syncNotification = null,
  onSyncStatusChange = null,
  isSeparatedSeating = false,
  genderFilter = 'all',
  onGenderFilterChange = null,
  maleArrangement = {},
  femaleArrangement = {},
  canEdit = true
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGroup, setFilterGroup] = useState('all');
  const [showSeatedOnly, setShowSeatedOnly] = useState(false);
  const [showUnseatedOnly, setShowUnseatedOnly] = useState(false);
  const [highlightedGuests, setHighlightedGuests] = useState(new Set());
  const [syncChanges, setSyncChanges] = useState([]);

  useEffect(() => {
    if (syncNotification && syncNotification.type === 'success') {
      setSyncChanges([]);
      setHighlightedGuests(new Set());
      
      if (syncNotification.syncResults || syncNotification.appliedActions) {
        const changes = syncNotification.syncResults || syncNotification.appliedActions || [];
        if (changes.length > 0) {
          const processedChanges = processStructuredSyncChanges(changes);
          setSyncChanges(processedChanges);
          const guestIds = new Set(processedChanges.map(change => change.guestId).filter(Boolean));
          setHighlightedGuests(guestIds);
          
          setTimeout(() => {
            setHighlightedGuests(new Set());
            setSyncChanges([]);
          }, 5000);
        }
      }
    }
  }, [syncNotification]);

  const processStructuredSyncChanges = useCallback((syncResults) => {
    const changes = [];
    
    syncResults.forEach(result => {
      if (result.actions) {
        result.actions.forEach(action => {
          const guestName = action.details?.guestName;
          if (guestName) {
            const guest = guests.find(g => 
              `${g.firstName} ${g.lastName}` === guestName
            );
            
            let actionType = 'updated';
            if (action.action === 'guest_seated') actionType = 'seated';
            else if (action.action === 'guest_removed') actionType = 'removed';
            else if (action.action === 'guest_moved') actionType = 'moved';
            
            changes.push({
              guestId: guest?._id,
              guestName,
              action: actionType
            });
          }
        });
      }
    });
    
    return changes;
  }, [guests]);

  const groups = useMemo(() => {
    const groupSet = new Set();
    guests.forEach(guest => {
      const g = guest.customGroup || guest.group;
      if (g && g !== 'all') {
        groupSet.add(g);
      }
    });
    return Array.from(groupSet).sort(); 
  }, [guests]);

  const seatedGuestIds = useMemo(() => {
    const ids = new Set();
    
    if (isSeparatedSeating) {
      Object.values(maleArrangement).forEach(guestIds => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(id => {
            ids.add(`${id}_male`);
          });
        }
      });
      
      Object.values(femaleArrangement).forEach(guestIds => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(id => {
            ids.add(`${id}_female`);
          });
        }
      });
    } else {
      Object.values(seatingArrangement).forEach(guestIds => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(id => {
            ids.add(id);
          });
        }
      });
    }
    
    return ids;
  }, [seatingArrangement, isSeparatedSeating, maleArrangement, femaleArrangement]);

  const getGuestTable = useMemo(() => {
    const guestTableMap = {};
    
    if (isSeparatedSeating) {
      Object.entries(maleArrangement || {}).forEach(([tableId, guestIds]) => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(guestId => {
            guestTableMap[`${guestId}_male`] = tableId;
          });
        }
      });
      
      Object.entries(femaleArrangement || {}).forEach(([tableId, guestIds]) => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(guestId => {
            guestTableMap[`${guestId}_female`] = tableId;
          });
        }
      });
    } else {
      Object.entries(seatingArrangement).forEach(([tableId, guestIds]) => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(guestId => {
            guestTableMap[guestId] = tableId;
          });
        }
      });
    }
    
    return guestTableMap;
  }, [seatingArrangement, isSeparatedSeating, maleArrangement, femaleArrangement]);

  const getTableName = useCallback((tableId) => {
    if (!tables || !Array.isArray(tables)) {
      return tableId;
    }
    const table = tables.find(t => t.id === tableId);
    return table ? table.name : tableId;
  }, [tables]);

  const getGuestCount = useCallback((guest) => {
    if (isSeparatedSeating) {
      if (guest.displayGender === 'male') {
        return guest.maleCount || 0;
      } else if (guest.displayGender === 'female') {
        return guest.femaleCount || 0;
      }
      
      if (genderFilter === 'male') {
        return guest.maleCount || 0;
      } else if (genderFilter === 'female') {
        return guest.femaleCount || 0;
      } else {
        return (guest.maleCount || 0) + (guest.femaleCount || 0);
      }
    }
    return guest.attendingCount || 1;
  }, [isSeparatedSeating, genderFilter]);

  const filteredGuests = useMemo(() => {
    let guestsToFilter = [];
    
    if (isSeparatedSeating) {
      guests.forEach(guest => {
        const hasMales = (guest.maleCount || 0) > 0;
        const hasFemales = (guest.femaleCount || 0) > 0;
        
        if (genderFilter === 'all') {
          if (hasMales) {
            guestsToFilter.push({
              ...guest,
              _id: `${guest._id}_male`,
              originalId: guest._id,
              displayGender: 'male',
              attendingCount: guest.maleCount,
              maleCount: guest.maleCount,
              femaleCount: 0
            });
          }
          if (hasFemales) {
            guestsToFilter.push({
              ...guest,
              _id: `${guest._id}_female`,
              originalId: guest._id,
              displayGender: 'female',
              attendingCount: guest.femaleCount,
              maleCount: 0,
              femaleCount: guest.femaleCount
            });
          }
        } else if (genderFilter === 'male' && hasMales) {
          guestsToFilter.push({
            ...guest,
            _id: `${guest._id}_male`,
            originalId: guest._id,
            displayGender: 'male',
            attendingCount: guest.maleCount,
            maleCount: guest.maleCount,
            femaleCount: 0
          });
        } else if (genderFilter === 'female' && hasFemales) {
          guestsToFilter.push({
            ...guest,
            _id: `${guest._id}_female`,
            originalId: guest._id,
            displayGender: 'female',
            attendingCount: guest.femaleCount,
            maleCount: 0,
            femaleCount: guest.femaleCount
          });
        }
      });
    } else {
      guestsToFilter = guests;
    }
    
    return guestsToFilter.filter(guest => {
      if (searchTerm) {
        const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        if (!fullName.includes(searchTerm.toLowerCase())) {
          return false;
        }
      }

      if (filterGroup !== 'all') {
        const guestGroup = guest.customGroup || guest.group;
        if (guestGroup !== filterGroup) {
          return false;
        }
      }

      const guestIdToCheck = guest.originalId || guest._id;
      const isSeated = seatedGuestIds.has(guestIdToCheck) || seatedGuestIds.has(guest._id);
      
      if (showSeatedOnly && !isSeated) return false;
      if (showUnseatedOnly && isSeated) return false;

      return true;
    });
  }, [guests, searchTerm, filterGroup, showSeatedOnly, showUnseatedOnly, seatedGuestIds, isSeparatedSeating, genderFilter]);

  const groupedGuests = useMemo(() => {
    const seated = [];
    const unseated = [];

    filteredGuests.forEach(guest => {
      const originalId = guest.originalId || guest._id.replace('_male', '').replace('_female', '');
      const isSeated = seatedGuestIds.has(originalId) || seatedGuestIds.has(guest._id);
      
      if (isSeated) {
        seated.push(guest);
      } else {
        unseated.push(guest);
      }
    });

    return { seated, unseated };
  }, [filteredGuests, seatedGuestIds]);

  const getGroupDisplayName = (guest) => {
    if (guest.customGroup) {
      return guest.customGroup;
    }
    
    if (['family', 'friends', 'work', 'other'].includes(guest.group)) {
      return t(`guests.groups.${guest.group}`);
    }
    
    return guest.group;
  };

  const getGenderIcon = useCallback((guest) => {
    if (!isSeparatedSeating || !guest.displayGender) return '';
    return guest.displayGender === 'male' ? '♂️ ' : '♀️ ';
  }, [isSeparatedSeating]);

  const getGuestSyncStatus = useCallback((guestId) => {
    const change = syncChanges.find(change => change.guestId === guestId);
    return change ? change.action : null;
  }, [syncChanges]);

  const isGuestHighlighted = useCallback((guestId) => {
    return highlightedGuests.has(guestId);
  }, [highlightedGuests]);

  const getSyncIndicator = useCallback((action) => {
    switch (action) {
      case 'seated':
        return { icon: '✅', className: 'sync-seated' };
      case 'removed':
        return { icon: '❌', className: 'sync-removed' };
      case 'moved':
        return { icon: '🔄', className: 'sync-moved' };
      case 'updated':
        return { icon: '📝', className: 'sync-updated' };
      default:
        return null;
    }
  }, []);

  const handleDragStart = useCallback((e, guest) => {
    e.dataTransfer.effectAllowed = 'move';
    
    const guestIdForDrag = guest._id;
    e.dataTransfer.setData('text/plain', guestIdForDrag);
    
    const guestWithGenderInfo = {
      ...guest,
      _id: guestIdForDrag,
      originalId: guest.originalId || guest._id.replace('_male', '').replace('_female', ''),
      gender: guest.displayGender || guest.gender,
      displayGender: guest.displayGender || guest.gender,
      attendingCount: guest.attendingCount,
      maleCount: guest.maleCount || 0,
      femaleCount: guest.femaleCount || 0
    };
    
    onDragStart(guestWithGenderInfo);
  }, [onDragStart]);

  const handleDragEnd = () => {
    onDragEnd();
  };

  const handleUnseatGuest = useCallback((guestId) => {
    onUnseatGuest(guestId);

    if (onSyncStatusChange) {
      const actualGuestId = guestId.replace('_male', '').replace('_female', '');
      onSyncStatusChange('manual_action', { guestId: actualGuestId, action: 'unseated' });
    }
  }, [onUnseatGuest, onSyncStatusChange]);

  const stats = useMemo(() => {
    if (isSeparatedSeating) {
      const maleGuestEntries = filteredGuests.filter(g => g.displayGender === 'male');
      const femaleGuestEntries = filteredGuests.filter(g => g.displayGender === 'female');
      
      const totalMaleGuests = maleGuestEntries.length;
      const totalFemaleGuests = femaleGuestEntries.length;
      const totalMalePeople = maleGuestEntries.reduce((sum, g) => sum + (g.maleCount || 0), 0);
      const totalFemalePeople = femaleGuestEntries.reduce((sum, g) => sum + (g.femaleCount || 0), 0);
      
      const seatedMale = maleGuestEntries.filter(g => {
        const idToCheck = g.originalId || g._id;
        return seatedGuestIds.has(idToCheck) || seatedGuestIds.has(g._id);
      });
      
      const seatedFemale = femaleGuestEntries.filter(g => {
        const idToCheck = g.originalId || g._id;
        return seatedGuestIds.has(idToCheck) || seatedGuestIds.has(g._id);
      });
      
      const seatedMalePeople = seatedMale.reduce((sum, g) => sum + (g.maleCount || 0), 0);
      const seatedFemalePeople = seatedFemale.reduce((sum, g) => sum + (g.femaleCount || 0), 0);
      
      if (genderFilter === 'male') {
        return {
          total: totalMaleGuests,
          totalPeople: totalMalePeople,
          seated: seatedMale.length,
          seatedPeople: seatedMalePeople,
          unseated: totalMaleGuests - seatedMale.length,
          unseatedPeople: totalMalePeople - seatedMalePeople
        };
      } else if (genderFilter === 'female') {
        return {
          total: totalFemaleGuests,
          totalPeople: totalFemalePeople,
          seated: seatedFemale.length,
          seatedPeople: seatedFemalePeople,
          unseated: totalFemaleGuests - seatedFemale.length,
          unseatedPeople: totalFemalePeople - seatedFemalePeople
        };
      } else {
        return {
          total: totalMaleGuests + totalFemaleGuests,
          totalPeople: totalMalePeople + totalFemalePeople,
          seated: seatedMale.length + seatedFemale.length,
          seatedPeople: seatedMalePeople + seatedFemalePeople,
          unseated: (totalMaleGuests - seatedMale.length) + (totalFemaleGuests - seatedFemale.length),
          unseatedPeople: (totalMalePeople - seatedMalePeople) + (totalFemalePeople - seatedFemalePeople)
        };
      }
    } else {
      const totalGuests = guests.length;
      const totalPeople = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      
      const seatedGuests = groupedGuests.seated.length;
      const seatedPeople = groupedGuests.seated.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      
      const unseatedGuests = groupedGuests.unseated.length;
      const unseatedPeople = groupedGuests.unseated.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      
      return {
        total: totalGuests,
        totalPeople,
        seated: seatedGuests,
        seatedPeople,
        unseated: unseatedGuests,
        unseatedPeople
      };
    }
  }, [guests, groupedGuests, isSeparatedSeating, genderFilter, filteredGuests, seatedGuestIds]);

  return (
    <div className="guests-list-container">
      <div className="guests-list-header">
        <h3>{t('seating.guestsList.title')}</h3>
        
        {syncNotification && (
          <div className={`sync-notification-banner ${syncNotification.type}`}>
            <div className="sync-notification-content">
              <span className="sync-notification-icon">
                {syncNotification.type === 'success' ? '🔄' : '⚠️'}
              </span>
              <span className="sync-notification-text">
                {syncNotification.type === 'success' 
                  ? t('seating.sync.guestsUpdated') 
                  : t('seating.sync.syncIssue')
                }
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="guests-list-filters">
        <div className="search-filter">
          <input
            type="text"
            placeholder={t('seating.guestsList.searchPlaceholder')}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        {isSeparatedSeating && (
          <div className="group-filter">
            <select
              value={genderFilter}
              onChange={(e) => onGenderFilterChange?.(e.target.value)}
              className="group-select"
            >
              <option value="all">{t('seating.filters.allGuests')}</option>
              <option value="male">{t('seating.filters.maleOnly')}</option>
              <option value="female">{t('seating.filters.femaleOnly')}</option>
            </select>
          </div>
        )}

        <div className="group-filter">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="group-select"
          >
            <option value="all">{t('guests.groups.all')}</option>
            {groups.map(group => (
              <option key={group} value={group}>
                {['family', 'friends', 'work', 'other'].includes(group) 
                  ? t(`guests.groups.${group}`) 
                  : group}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="guests-lists">
        {(!showSeatedOnly && groupedGuests.unseated.length > 0) && (
          <div className="guests-section unseated-section">
            <h4 className="section-title">
              ❌ {t('seating.guestsList.unassigned')} ({groupedGuests.unseated.length})
            </h4>
            <div className="guests-list">
              {groupedGuests.unseated.map(guest => {
                const syncAction = getGuestSyncStatus(guest._id);
                const syncIndicator = getSyncIndicator(syncAction);
                const isHighlighted = isGuestHighlighted(guest._id);
                const guestCount = getGuestCount(guest);
                
                return (
                  <div
                    key={guest._id}
                    className={`guest-item unseated ${isHighlighted ? 'sync-highlighted' : ''} ${syncIndicator ? syncIndicator.className : ''}`}
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e, guest)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="guest-info">
                      <div className="guest-name-row">
                        <div className="guest-name">
                          {getGenderIcon(guest)}{guest.firstName} {guest.lastName}
                          {guestCount > 1 && (
                            <span className="attending-count">
                              +{guestCount - 1}
                            </span>
                          )}
                          {syncIndicator && (
                            <span className="sync-indicator" title={t(`seating.sync.actions.${syncAction}`)}>
                              {syncIndicator.icon}
                            </span>
                          )}
                        </div>
                        <span className="guest-group">
                          {getGroupDisplayName(guest)}
                        </span>
                      </div>
                    </div>
                    <div className="drag-handle">
                      ⋮⋮
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(!showUnseatedOnly && groupedGuests.seated.length > 0) && (
          <div className="guests-section seated-section">
            <h4 className="section-title">
              ✅ {t('seating.guestsList.assigned')} ({groupedGuests.seated.length})
            </h4>
            <div className="guests-list">
              {groupedGuests.seated.map(guest => {
                const tableId = getGuestTable[guest._id];
                const syncAction = getGuestSyncStatus(guest._id);
                const syncIndicator = getSyncIndicator(syncAction);
                const isHighlighted = isGuestHighlighted(guest._id);
                const guestCount = getGuestCount(guest);
                
                return (
                  <div
                    key={guest._id}
                    className={`guest-item seated ${isHighlighted ? 'sync-highlighted' : ''} ${syncIndicator ? syncIndicator.className : ''}`}
                    draggable={canEdit}
                    onDragStart={(e) => handleDragStart(e, guest)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="guest-info">
                      <div className="guest-name-row">
                        <div className="guest-name">
                          {getGenderIcon(guest)}{guest.firstName} {guest.lastName}
                          {guestCount > 1 && (
                            <span className="attending-count">
                              +{guestCount - 1}
                            </span>
                          )}
                          {syncIndicator && (
                            <span className="sync-indicator" title={t(`seating.sync.actions.${syncAction}`)}>
                              {syncIndicator.icon}
                            </span>
                          )}
                        </div>
                        <span className="guest-group">
                          {getGroupDisplayName(guest)}
                        </span>
                      </div>
                      
                      <div className="table-assignment">
                        📍 {getTableName(tableId)}
                      </div>
                    </div>
                    <div className="guest-actions">
                      <button
                        className="unseat-button"
                        onClick={() => handleUnseatGuest(guest._id)}
                        title={t('seating.guestsList.removeFromTable')}
                      >
                        ❌
                      </button>
                      <div className="drag-handle">
                        ⋮⋮
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredGuests.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <div className="empty-message">
              {searchTerm || filterGroup !== 'all' || showSeatedOnly || showUnseatedOnly
                ? t('seating.guestsList.noGuestsMatchFilter')
                : t('seating.guestsList.noConfirmedGuests')}
            </div>
            {(searchTerm || filterGroup !== 'all' || showSeatedOnly || showUnseatedOnly) && (
              <button
                className="clear-filters-button"
                onClick={() => {
                  setSearchTerm('');
                  setFilterGroup('all');
                  setShowSeatedOnly(false);
                  setShowUnseatedOnly(false);
                }}
              >
                {t('seating.guestsList.clearFilters')}
              </button>
            )}
          </div>
        )}

        {syncChanges.length > 0 && (
          <div className="sync-changes-summary">
            <h5 className="sync-changes-title">
              {t('seating.sync.recentChanges')}
            </h5>
            <div className="sync-changes-list">
              {syncChanges.map((change, index) => (
                <div key={index} className={`sync-change-item ${change.action}`}>
                  <span className="sync-change-icon">
                    {getSyncIndicator(change.action)?.icon || '🔄'}
                  </span>
                  <span className="sync-change-text">
                    {change.guestName} - {t(`seating.sync.actions.${change.action}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GuestsList;