import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from './FeaturePageTemplate';
import SeatingCanvas from './components/SeatingCanvas';
import GuestsList from './components/GuestsList';
import TableDetailsModal from './components/TableDetailsModal';
import AISeatingModal from '../../components/AISeatingModal';
import SeatingTableView from './components/SeatingTableView';
import SyncOptionsModal from './components/SyncOptionsModal';
import '../../../styles/EventSeatingPage.css';

const EventSeatingPage = () => {
  const { t } = useTranslation();
  const { id: eventId } = useParams();
  const navigate = useNavigate();
  
  const [guests, setGuests] = useState([]);
  const [confirmedGuests, setConfirmedGuests] = useState([]);
  const [tables, setTables] = useState([]);
  const [manuallyEditedTableNames, setManuallyEditedTableNames] = useState(new Set());
  const [selectedTable, setSelectedTable] = useState(null);
  const [seatingArrangement, setSeatingArrangement] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('manual');
  const [viewMode, setViewMode] = useState('visual');
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [preferences, setPreferences] = useState({
    groupTogether: [],
    keepSeparate: [],
    specialRequests: []
  });
  const [draggedGuest, setDraggedGuest] = useState(null);
  const [editingTable, setEditingTable] = useState(null);
  
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [tableType, setTableType] = useState('round');
  
  const [lastSyncData, setLastSyncData] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [syncNotification, setSyncNotification] = useState(null);

  const [syncOptions, setSyncOptions] = useState([]);
  const [affectedGuests, setAffectedGuests] = useState([]);
  const [pendingSyncTriggers, setPendingSyncTriggers] = useState([]);
  const [isSyncOptionsModalOpen, setIsSyncOptionsModalOpen] = useState(false);
  
  const canvasRef = useRef(null);
  const syncTimeoutRef = useRef(null);

  const getAuthToken = useCallback(() => {
    let token = localStorage.getItem('token');
    if (token) return token;
    token = sessionStorage.getItem('token');
    if (token) return token;
    const urlParams = new URLSearchParams(window.location.search);
    token = urlParams.get('token');
    if (token) {
      localStorage.setItem('token', token);
      return token;
    }
    return null;
  }, []);

  const handleAuthError = useCallback(() => {
    localStorage.removeItem('token');
    sessionStorage.removeItem('token');
    setError(t('errors.authError'));
    setTimeout(() => {
      navigate('/login');
    }, 2000);
  }, [navigate, t]);

  const makeApiRequest = useCallback(async (url, options = {}) => {
    const token = getAuthToken();
    if (!token) {
      handleAuthError();
      return null;
    }

    const defaultOptions = {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const mergedOptions = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      const response = await fetch(url, mergedOptions);
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      return response;
    } catch (err) {
      throw err;
    }
  }, [getAuthToken, handleAuthError]);

  const showSyncNotification = useCallback((type, message) => {
    setSyncNotification({ type, message });
    setTimeout(() => setSyncNotification(null), 4000);
  }, []);

  const getNextTableNumber = useCallback(() => {
    if (tables.length === 0) return 1;
    
    const tableNumbers = tables.map(table => {
      const match = table.name.match(/(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    
    return Math.max(...tableNumbers) + 1;
  }, [tables]);

  const isTableNameManuallyEdited = useCallback((tableId, currentName) => {
    if (manuallyEditedTableNames.has(tableId)) {
      return true;
    }
    
    const basicPattern = new RegExp(`^${t('seating.tableName')} \\d+$`);
    const groupPattern = new RegExp(`^${t('seating.tableName')} \\d+ - .+$`);
    
    return !basicPattern.test(currentName) && !groupPattern.test(currentName);
  }, [manuallyEditedTableNames, t]);

  const generateTableNameWithGroup = useCallback((tableNumber, tableId, arrangement) => {
    const baseName = `${t('seating.tableName')} ${tableNumber}`;
    
    if (!arrangement || !arrangement[tableId] || arrangement[tableId].length === 0) {
      return baseName;
    }
    
    const seatedGuestIds = arrangement[tableId] || [];
    const tableGuests = seatedGuestIds.map(guestId => 
      confirmedGuests.find(g => g._id === guestId)
    ).filter(Boolean);
    
    if (tableGuests.length === 0) {
      return baseName;
    }
    
    const groupCounts = {};
    tableGuests.forEach(guest => {
      const group = guest.customGroup || guest.group || 'other';
      const guestCount = guest.attendingCount || 1;
      groupCounts[group] = (groupCounts[group] || 0) + guestCount;
    });
    
    const dominantGroup = Object.keys(groupCounts).reduce((a, b) => 
      groupCounts[a] > groupCounts[b] ? a : b
    );
    
    const groupName = ['family', 'friends', 'work', 'other'].includes(dominantGroup) 
      ? t(`guests.groups.${dominantGroup}`) 
      : dominantGroup;
    
    return `${baseName} - ${groupName}`;
  }, [confirmedGuests, t]);

  const updateTableNamesWithGroups = useCallback((currentTables, arrangement) => {
    return currentTables.map(table => {
      if (isTableNameManuallyEdited(table.id, table.name)) {
        return table;
      }
      
      const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
      return {
        ...table,
        name: generateTableNameWithGroup(tableNumber, table.id, arrangement)
      };
    });
  }, [generateTableNameWithGroup, isTableNameManuallyEdited]);

  const fetchConfirmedGuests = useCallback(async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests`);
      if (!response) {
        return;
      }

      if (response.ok) {
        const allGuests = await response.json();
        const confirmed = allGuests.filter(guest => guest.rsvpStatus === 'confirmed');
        
        setGuests(allGuests);
        setConfirmedGuests(confirmed);
        setError('');
        return { allGuests, confirmed };
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.fetchGuests'));
        return null;
      }
    } catch (err) {
      setError(t('errors.networkError'));
      return null;
    }
  }, [eventId, makeApiRequest, t]);

  const createGuestFingerprint = useCallback((guestsList) => {
    return guestsList.map(guest => ({
      id: guest._id,
      status: guest.rsvpStatus,
      attendingCount: guest.attendingCount || 1,
      firstName: guest.firstName,
      lastName: guest.lastName,
      group: guest.customGroup || guest.group
    }));
  }, []);

  const detectGuestChanges = useCallback((newGuests, oldGuests) => {
    if (!oldGuests || oldGuests.length === 0) {
      return { hasChanges: false, changes: [] };
    }

    const changes = [];
    const oldGuestsMap = new Map(oldGuests.map(g => [g.id, g]));
    const newGuestsMap = new Map(newGuests.map(g => [g.id, g]));

    newGuests.forEach(newGuest => {
      const oldGuest = oldGuestsMap.get(newGuest.id);
      if (!oldGuest) {
        if (newGuest.status === 'confirmed') {
          changes.push({
            type: 'new_confirmed',
            guestId: newGuest.id,
            guest: newGuest
          });
        }
      } else {
        if (oldGuest.status !== newGuest.status) {
          if (newGuest.status === 'confirmed' && oldGuest.status !== 'confirmed') {
            changes.push({
              type: 'became_confirmed',
              guestId: newGuest.id,
              guest: newGuest,
              previousStatus: oldGuest.status
            });
          } else if (oldGuest.status === 'confirmed' && newGuest.status !== 'confirmed') {
            changes.push({
              type: 'no_longer_confirmed',
              guestId: newGuest.id,
              guest: newGuest,
              previousStatus: oldGuest.status
            });
          }
        }

        if (newGuest.status === 'confirmed' && oldGuest.status === 'confirmed') {
          const oldCount = oldGuest.attendingCount || 1;
          const newCount = newGuest.attendingCount || 1;
          
          if (oldCount !== newCount) {
            changes.push({
              type: 'attending_count_changed',
              guestId: newGuest.id,
              guest: newGuest,
              oldCount,
              newCount
            });
          }
        }
      }
    });

    oldGuests.forEach(oldGuest => {
      if (!newGuestsMap.has(oldGuest.id) && oldGuest.status === 'confirmed') {
        changes.push({
          type: 'guest_removed',
          guestId: oldGuest.id,
          guest: oldGuest
        });
      }
    });

    return { hasChanges: changes.length > 0, changes };
  }, []);

  const checkAndHandlePendingSync = useCallback(async (skipFingerprintUpdate = false) => {
    if (!autoSyncEnabled) {
      return;
    }

    try {
      const syncResponse = await makeApiRequest(`/api/events/${eventId}/seating/sync/status`);
      if (syncResponse && syncResponse.ok) {
        const syncStatus = await syncResponse.json();
        
        if (syncStatus.syncRequired && syncStatus.pendingTriggers > 0) {
          
          const processResponse = await makeApiRequest(`/api/events/${eventId}/seating/sync/process`, {
            method: 'POST'
          });
          
          if (processResponse && processResponse.ok) {
            const processResult = await processResponse.json();
            
            if (processResult.requiresUserDecision) {
              setSyncOptions(processResult.options || []);
              setAffectedGuests(processResult.affectedGuests || []);
              setPendingSyncTriggers(processResult.pendingTriggers || []);
              setIsSyncOptionsModalOpen(true);
              
              showSyncNotification('info', t('seating.sync.pendingChangesDetected'));
            } else if (processResult.hasChanges && processResult.seating) {
              setTables(processResult.seating.tables || []);
              setSeatingArrangement(processResult.seating.arrangement || {});
              
              if (!skipFingerprintUpdate) {
                const currentGuestData = await fetchConfirmedGuests();
                if (currentGuestData) {
                  const newFingerprint = createGuestFingerprint(currentGuestData.confirmed);
                  setLastSyncData(newFingerprint);
                }
              }
              
              showSyncNotification('success', processResult.message);
            }
          }
        }
      }
    } catch (error) {
    }
  }, [autoSyncEnabled, makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint]);

  const fetchSeatingArrangement = useCallback(async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/seating`);
      if (!response) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
        
        const tablesData = data.tables || [];
        const arrangementData = data.arrangement || {};
        
        const cleanedTables = tablesData.filter(table => {
          const hasGuests = arrangementData[table.id] && arrangementData[table.id].length > 0;
          const isManualTable = !table.autoCreated && !table.createdForSync;
          
          if (!hasGuests && (table.autoCreated || table.createdForSync)) {
            delete arrangementData[table.id];
            return false;
          }
          return true;
        });
        
        const cleanedArrangement = {};
        Object.keys(arrangementData).forEach(tableId => {
          const tableExists = cleanedTables.some(t => t.id === tableId);
          if (tableExists) {
            cleanedArrangement[tableId] = arrangementData[tableId];
          }
        });
        
        const preferencesData = data.preferences || {
          groupTogether: [],
          keepSeparate: [],
          specialRequests: []
        };
        
        setTables(cleanedTables);
        setSeatingArrangement(cleanedArrangement);
        setPreferences(preferencesData);
        
        if (data.layoutSettings) {
          setCanvasScale(data.layoutSettings.canvasScale || 1);
          setCanvasOffset(data.layoutSettings.canvasOffset || { x: 0, y: 0 });
        }
        
        const hasExistingArrangement = cleanedTables.length > 0 || Object.keys(cleanedArrangement).length > 0;
        
        if (hasExistingArrangement) {
          await checkAndHandlePendingSync(true);
        }
        
        return data;
      } else if (response.status === 404) {
        setTables([]);
        setSeatingArrangement({});
        setPreferences({
          groupTogether: [],
          keepSeparate: [],
          specialRequests: []
        });
        return { tables: [], arrangement: {} };
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.fetchArrangement'));
        return null;
      }
    } catch (err) {
      setError(t('errors.networkError'));
      return null;
    } finally {
      setLoading(false);
    }
  }, [eventId, makeApiRequest, t, checkAndHandlePendingSync]);

  const saveSeatingArrangement = useCallback(async (immediateData = null) => {
    try {
      const dataToSave = immediateData || {
        tables,
        arrangement: seatingArrangement,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      };

      const response = await makeApiRequest(`/api/events/${eventId}/seating`, {
        method: 'POST',
        body: JSON.stringify(dataToSave)
      });

      if (!response) {
        return false;
      }

      if (response.ok) {
        setError('');
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.saveArrangement'));
        return false;
      }
    } catch (err) {
      setError(t('errors.networkError'));
      return false;
    }
  }, [eventId, makeApiRequest, tables, seatingArrangement, preferences, canvasScale, canvasOffset, t]);

  const autoSave = useCallback(
    (() => {
      let timeoutId;
      return (data = null) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          saveSeatingArrangement(data);
        }, 3000); 
      };
    })(),
    [saveSeatingArrangement]
  );

  const findAvailableTable = useCallback((guestSize, currentTables, currentArrangement, excludeTableIds = []) => {
    return currentTables.find(table => {
      if (excludeTableIds.includes(table.id)) return false;
      
      const tableGuests = currentArrangement[table.id] || [];
      const currentOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = confirmedGuests.find(g => g._id === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);
      
      return (table.capacity - currentOccupancy) >= guestSize;
    });
  }, [confirmedGuests]);

  const createNewTable = useCallback((capacity, tableNumber) => {
    return {
      id: `auto_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: `${t('seating.tableName')} ${tableNumber}`,
      type: capacity <= 8 ? 'round' : 'rectangular',
      capacity: capacity,
      position: {
        x: 300 + ((tableNumber - 1) % 3) * 200,
        y: 300 + Math.floor((tableNumber - 1) / 3) * 200
      },
      rotation: 0,
      size: capacity <= 8 ? 
        { width: 120, height: 120 } : 
        { width: 160, height: 100 }
    };
  }, [t]);

  const optimizeTableArrangement = useCallback((currentTables, currentArrangement, confirmedGuestsList) => {
    const optimizedTables = [...currentTables];
    const optimizedArrangement = { ...currentArrangement };
    let tablesRemoved = false;

    currentTables.forEach(table => {
      const tableGuests = optimizedArrangement[table.id] || [];
      const tableOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = confirmedGuestsList.find(g => g._id === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);

      if (tableOccupancy === 0) {
        const tableIndex = optimizedTables.findIndex(t => t.id === table.id);
        if (tableIndex !== -1) {
          optimizedTables.splice(tableIndex, 1);
          delete optimizedArrangement[table.id];
          tablesRemoved = true;
        }
      }
      else if (tableOccupancy <= table.capacity / 3 && optimizedTables.length > 1) {
        const availableTable = findAvailableTable(
          tableOccupancy, 
          optimizedTables, 
          optimizedArrangement, 
          [table.id]
        );
        
        if (availableTable) {
          if (!optimizedArrangement[availableTable.id]) {
            optimizedArrangement[availableTable.id] = [];
          }
          optimizedArrangement[availableTable.id].push(...tableGuests);
          
          const tableIndex = optimizedTables.findIndex(t => t.id === table.id);
          if (tableIndex !== -1) {
            optimizedTables.splice(tableIndex, 1);
            delete optimizedArrangement[table.id];
            tablesRemoved = true;
          }
        }
      }
    });

    return { 
      tables: optimizedTables, 
      arrangement: optimizedArrangement, 
      wasOptimized: tablesRemoved 
    };
  }, [findAvailableTable]);

  const applySyncChanges = useCallback(async (changes, currentTables, currentArrangement, confirmedGuestsList) => {
    let updatedTables = [...currentTables];
    let updatedArrangement = { ...currentArrangement };
    let syncActions = [];

    for (const change of changes) {
      switch (change.type) {
        case 'new_confirmed':
        case 'became_confirmed':
          const guestSize = change.guest.attendingCount;
          let availableTable = findAvailableTable(guestSize, updatedTables, updatedArrangement);
          
          if (!availableTable) {
            const newTableNumber = updatedTables.length + 1;
            const optimalCapacity = Math.max(8, Math.ceil(guestSize * 1.5));
            const newTable = createNewTable(optimalCapacity, newTableNumber);
            updatedTables.push(newTable);
            availableTable = newTable;
            syncActions.push({
              action: 'table_created',
              tableName: newTable.name,
              capacity: newTable.capacity
            });
          }
          
          if (!updatedArrangement[availableTable.id]) {
            updatedArrangement[availableTable.id] = [];
          }
          updatedArrangement[availableTable.id].push(change.guestId);
          
          syncActions.push({
            action: 'guest_seated',
            guestName: `${change.guest.firstName} ${change.guest.lastName}`,
            tableName: availableTable.name,
            attendingCount: guestSize
          });
          break;

        case 'no_longer_confirmed':
        case 'guest_removed':
          Object.keys(updatedArrangement).forEach(tableId => {
            const guestIndex = updatedArrangement[tableId].indexOf(change.guestId);
            if (guestIndex !== -1) {
              updatedArrangement[tableId].splice(guestIndex, 1);
              if (updatedArrangement[tableId].length === 0) {
                delete updatedArrangement[tableId];
              }
              
              const table = updatedTables.find(t => t.id === tableId);
              syncActions.push({
                action: 'guest_removed',
                guestName: `${change.guest.firstName} ${change.guest.lastName}`,
                tableName: table?.name || t('seating.unknownTable')
              });
            }
          });
          break;

        case 'attending_count_changed':
          let guestTableId = null;
          Object.keys(updatedArrangement).forEach(tableId => {
            if (updatedArrangement[tableId].includes(change.guestId)) {
              guestTableId = tableId;
            }
          });

          if (guestTableId) {
            const currentTable = updatedTables.find(t => t.id === guestTableId);
            const tableGuests = updatedArrangement[guestTableId] || [];
            const otherGuestsSize = tableGuests
              .filter(id => id !== change.guestId)
              .reduce((sum, guestId) => {
                const guest = confirmedGuestsList.find(g => g._id === guestId);
                return sum + (guest?.attendingCount || 1);
              }, 0);
            
            const newTotalSize = otherGuestsSize + change.newCount;
            
            if (newTotalSize <= currentTable.capacity) {
              syncActions.push({
                action: 'guest_updated',
                guestName: `${change.guest.firstName} ${change.guest.lastName}`,
                tableName: currentTable.name,
                oldCount: change.oldCount,
                newCount: change.newCount
              });
            } else {
              const guestIndex = updatedArrangement[guestTableId].indexOf(change.guestId);
              if (guestIndex !== -1) {
                updatedArrangement[guestTableId].splice(guestIndex, 1);
                if (updatedArrangement[guestTableId].length === 0) {
                  delete updatedArrangement[guestTableId];
                }
              }

              let newTable = findAvailableTable(change.newCount, updatedTables, updatedArrangement);
              
              if (!newTable) {
                const newTableNumber = updatedTables.length + 1;
                const optimalCapacity = Math.max(8, Math.ceil(change.newCount * 1.5));
                newTable = createNewTable(optimalCapacity, newTableNumber);
                updatedTables.push(newTable);
                syncActions.push({
                  action: 'table_created',
                  tableName: newTable.name,
                  capacity: newTable.capacity
                });
              }

              if (!updatedArrangement[newTable.id]) {
                updatedArrangement[newTable.id] = [];
              }
              updatedArrangement[newTable.id].push(change.guestId);
              
              syncActions.push({
                action: 'guest_moved',
                guestName: `${change.guest.firstName} ${change.guest.lastName}`,
                fromTable: currentTable.name,
                toTable: newTable.name,
                oldCount: change.oldCount,
                newCount: change.newCount
              });
            }
          }
          break;
      }
    }

    const { tables: optimizedTables, arrangement: optimizedArrangement, wasOptimized } = 
      optimizeTableArrangement(updatedTables, updatedArrangement, confirmedGuestsList);

    if (wasOptimized) {
      syncActions.push({
        action: 'arrangement_optimized',
        message: t('seating.sync.arrangementOptimized')
      });
    }

    return {
      tables: optimizedTables,
      arrangement: optimizedArrangement,
      actions: syncActions
    };
  }, [findAvailableTable, createNewTable, optimizeTableArrangement, t]);

  const performSync = useCallback(async (newGuestData) => {
    if (!autoSyncEnabled || syncInProgress) return;

    const { confirmed: newConfirmedGuests } = newGuestData;
    const newFingerprint = createGuestFingerprint(newConfirmedGuests);
    
    if (!lastSyncData) {
      setLastSyncData(newFingerprint);
      return;
    }

    const { hasChanges, changes } = detectGuestChanges(newFingerprint, lastSyncData);
    
    if (!hasChanges) {
      setLastSyncData(newFingerprint);
      return;
    }

    setSyncInProgress(true);
    
    try {
      const { tables: updatedTables, arrangement: updatedArrangement, actions } = 
        await applySyncChanges(changes, tables, seatingArrangement, newConfirmedGuests);

      const tablesWithGroupNames = updateTableNamesWithGroups(updatedTables, updatedArrangement);

      setTables(tablesWithGroupNames);
      setSeatingArrangement(updatedArrangement);

      const saveData = {
        tables: tablesWithGroupNames,
        arrangement: updatedArrangement,
        preferences,
        layoutSettings: { canvasScale, canvasOffset }
      };

      await saveSeatingArrangement(saveData);
      setLastSyncData(newFingerprint);

      const actionSummary = actions.map(action => {
        switch (action.action) {
          case 'guest_seated':
            return t('seating.sync.guestSeated', { 
              guestName: action.guestName, 
              tableName: action.tableName 
            });
          case 'guest_removed':
            return t('seating.sync.guestRemoved', { 
              guestName: action.guestName, 
              tableName: action.tableName 
            });
          case 'guest_moved':
            return t('seating.sync.guestMoved', { 
              guestName: action.guestName, 
              fromTable: action.fromTable, 
              toTable: action.toTable 
            });
          case 'guest_updated':
            return t('seating.sync.guestUpdated', { 
              guestName: action.guestName, 
              tableName: action.tableName 
            });
          case 'table_created':
            return t('seating.sync.tableCreated', { 
              tableName: action.tableName 
            });
          case 'arrangement_optimized':
            return action.message;
          default:
            return '';
        }
      }).filter(Boolean);

      if (actionSummary.length > 0) {
        showSyncNotification('success', t('seating.sync.changesApplied', { 
          count: actionSummary.length 
        }));
      }

    } catch (error) {
      showSyncNotification('error', t('seating.sync.syncFailed'));
      setLastSyncData(newFingerprint);
    } finally {
      setSyncInProgress(false);
    }
  }, [
    autoSyncEnabled, 
    syncInProgress, 
    lastSyncData, 
    tables, 
    seatingArrangement, 
    preferences, 
    canvasScale, 
    canvasOffset,
    createGuestFingerprint,
    detectGuestChanges,
    applySyncChanges,
    updateTableNamesWithGroups,
    saveSeatingArrangement,
    showSyncNotification,
    t
  ]);

  useEffect(() => {
    if (!autoSyncEnabled) return;

    const pollForChanges = async () => {
      if (syncInProgress) return;
      
      try {
        const syncResponse = await makeApiRequest(`/api/events/${eventId}/seating/sync/status`);
        if (syncResponse && syncResponse.ok) {
          const syncStatus = await syncResponse.json();
          
          if (syncStatus.syncRequired && syncStatus.pendingTriggers > 0) {
            const processResponse = await makeApiRequest(`/api/events/${eventId}/seating/sync/process`, {
              method: 'POST'
            });
            
            if (processResponse && processResponse.ok) {
              const processResult = await processResponse.json();
              
              if (processResult.requiresUserDecision) {
                setSyncOptions(processResult.options || []);
                setAffectedGuests(processResult.affectedGuests || []);
                setPendingSyncTriggers(processResult.pendingTriggers || []);
                setIsSyncOptionsModalOpen(true);
                
                showSyncNotification('info', t('seating.sync.newChangesDetected'));
              } else if (processResult.hasChanges && processResult.seating) {
                setTables(processResult.seating.tables || []);
                setSeatingArrangement(processResult.seating.arrangement || {});
                
                showSyncNotification('success', processResult.message);
              }
            }
          }
        }
      } catch (error) {
      }
    };

    syncTimeoutRef.current = setInterval(pollForChanges, 20000);

    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, [autoSyncEnabled, syncInProgress, makeApiRequest, eventId, showSyncNotification, t]);

  const generateAISeating = useCallback(async (aiPreferences) => {
    try {
      setLoading(true);
      
      const requestBody = {
        tables,
        preferences: { ...preferences, ...aiPreferences },
        guests: confirmedGuests,
        currentArrangement: aiPreferences.preserveExisting ? seatingArrangement : null,
        clearExisting: aiPreferences.clearExisting,
        preserveExisting: aiPreferences.preserveExisting,
        allTables: aiPreferences.allTables || tables
      };
      
      const response = await makeApiRequest(`/api/events/${eventId}/seating/ai-generate`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (!response) return false;

      if (response.ok) {
        const data = await response.json();
        
        setSeatingArrangement(data.arrangement);
        
        let finalTables = data.tables || tables;
        
        if (data.arrangement && Object.keys(data.arrangement).length > 0) {
          finalTables = updateTableNamesWithGroups(finalTables, data.arrangement);
        }
        
        setTables(finalTables);
        
        const layoutData = {
          tables: finalTables,
          arrangement: data.arrangement,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        };
        
        autoSave(layoutData);
        
        setError('');
        
        setIsAIModalOpen(false);
        
        const newFingerprint = createGuestFingerprint(confirmedGuests);
        setLastSyncData(newFingerprint);
        
        return { arrangement: data.arrangement, tables: finalTables };
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.aiGeneration'));
        return false;
      }
    } catch (err) {
      setError(t('errors.networkError'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [eventId, makeApiRequest, tables, preferences, confirmedGuests, seatingArrangement, canvasScale, canvasOffset, autoSave, t, updateTableNamesWithGroups, createGuestFingerprint]);

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

  const addTable = useCallback((event, type = 'round', capacity = 8) => {
    let position;
    
    if (event.constrainedPosition) {
      position = event.constrainedPosition;
    } else {
      position = { x: 300, y: 300 };
    }

    const nextTableNumber = getNextTableNumber();

    const newTable = {
      id: `table_${Date.now()}`,
      name: `${t('seating.tableName')} ${nextTableNumber}`,
      type,
      capacity,
      position,
      rotation: 0,
      size: calculateTableSize(type, capacity)
    };
    
    const newTables = [...tables, newTable];
    setTables(newTables);
    setIsAddingTable(false);
    
    setSelectedTable(newTable);
    setEditingTable(newTable);
    setIsTableModalOpen(true);
    
    autoSave({
      tables: newTables,
      arrangement: seatingArrangement,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset
      }
    });
  }, [tables, seatingArrangement, preferences, canvasScale, canvasOffset, autoSave, t, calculateTableSize, getNextTableNumber]);

  const handleAddTablesFromAI = useCallback(async (tablesToAdd) => {
    try {
      const newTables = [...tables, ...tablesToAdd];
      
      setTables(newTables);
      
      const layoutData = {
        tables: newTables,
        arrangement: seatingArrangement,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      };
      
      const success = await saveSeatingArrangement(layoutData);
      
      if (success) {
        return true;
      } else {
        setTables(tables);
        throw new Error(t('seating.errors.saveTablesFailed'));
      }
    } catch (err) {
      setError(t('seating.errors.addTablesError'));
      return false;
    }
  }, [tables, seatingArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, t]);

  const handleAddTableFromView = useCallback((newTable) => {
    const nextTableNumber = getNextTableNumber();
    const tableWithCorrectName = {
      ...newTable,
      name: `${t('seating.tableName')} ${nextTableNumber}`
    };
    
    const newTables = [...tables, tableWithCorrectName];
    setTables(newTables);
    
    setSelectedTable(tableWithCorrectName);
    setEditingTable(tableWithCorrectName);
    setIsTableModalOpen(true);
    
    autoSave({
      tables: newTables,
      arrangement: seatingArrangement,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset
      }
    });
  }, [tables, seatingArrangement, preferences, canvasScale, canvasOffset, autoSave, t, getNextTableNumber]);

  const updateTable = useCallback((tableId, updates) => {
    let newTables;
    let newArrangement = { ...seatingArrangement };
    
    if (updates === null) {
      newTables = tables.filter(table => table.id !== tableId);
      delete newArrangement[tableId];
      setSelectedTable(null);
      
      const newEditedNames = new Set(manuallyEditedTableNames);
      newEditedNames.delete(tableId);
      setManuallyEditedTableNames(newEditedNames);
    } else {
      const currentTable = tables.find(t => t.id === tableId);
      
      if (updates.name && currentTable && updates.name !== currentTable.name) {
        const tableNumber = parseInt(currentTable.name.match(/\d+/)?.[0] || '1');
        const autoGeneratedName = generateTableNameWithGroup(tableNumber, tableId, seatingArrangement);
        
        if (updates.name !== autoGeneratedName && updates.name !== currentTable.name) {
          const newEditedNames = new Set(manuallyEditedTableNames);
          newEditedNames.add(tableId);
          setManuallyEditedTableNames(newEditedNames);
        }
      }
      
      newTables = tables.map(table => 
        table.id === tableId ? { ...table, ...updates } : table
      );
    }
    
    setTables(newTables);
    setSeatingArrangement(newArrangement);
    
    autoSave({
      tables: newTables,
      arrangement: newArrangement,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset
      }
    });
  }, [tables, seatingArrangement, preferences, canvasScale, canvasOffset, autoSave, manuallyEditedTableNames, generateTableNameWithGroup]);

  const deleteTable = useCallback((tableId) => {
    const newTables = tables.filter(table => table.id !== tableId);
    const newArrangement = { ...seatingArrangement };
    delete newArrangement[tableId];
    
    const newEditedNames = new Set(manuallyEditedTableNames);
    newEditedNames.delete(tableId);
    setManuallyEditedTableNames(newEditedNames);
    
    setTables(newTables);
    setSeatingArrangement(newArrangement);
    
    autoSave({
      tables: newTables,
      arrangement: newArrangement,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset
      }
    });
  }, [tables, seatingArrangement, preferences, canvasScale, canvasOffset, autoSave, manuallyEditedTableNames]);

  const seatGuest = useCallback((guestId, tableId) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return false;

    const currentSeatedAtTable = seatingArrangement[tableId] || [];
    const guest = confirmedGuests.find(g => g._id === guestId);
    if (!guest) return false;

    const totalPeople = guest.attendingCount || 1;
    const currentOccupancy = currentSeatedAtTable.reduce((sum, guestId) => {
      const g = confirmedGuests.find(guest => guest._id === guestId);
      return sum + (g?.attendingCount || 1);
    }, 0);

    if (currentOccupancy + totalPeople > table.capacity) {
      setError(t('seating.errors.tableOvercapacity', { 
        table: table.name, 
        capacity: table.capacity,
        needed: totalPeople,
        available: table.capacity - currentOccupancy
      }));
      return false;
    }

    const newArrangement = { ...seatingArrangement };
    
    Object.keys(newArrangement).forEach(tId => {
      newArrangement[tId] = newArrangement[tId].filter(id => id !== guestId);
      if (newArrangement[tId].length === 0) {
        delete newArrangement[tId];
      }
    });

    if (!newArrangement[tableId]) {
      newArrangement[tableId] = [];
    }
    newArrangement[tableId].push(guestId);

    setSeatingArrangement(newArrangement);
    setError('');
    
    setTimeout(() => {
      const updatedTables = updateTableNamesWithGroups(tables, newArrangement);
      setTables(updatedTables);
      
      autoSave({
        tables: updatedTables,
        arrangement: newArrangement,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      });

      if (!lastSyncData) {
        const newFingerprint = createGuestFingerprint(confirmedGuests);
        setLastSyncData(newFingerprint);
      }
    }, 100);
    
    return true;
  }, [tables, seatingArrangement, confirmedGuests, preferences, canvasScale, canvasOffset, autoSave, t, updateTableNamesWithGroups]);

  const unseatGuest = useCallback((guestId) => {
    const newArrangement = { ...seatingArrangement };
    Object.keys(newArrangement).forEach(tableId => {
      newArrangement[tableId] = newArrangement[tableId].filter(id => id !== guestId);
      if (newArrangement[tableId].length === 0) {
        delete newArrangement[tableId];
      }
    });
    
    setSeatingArrangement(newArrangement);
    
    setTimeout(() => {
      const updatedTables = updateTableNamesWithGroups(tables, newArrangement);
      setTables(updatedTables);
      
      autoSave({
        tables: updatedTables,
        arrangement: newArrangement,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      });

      if (!lastSyncData) {
        const newFingerprint = createGuestFingerprint(confirmedGuests);
        setLastSyncData(newFingerprint);
      }
    }, 100);
  }, [seatingArrangement, tables, preferences, canvasScale, canvasOffset, autoSave, updateTableNamesWithGroups]);

  const clearAllSeating = useCallback(() => {
    if (window.confirm(t('seating.confirmClearAll'))) {
      const newArrangement = {};
      const newTables = [];
      
      setSeatingArrangement(newArrangement);
      setTables(newTables);
      setSelectedTable(null);
      setEditingTable(null);
      setError('');
      
      setManuallyEditedTableNames(new Set());
      
      setLastSyncData(null);
      
      autoSave({
        tables: newTables,
        arrangement: newArrangement,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      });
    }
  }, [preferences, canvasScale, canvasOffset, autoSave, t]);

  const handleCanvasClick = useCallback((event) => {
    if (!isAddingTable) return;
    addTable(event, tableType);
  }, [isAddingTable, addTable, tableType]);

  const handleTableClick = useCallback((table) => {
    setSelectedTable(table);
    setEditingTable(table);
    setIsTableModalOpen(true);
  }, []);

  const handleDragStart = useCallback((guest) => {
    setDraggedGuest(guest);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedGuest(null);
  }, []);

  const handleTableDrop = useCallback((tableId) => {
    if (draggedGuest) {
      const success = seatGuest(draggedGuest._id, tableId);
      if (success) {
        setDraggedGuest(null);
      }
    }
  }, [draggedGuest, seatGuest]);

  const exportSeatingChart = useCallback(async (format) => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/seating/export?format=${format}`, {
        method: 'POST',
        body: JSON.stringify({
          tables,
          arrangement: seatingArrangement,
          guests: confirmedGuests
        })
      });

      if (!response) return;

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `seating-chart.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      setError(t('seating.errors.exportFailed'));
    }
  }, [eventId, makeApiRequest, tables, seatingArrangement, confirmedGuests, t]);

  const handleCanvasOffsetChange = useCallback((newOffset) => {
    setCanvasOffset(newOffset);
    
    autoSave({
      tables,
      arrangement: seatingArrangement,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset: typeof newOffset === 'function' ? newOffset(canvasOffset) : newOffset
      }
    });
  }, [canvasScale, canvasOffset, tables, seatingArrangement, preferences, autoSave]);

  const handleCanvasScaleChange = useCallback((newScale) => {
    const actualScale = typeof newScale === 'function' ? newScale(canvasScale) : newScale;
    setCanvasScale(actualScale);
    
    autoSave({
      tables,
      arrangement: seatingArrangement,
      preferences,
      layoutSettings: {
        canvasScale: actualScale,
        canvasOffset
      }
    });
  }, [canvasScale, canvasOffset, tables, seatingArrangement, preferences, autoSave]);

  const toggleAutoSync = useCallback(() => {
    setAutoSyncEnabled(prev => {
      const newValue = !prev;
      if (newValue && confirmedGuests.length > 0) {
        const newFingerprint = createGuestFingerprint(confirmedGuests);
        setLastSyncData(newFingerprint);
      }
      return newValue;
    });
  }, [createGuestFingerprint, confirmedGuests]);

  const manualSync = useCallback(async () => {
    if (syncInProgress) return;
    
    try {
      setSyncInProgress(true);
      
      const response = await makeApiRequest(`/api/events/${eventId}/seating/sync/process`, {
        method: 'POST'
      });

      if (!response) return;

      if (response.ok) {
        const result = await response.json();
        
        if (result.requiresUserDecision) {
          setSyncOptions(result.options);
          setAffectedGuests(result.affectedGuests);
          setPendingSyncTriggers(result.pendingTriggers);
          setIsSyncOptionsModalOpen(true);
        } else if (result.hasChanges) {
          setTables(result.seating.tables);
          setSeatingArrangement(result.seating.arrangement);
          
          showSyncNotification('success', result.message);
          
          await fetchConfirmedGuests();
        } else {
          showSyncNotification('info', result.message);
        }
      } else {
        const errorData = await response.json().catch(() => ({}));
        showSyncNotification('error', errorData.message || t('seating.sync.manualSyncFailed'));
      }
    } catch (error) {
      showSyncNotification('error', t('seating.sync.manualSyncFailed'));
    } finally {
      setSyncInProgress(false);
    }
  }, [syncInProgress, makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests]);

const handleApplySyncOption = useCallback(async (optionId, customArrangement = null) => {
  try {
    setSyncInProgress(true);
    
    const response = await makeApiRequest(`/api/events/${eventId}/seating/sync/apply-option`, {
      method: 'POST',
      body: JSON.stringify({
        optionId,
        customArrangement
      })
    });

    if (!response) return;

    if (response.ok) {
      const result = await response.json();
      
      setTables(result.seating.tables);
      setSeatingArrangement(result.seating.arrangement);
      setIsSyncOptionsModalOpen(false);
      
      showSyncNotification('success', result.message);
      
      const currentGuestData = await fetchConfirmedGuests();
      if (currentGuestData) {
        const newFingerprint = createGuestFingerprint(currentGuestData.confirmed);
        setLastSyncData(newFingerprint);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      showSyncNotification('error', errorData.message || t('seating.sync.applyOptionFailed'));
    }
  } catch (error) {
    showSyncNotification('error', t('seating.sync.applyOptionFailed'));
  } finally {
    setSyncInProgress(false);
  }
}, [makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint]);

const handleMoveAffectedGuestsToUnassigned = useCallback(async (affectedGuestIds) => {
  try {
    setSyncInProgress(true);
    
    const response = await makeApiRequest(`/api/events/${eventId}/seating/sync/move-to-unassigned`, {
      method: 'POST',
      body: JSON.stringify({
        affectedGuestIds
      })
    });

    if (!response) return;

    if (response.ok) {
      const result = await response.json();
      
      setTables(result.seating.tables);
      setSeatingArrangement(result.seating.arrangement);
      setIsSyncOptionsModalOpen(false);
      
      showSyncNotification('success', result.message);
      
      const currentGuestData = await fetchConfirmedGuests();
      if (currentGuestData) {
        const newFingerprint = createGuestFingerprint(currentGuestData.confirmed);
        setLastSyncData(newFingerprint);
      }
    } else {
      const errorData = await response.json().catch(() => ({}));
      showSyncNotification('error', errorData.message || t('seating.sync.moveGuestsFailed'));
    }
  } catch (error) {
    showSyncNotification('error', t('seating.sync.moveGuestsFailed'));
  } finally {
    setSyncInProgress(false);
  }
}, [makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint]);

  useEffect(() => {
    const initializeData = async () => {
      const guestData = await fetchConfirmedGuests();
      
      if (guestData) {
      } else {
      }
      
      const seatingData = await fetchSeatingArrangement();
    };

    initializeData();
  }, [fetchConfirmedGuests, fetchSeatingArrangement]);

  const stats = (() => {
    const totalGuests = confirmedGuests.reduce((sum, guest) => {
      const count = guest.attendingCount || 1;
      return sum + count;
    }, 0);

    const seatedIds = Object.values(seatingArrangement).flat();
    const seatedGuests = seatedIds.reduce((sum, guestId) => {
      const guest = confirmedGuests.find(g => g._id === guestId);
      const attendingCount = guest?.attendingCount || 1;
      return sum + attendingCount;
    }, 0);

    const result = {
      totalGuests,
      seatedGuests,
      totalTables: tables.length,
      occupiedTables: Object.keys(seatingArrangement).length
    };

    return result;
  })();

  if (loading) {
    return (
      <FeaturePageTemplate
        title={t('seating.title')}
        icon="🪑"
        description={t('seating.description')}
      >
        <div className="seating-loading">
          {t('common.loading')}
        </div>
      </FeaturePageTemplate>
    );
  }

  return (
    <FeaturePageTemplate
      title={t('seating.title')}
      icon="🪑"
      description={t('seating.description')}
    >
      <div className="seating-container">
        {error && (
          <div className="seating-error-message">
            {error}
          </div>
        )}

        {syncNotification && (
          <div className={`seating-sync-notification ${syncNotification.type}`}>
            <div className="sync-notification-content">
              <span className="sync-notification-icon">
                {syncNotification.type === 'success' ? '✅' : '❌'}
              </span>
              <span className="sync-notification-message">
                {syncNotification.message}
              </span>
            </div>
          </div>
        )}

        <div className="seating-header">
          <div className="seating-mode-selector">
            <button
              className={`mode-button ${mode === 'manual' ? 'active' : ''}`}
              onClick={() => setMode('manual')}
            >
              {t('seating.mode.manual')}
            </button>
            <button
              className={`mode-button ${mode === 'ai' ? 'active' : ''}`}
              onClick={() => setMode('ai')}
            >
              {t('seating.mode.ai')}
            </button>
          </div>

          <div className="seating-sync-controls">
            <div className="sync-status">
              <span className={`sync-indicator ${autoSyncEnabled ? 'enabled' : 'disabled'}`}>
                {autoSyncEnabled ? '🔄' : '⏸️'}
              </span>
              <span className="sync-status-text">
                {t(`seating.sync.status.${autoSyncEnabled ? 'enabled' : 'disabled'}`)}
              </span>
              {syncInProgress && (
                <span className="sync-progress">
                  {t('seating.sync.inProgress')}
                </span>
              )}
            </div>
            <button
              className="sync-toggle-button"
              onClick={toggleAutoSync}
              title={t(`seating.sync.${autoSyncEnabled ? 'disable' : 'enable'}`)}
            >
              {t(`seating.sync.${autoSyncEnabled ? 'disable' : 'enable'}`)}
            </button>
          </div>

          <div className="seating-view-selector">
            <button
              className={`view-button ${viewMode === 'visual' ? 'active' : ''}`}
              onClick={() => setViewMode('visual')}
            >
              🎨 {t('seating.view.visual')}
            </button>
            <button
              className={`view-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
              📋 {t('seating.view.table')}
            </button>
          </div>

          <div className="seating-actions">
            {mode === 'ai' && (
              <button
                className="seating-action-button ai-button"
                onClick={() => setIsAIModalOpen(true)}
                disabled={confirmedGuests.length === 0}
              >
                🤖 {t('seating.generateAI')}
              </button>
            )}

            <button
              className="seating-action-button clear-all-button"
              onClick={clearAllSeating}
              disabled={tables.length === 0 && Object.keys(seatingArrangement).length === 0}
              title={t('seating.clearAllTooltip')}
            >
              🗑️ {t('seating.clearAll')}
            </button>

            <button
              className="seating-action-button"
              onClick={() => saveSeatingArrangement()}
            >
              💾 {t('seating.save')}
            </button>

            <div className="export-dropdown">
              <button className="seating-action-button">
                📤 {t('common.export')}
              </button>
              <div className="export-menu">
                <button onClick={() => exportSeatingChart('pdf')}>
                  📄 {t('common.formats.pdf')}
                </button>
                <button onClick={() => exportSeatingChart('excel')}>
                  📊 {t('common.formats.excel')}
                </button>
                <button onClick={() => exportSeatingChart('png')}>
                  🖼️ {t('common.formats.png')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="seating-stats">
          <div className="stat-card">
            <div className="stat-number">{stats.totalGuests}</div>
            <div className="stat-label">{t('seating.stats.totalGuests')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.seatedGuests}</div>
            <div className="stat-label">{t('seating.stats.seatedGuests')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.totalTables}</div>
            <div className="stat-label">{t('seating.stats.totalTables')}</div>
          </div>
          <div className="stat-card">
            <div className="stat-number">{stats.occupiedTables}</div>
            <div className="stat-label">{t('seating.stats.occupiedTables')}</div>
          </div>
        </div>

        <div className="seating-main">
          {viewMode === 'visual' ? (
            <>
              <div className="seating-canvas-container">
                <div className="canvas-toolbar">
                  <div className="table-controls">
                    <select
                      value={tableType}
                      onChange={(e) => setTableType(e.target.value)}
                    >
                      <option value="round">{t('seating.tableTypes.round')}</option>
                      <option value="rectangular">{t('seating.tableTypes.rectangular')}</option>
                      <option value="square">{t('seating.tableTypes.square')}</option>
                    </select>
                    
                    <button
                      className={`add-table-button ${isAddingTable ? 'active' : ''}`}
                      onClick={() => setIsAddingTable(!isAddingTable)}
                    >
                      {isAddingTable ? t('seating.cancelAddTable') : t('seating.addTable')}
                    </button>
                  </div>

                  <div className="canvas-controls">
                    <button onClick={() => handleCanvasScaleChange(prev => Math.min(prev + 0.1, 2))}>
                      🔍+
                    </button>
                    <span>{Math.round(canvasScale * 100)}%</span>
                    <button onClick={() => handleCanvasScaleChange(prev => Math.max(prev - 0.1, 0.5))}>
                      🔍-
                    </button>
                    <button onClick={() => { 
                      handleCanvasScaleChange(1); 
                      handleCanvasOffsetChange({ x: 0, y: 0 }); 
                    }}>
                      🎯 {t('seating.resetView')}
                    </button>
                  </div>
                </div>

                <SeatingCanvas
                  ref={canvasRef}
                  tables={tables}
                  seatingArrangement={seatingArrangement}
                  guests={confirmedGuests}
                  scale={canvasScale}
                  offset={canvasOffset}
                  isAddingTable={isAddingTable}
                  tableType={tableType}
                  selectedTable={selectedTable}
                  draggedGuest={draggedGuest}
                  onCanvasClick={handleCanvasClick}
                  onTableClick={handleTableClick}
                  onTableDrop={handleTableDrop}
                  onTableUpdate={updateTable}
                  onOffsetChange={handleCanvasOffsetChange}
                />
              </div>

              <div className="seating-sidebar">
                <GuestsList
                  guests={confirmedGuests}
                  tables={tables}
                  seatingArrangement={seatingArrangement}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onUnseatGuest={unseatGuest}
                  syncNotification={syncNotification}
                />
              </div>
            </>
          ) : (
            <div className="seating-table-view-container">
              <SeatingTableView
                tables={tables}
                guests={confirmedGuests}
                seatingArrangement={seatingArrangement}
                onSeatGuest={seatGuest}
                onUnseatGuest={unseatGuest}
                onEditTable={handleTableClick}
                onAddTable={handleAddTableFromView}
                onDeleteTable={deleteTable}
              />
            </div>
          )}
        </div>

        <TableDetailsModal
          isOpen={isTableModalOpen}
          table={editingTable}
          guests={confirmedGuests}
          seatingArrangement={seatingArrangement}
          onClose={() => {
            setIsTableModalOpen(false);
            setEditingTable(null);
            setSelectedTable(null);
          }}
          onUpdateTable={updateTable}
          onDeleteTable={deleteTable}
          onSeatGuest={seatGuest}
          onUnseatGuest={unseatGuest}
        />

        <AISeatingModal
          isOpen={isAIModalOpen}
          guests={confirmedGuests}
          tables={tables}
          preferences={preferences}
          seatingArrangement={seatingArrangement}
          onClose={() => setIsAIModalOpen(false)}
          onGenerate={generateAISeating}
          onAddTables={handleAddTablesFromAI}
          getNextTableNumber={getNextTableNumber}
        />

        <SyncOptionsModal
          isOpen={isSyncOptionsModalOpen}
          onClose={() => setIsSyncOptionsModalOpen(false)}
          options={syncOptions}
          affectedGuests={affectedGuests}
          pendingTriggers={pendingSyncTriggers}
          onApplyOption={handleApplySyncOption}
          onMoveToUnassigned={handleMoveAffectedGuestsToUnassigned}
        />
      </div>
    </FeaturePageTemplate>
  );
};

export default EventSeatingPage;