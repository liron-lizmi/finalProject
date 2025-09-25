import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const GuestsList = ({
  guests,
  tables = [],
  seatingArrangement,
  onDragStart,
  onDragEnd,
  onUnseatGuest,
  syncNotification = null,
  onSyncStatusChange = null
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
      // For simple sync notifications, create a basic structure
      setSyncChanges([]);
      setHighlightedGuests(new Set());
      
      // Only process if there's actual sync data with results
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
      if (guest.customGroup) {
        groupSet.add(guest.customGroup);
      } else if (['family', 'friends', 'work'].includes(guest.group)) {
        groupSet.add(guest.group);
      } else {
        groupSet.add(guest.group);
      }
    });
    return Array.from(groupSet);
  }, [guests]);

  const seatedGuestIds = useMemo(() => {
    return new Set(Object.values(seatingArrangement).flat());
  }, [seatingArrangement]);

  const getGuestTable = useMemo(() => {
    const guestTableMap = {};
    Object.entries(seatingArrangement).forEach(([tableId, guestIds]) => {
      guestIds.forEach(guestId => {
        guestTableMap[guestId] = tableId;
      });
    });
    return guestTableMap;
  }, [seatingArrangement]);

  const getTableName = useCallback((tableId) => {
    if (!tables || !Array.isArray(tables)) {
      return tableId;
    }
    const table = tables.find(t => t.id === tableId);
    return table ? table.name : tableId;
  }, [tables]);

  const filteredGuests = useMemo(() => {
    return guests.filter(guest => {
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const fullName = `${guest.firstName} ${guest.lastName}`.toLowerCase();
        if (!fullName.includes(searchLower)) {
          return false;
        }
      }

      if (filterGroup !== 'all') {
        const guestGroup = guest.customGroup || guest.group;
        if (guestGroup !== filterGroup) {
          return false;
        }
      }

      const isSeated = seatedGuestIds.has(guest._id);
      if (showSeatedOnly && !isSeated) {
        return false;
      }
      if (showUnseatedOnly && isSeated) {
        return false;
      }

      return true;
    });
  }, [guests, searchTerm, filterGroup, showSeatedOnly, showUnseatedOnly, seatedGuestIds]);

  const groupedGuests = useMemo(() => {
    const seated = [];
    const unseated = [];

    filteredGuests.forEach(guest => {
      if (seatedGuestIds.has(guest._id)) {
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

  const handleDragStart = (e, guest) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', guest._id);
    onDragStart(guest);
  };

  const handleDragEnd = () => {
    onDragEnd();
  };

  const handleUnseatGuest = useCallback((guestId) => {
    onUnseatGuest(guestId);
    
    if (onSyncStatusChange) {
      onSyncStatusChange('manual_action', { guestId, action: 'unseated' });
    }
  }, [onUnseatGuest, onSyncStatusChange]);

  const stats = {
    total: guests.length,
    totalPeople: guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
    seated: groupedGuests.seated.length,
    seatedPeople: groupedGuests.seated.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
    unseated: groupedGuests.unseated.length,
    unseatedPeople: groupedGuests.unseated.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0)
  };

  return (
    <div className="guests-list-container">
      <div className="guests-list-header">
        <h3>{t('seating.guestsList.title')}</h3>
        <div className="guests-stats-summary">
          <span className="stat">
            {t('seating.guestsList.totalGuests')}: {stats.total} ({stats.totalPeople})
          </span>
          <span className="stat seated">
            {t('seating.guestsList.seated')}: {stats.seated} ({stats.seatedPeople})
          </span>
          <span className="stat unseated">
            {t('seating.guestsList.unseated')}: {stats.unseated} ({stats.unseatedPeople})
          </span>
        </div>
        
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

        <div className="group-filter">
          <select
            value={filterGroup}
            onChange={(e) => setFilterGroup(e.target.value)}
            className="group-select"
          >
            <option value="all">{t('guests.groups.all')}</option>
            <option value="family">{t('guests.groups.family')}</option>
            <option value="friends">{t('guests.groups.friends')}</option>
            <option value="work">{t('guests.groups.work')}</option>
            <option value="other">{t('guests.groups.other')}</option>
            {groups.filter(group => !['family', 'friends', 'work', 'other'].includes(group)).map(group => (
              <option key={group} value={group}>{group}</option>
            ))}
          </select>
        </div>

        <div className="status-filters">
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={showSeatedOnly}
              onChange={(e) => {
                setShowSeatedOnly(e.target.checked);
                if (e.target.checked) setShowUnseatedOnly(false);
              }}
            />
            <span className="filter-text">{t('seating.guestsList.filters.seatedOnly')}</span>
          </label>
          
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={showUnseatedOnly}
              onChange={(e) => {
                setShowUnseatedOnly(e.target.checked);
                if (e.target.checked) setShowSeatedOnly(false);
              }}
            />
            <span className="filter-text">{t('seating.guestsList.filters.unseatedOnly')}</span>
          </label>
        </div>
      </div>

      <div className="guests-lists">
        {(!showSeatedOnly && groupedGuests.unseated.length > 0) && (
          <div className="guests-section unseated-section">
            <h4 className="section-title">
              🔄 {t('seating.guestsList.unassigned')} ({groupedGuests.unseated.length})
            </h4>
            <div className="guests-list">
              {groupedGuests.unseated.map(guest => {
                const syncAction = getGuestSyncStatus(guest._id);
                const syncIndicator = getSyncIndicator(syncAction);
                const isHighlighted = isGuestHighlighted(guest._id);
                
                return (
                  <div
                    key={guest._id}
                    className={`guest-item unseated ${isHighlighted ? 'sync-highlighted' : ''} ${syncIndicator ? syncIndicator.className : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, guest)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="guest-info">
                      <div className="guest-name">
                        {guest.firstName} {guest.lastName}
                        {guest.attendingCount > 1 && (
                          <span className="attending-count">
                            +{guest.attendingCount - 1}
                          </span>
                        )}
                        {syncIndicator && (
                          <span className="sync-indicator" title={t(`seating.sync.actions.${syncAction}`)}>
                            {syncIndicator.icon}
                          </span>
                        )}
                      </div>
                      <div className="guest-details">
                        <span className="guest-group">
                          {getGroupDisplayName(guest)}
                        </span>
                        {guest.attendingCount > 1 && (
                          <span className="total-people">
                            ({guest.attendingCount} {t('seating.guestsList.people')})
                          </span>
                        )}
                      </div>
                      {guest.guestNotes && (
                        <div className="guest-notes">
                          💬 {guest.guestNotes}
                        </div>
                      )}
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
                
                return (
                  <div
                    key={guest._id}
                    className={`guest-item seated ${isHighlighted ? 'sync-highlighted' : ''} ${syncIndicator ? syncIndicator.className : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, guest)}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="guest-info">
                      <div className="guest-name">
                        {guest.firstName} {guest.lastName}
                        {guest.attendingCount > 1 && (
                          <span className="attending-count">
                            +{guest.attendingCount - 1}
                          </span>
                        )}
                        {syncIndicator && (
                          <span className="sync-indicator" title={t(`seating.sync.actions.${syncAction}`)}>
                            {syncIndicator.icon}
                          </span>
                        )}
                      </div>
                      <div className="guest-details">
                        <span className="guest-group">
                          {getGroupDisplayName(guest)}
                        </span>
                        <span className="table-assignment">
                          📍 {getTableName(tableId)}
                        </span>
                        {guest.attendingCount > 1 && (
                          <span className="total-people">
                            ({guest.attendingCount} {t('seating.guestsList.people')})
                          </span>
                        )}
                      </div>
                      {guest.guestNotes && (
                        <div className="guest-notes">
                          💬 {guest.guestNotes}
                        </div>
                      )}
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