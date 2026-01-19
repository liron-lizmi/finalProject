import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from '../shared/FeaturePageTemplate';
import SeatingCanvas from './components/SeatingCanvas';
import GuestsList from '../Guests/components/GuestsList';
import TableDetailsModal from './components/TableDetailsModal';
import AISeatingModal from './components/AISeatingModal';
import SeatingTableView from './components/SeatingTableView';
import SyncOptionsModal from '../shared/components/SyncOptionsModal';
import { apiFetch } from '../../../utils/api';
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
    seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
    groupMixingRules: [],
    groupPolicies: {},
    allowGroupMixing: false,
    preferredTableSize: 12
  });
  const [draggedGuest, setDraggedGuest] = useState(null);
  const [editingTable, setEditingTable] = useState(null);
 
  const [canvasScale, setCanvasScale] = useState(1);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [tableType, setTableType] = useState('round');
  const [tableCapacity, setTableCapacity] = useState(12);
 
  const [lastSyncData, setLastSyncData] = useState(null);
  const [syncInProgress, setSyncInProgress] = useState(false);
  const autoSyncEnabled = true;
  const [syncNotification, setSyncNotification] = useState(null);

  const [syncOptions, setSyncOptions] = useState([]);
  const [affectedGuests, setAffectedGuests] = useState([]);
  const [pendingSyncTriggers, setPendingSyncTriggers] = useState([]);
  const [isSyncOptionsModalOpen, setIsSyncOptionsModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
 
  const [isSeparatedSeating, setIsSeparatedSeating] = useState(false);
  const [lastServerUpdate, setLastServerUpdate] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [maleTables, setMaleTables] = useState([]);
  const [femaleTables, setFemaleTables] = useState([]);
  const [maleArrangement, setMaleArrangement] = useState({});
  const [femaleArrangement, setFemaleArrangement] = useState({});
  const [genderFilter, setGenderFilter] = useState('all');
 
  const canvasRef = useRef(null);
  const [canEdit, setCanEdit] = useState(true);
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
      const response = await apiFetch(url, mergedOptions);
      if (response.status === 401) {
        handleAuthError();
        return null;
      }
      return response;
    } catch (err) {
      throw err;
    }
  }, [getAuthToken, handleAuthError]);
 
  const fetchEventPermissions = useCallback(async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}`);
      if (response && response.ok) {
        const eventData = await response.json();
        setCanEdit(eventData.canEdit || false);
        setIsSeparatedSeating(eventData.isSeparatedSeating || false);
      }
    } catch (err) {
      console.error('Error fetching event permissions:', err);
    }
  }, [eventId, makeApiRequest]);

  const showSyncNotification = useCallback((type, message) => {
    setSyncNotification({ type, message });
    setTimeout(() => setSyncNotification(null), 4000);
  }, []);

  const getNextTableNumber = useCallback(() => {
    if (isSeparatedSeating) {
      const allTables = [...maleTables, ...femaleTables];
      if (allTables.length === 0) return 1;
      const tableNumbers = allTables.map(table => {
        const match = table.name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      return Math.max(...tableNumbers) + 1;
    } else {
      if (tables.length === 0) return 1;
      const tableNumbers = tables.map(table => {
        const match = table.name.match(/(\d+)/);
        return match ? parseInt(match[1], 10) : 0;
      });
      return Math.max(...tableNumbers) + 1;
    }
  }, [tables, maleTables, femaleTables, isSeparatedSeating]);

  const isTableNameManuallyEdited = useCallback((tableId, currentName) => {
    if (manuallyEditedTableNames.has(tableId)) {
      return true;
    }
   
    const basicPattern = new RegExp(`^${t('seating.tableName')} \\d+$`);
    const groupPattern = new RegExp(`^${t('seating.tableName')} \\d+ - .+$`);
   
    return !basicPattern.test(currentName) && !groupPattern.test(currentName);
  }, [manuallyEditedTableNames, t]);

  const generateTableNameWithGroup = useCallback((tableNumber, tableId, arrangement, currentGender = null) => {
    const baseName = `${t('seating.tableName')} ${tableNumber}`;
   
    if (!arrangement || !arrangement[tableId] || arrangement[tableId].length === 0) {
      return baseName;
    }
   
  const seatedGuestIds = arrangement[tableId] || [];
    const tableGuests = seatedGuestIds.map(guestId => {
      const baseGuest = confirmedGuests.find(g => g._id === guestId);
      if (!baseGuest) return null;
     
      if (isSeparatedSeating && currentGender) {
        return {
          ...baseGuest,
          attendingCount: currentGender === 'male' ? (baseGuest.maleCount || 0) : (baseGuest.femaleCount || 0)
        };
      }
     
      return baseGuest;
    }).filter(Boolean);
   
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
  }, [confirmedGuests, t, isSeparatedSeating]);

  const updateTableNamesWithGroups = useCallback((currentTables, arrangement, gender = null) => {
    return currentTables.map(table => {
      if (isTableNameManuallyEdited(table.id, table.name)) {
        return table;
      }
     
      const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
      return {
        ...table,
        name: generateTableNameWithGroup(tableNumber, table.id, arrangement, gender)
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
      group: guest.customGroup || guest.group,
      gender: guest.gender
    }));
  }, []);

  const detectGuestChanges = useCallback((newGuests, oldGuests) => {
    if (!oldGuests || oldGuests.length === 0) {
      return { hasChanges: false, changes: [] };
    }

    const changes = [];
    const oldGuestsMap = new Map(oldGuests.map(g => [g.id, g]));
    const newGuestsMap = new Map(newGuests.map(g => [g.id, g]));

    const isGuestSeated = (guestId) => {
      if (isSeparatedSeating) {
        const inMale = Object.values(maleArrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
        const inFemale = Object.values(femaleArrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
        return inMale || inFemale;
      } else {
        return Object.values(seatingArrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
      }
    };

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
          }
        }

        if (newGuest.status === 'confirmed' && oldGuest.status === 'confirmed') {
          const oldCount = oldGuest.attendingCount || 1;
          const newCount = newGuest.attendingCount || 1;
          const guestIsSeated = isGuestSeated(newGuest.id);
         
          if (newCount > oldCount && guestIsSeated) {
         
            changes.push({
              type: 'attending_count_increased',
              guestId: newGuest.id,
              guest: newGuest,
              oldCount,
              newCount
            });
          }
        }
      }
    });

    return { hasChanges: changes.length > 0, changes };
  }, [isSeparatedSeating, seatingArrangement, maleArrangement, femaleArrangement]);

  const checkAndHandlePendingSync = useCallback(async (skipFingerprintUpdate = false) => {
    try {
     
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
          if (isSeparatedSeating) {
            setMaleTables(processResult.seating.maleTables || []);
            setFemaleTables(processResult.seating.femaleTables || []);
            setMaleArrangement(processResult.seating.maleArrangement || {});
            setFemaleArrangement(processResult.seating.femaleArrangement || {});
          } else {
            setTables(processResult.seating.tables || []);
            setSeatingArrangement(processResult.seating.arrangement || {});
          }
       
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
    } catch (error) {
      console.error('[checkAndHandlePendingSync] Error:', error);
    }
  }, [makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint, isSeparatedSeating]);

  const fetchSeatingArrangement = useCallback(async () => {
    try {
     
      const response = await makeApiRequest(`/api/events/${eventId}/seating`);
           
      if (!response) {
        return;
      }

      if (response.ok) {
        const data = await response.json();
       
        const isEventSeparated = data.isSeparatedSeating || false;
        setIsSeparatedSeating(isEventSeparated);
                       
        if (isEventSeparated) {
         
          setMaleTables(data.maleTables || []);
          setFemaleTables(data.femaleTables || []);
          setMaleArrangement(data.maleArrangement || {});
          setFemaleArrangement(data.femaleArrangement || {});
          setTables(data.tables || []);
          setSeatingArrangement(data.arrangement || {});
         
        } else {
         
          setTables(data.tables || []);
          setSeatingArrangement(data.arrangement || {});
          setMaleTables([]);
          setFemaleTables([]);
          setMaleArrangement({});
          setFemaleArrangement({});
        }

        setPreferences(data.preferences || {
          seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
          groupMixingRules: [],
          groupPolicies: {},
          allowGroupMixing: false,
          preferredTableSize: 12
        });
       
        if (data.layoutSettings) {
          setCanvasScale(data.layoutSettings.canvasScale || 1);
          setCanvasOffset(data.layoutSettings.canvasOffset || { x: 0, y: 0 });
        }
       
        if (data.updatedAt) {
          setLastServerUpdate(new Date(data.updatedAt).getTime());
        }
               
        return data;
       
      } else if (response.status === 404) {
        setTables([]);
        setSeatingArrangement({});
        setMaleTables([]);
        setFemaleTables([]);
        setMaleArrangement({});
        setFemaleArrangement({});
        setPreferences({
          seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
          groupMixingRules: [],
          groupPolicies: {},
          allowGroupMixing: false,
          preferredTableSize: 12
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
  }, [eventId, makeApiRequest, t, checkAndHandlePendingSync, isSeparatedSeating]);

  const saveSeatingArrangement = useCallback(async (immediateData = null) => {
    try {

      const dataToSave = immediateData || (isSeparatedSeating ? {
        tables: tables || [],
        arrangement: seatingArrangement || {},
        maleTables: maleTables || [],
        femaleTables: femaleTables || [],
        maleArrangement: maleArrangement || {},
        femaleArrangement: femaleArrangement || {},
        isSeparatedSeating: true,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      } : {
        tables: tables || [],
        arrangement: seatingArrangement || {},
        isSeparatedSeating: false,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      });

      const jsonString = JSON.stringify(dataToSave);

      const response = await makeApiRequest(`/api/events/${eventId}/seating`, {
        method: 'POST',
        body: jsonString
      });

      if (!response) {
        return false;
      }

      if (response.ok) {
        const result = await response.json();
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
  }, [eventId, makeApiRequest, tables, seatingArrangement, maleTables, femaleTables, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, t, isSeparatedSeating]);

  const autoSave = useCallback(
    (() => {
      let timeoutId;
      return (data = null) => {
       
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          saveSeatingArrangement(data);
        }, 1500);
      };
    })(),
    [saveSeatingArrangement]
  );

  const generateAISeating = useCallback(async (aiPreferences) => {
    try {
      setLoading(true);
   
      const requestBody = isSeparatedSeating ? {
        maleTables,
        femaleTables,
        preferences: { ...preferences, ...aiPreferences },
        guests: confirmedGuests,
        currentMaleArrangement: aiPreferences.preserveExisting ? maleArrangement : null,
        currentFemaleArrangement: aiPreferences.preserveExisting ? femaleArrangement : null,
        clearExisting: aiPreferences.clearExisting,
        preserveExisting: aiPreferences.preserveExisting,
        allMaleTables: aiPreferences.allMaleTables || maleTables,
        allFemaleTables: aiPreferences.allFemaleTables || femaleTables,
        isSeparatedSeating: true,
        useCustomTablesOnly: aiPreferences.useCustomTablesOnly,
        useMaleCustomTablesOnly: aiPreferences.useMaleCustomTablesOnly,
        useFemaleCustomTablesOnly: aiPreferences.useFemaleCustomTablesOnly
      } : {
        tables,
        preferences: { ...preferences, ...aiPreferences },
        guests: confirmedGuests,
        currentArrangement: aiPreferences.preserveExisting ? seatingArrangement : null,
        clearExisting: aiPreferences.clearExisting,
        preserveExisting: aiPreferences.preserveExisting,
        allTables: aiPreferences.allTables || tables,
        isSeparatedSeating: false,
        useCustomTablesOnly: aiPreferences.useCustomTablesOnly
      };
   
      const response = await makeApiRequest(`/api/events/${eventId}/seating/ai-generate`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (!response) {
        return false;
      }

      if (response.ok) {
        const data = await response.json();
     
        if (isSeparatedSeating) {
          setMaleArrangement(data.maleArrangement);
          setFemaleArrangement(data.femaleArrangement);
       
          let finalMaleTables = data.maleTables && data.maleTables.length > 0 ? data.maleTables : maleTables;
          let finalFemaleTables = data.femaleTables && data.femaleTables.length > 0 ? data.femaleTables : femaleTables;

          if (data.maleArrangement && Object.keys(data.maleArrangement).length > 0) {
            finalMaleTables = updateTableNamesWithGroups(finalMaleTables, data.maleArrangement);
          }
          if (data.femaleArrangement && Object.keys(data.femaleArrangement).length > 0) {
            finalFemaleTables = updateTableNamesWithGroups(finalFemaleTables, data.femaleArrangement);
          }

          setMaleTables(finalMaleTables);
          setFemaleTables(finalFemaleTables);
       
          setCanvasOffset({ x: 0, y: 0 });
          setCanvasScale(1);
       
          const layoutData = {
            maleTables: finalMaleTables,
            femaleTables: finalFemaleTables,
            maleArrangement: data.maleArrangement,
            femaleArrangement: data.femaleArrangement,
            isSeparatedSeating: true,
            preferences,
            layoutSettings: {
              canvasScale: 1,
              canvasOffset: { x: 0, y: 0 }
            }
          };
       
          autoSave(layoutData);
        } else {
          setSeatingArrangement(data.arrangement);
       
          let finalTables = data.tables && data.tables.length > 0 ? data.tables : tables;
       
          if (data.arrangement && Object.keys(data.arrangement).length > 0) {
            finalTables = updateTableNamesWithGroups(finalTables, data.arrangement);
          }
       
          setTables(finalTables);
       
          setCanvasOffset({ x: 0, y: 0 });
          setCanvasScale(1);
       
          const layoutData = {
            tables: finalTables,
            arrangement: data.arrangement,
            isSeparatedSeating: false,
            preferences,
            layoutSettings: {
              canvasScale: 1,
              canvasOffset: { x: 0, y: 0 }
            }
          };
       
          autoSave(layoutData);
        }
     
        setError('');
        setIsAIModalOpen(false);
     
        const newFingerprint = createGuestFingerprint(confirmedGuests);
        setLastSyncData(newFingerprint);
     
        return isSeparatedSeating ? {
          maleArrangement: data.maleArrangement,
          femaleArrangement: data.femaleArrangement,
          maleTables: data.maleTables,
          femaleTables: data.femaleTables
        } : {
          arrangement: data.arrangement,
          tables: data.tables
        };
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
  }, [eventId, makeApiRequest, tables, maleTables, femaleTables, preferences, confirmedGuests, seatingArrangement, maleArrangement, femaleArrangement, canvasScale, canvasOffset, autoSave, t, updateTableNamesWithGroups, createGuestFingerprint, isSeparatedSeating]);

  const fetchTableSuggestion = useCallback(async (options) => {

    try {
      const requestBody = {
        allowGroupMixing: options.allowGroupMixing,
        groupMixingRules: options.groupMixingRules,
        groupPolicies: options.groupPolicies,
        preferredTableSize: options.preferredTableSize || 12,
        isSeparatedSeating,
        existingTables: tables,
        existingMaleTables: maleTables,
        existingFemaleTables: femaleTables,
        existingArrangement: seatingArrangement,
        existingMaleArrangement: maleArrangement,
        existingFemaleArrangement: femaleArrangement,
        preserveExisting: options.preserveExisting
      };

      const response = await makeApiRequest(`/api/events/${eventId}/seating/suggest-tables`, {
        method: 'POST',
        body: JSON.stringify(requestBody)
      });

      if (response && response.ok) {
        const data = await response.json();
       
        return data;
      }
     
      return null;
    } catch (err) {
      return null;
    }
  }, [eventId, makeApiRequest, tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, isSeparatedSeating]);

  const calculateTableSize = useCallback((type, capacity) => {
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
  }, []);

  const checkTableCollision = useCallback((newPosition, newSize, allTables) => {
   
    const COLLISION_PADDING = 20;
   
    for (const existingTable of allTables) {
      if (!existingTable.position || !existingTable.size) continue;
     
      const existingPos = existingTable.position;
      const existingSize = existingTable.size;
     
      const newLeft = newPosition.x - (newSize.width / 2) - COLLISION_PADDING;
      const newRight = newPosition.x + (newSize.width / 2) + COLLISION_PADDING;
      const newTop = newPosition.y - (newSize.height / 2) - COLLISION_PADDING;
      const newBottom = newPosition.y + (newSize.height / 2) + COLLISION_PADDING;
     
      const existingLeft = existingPos.x - (existingSize.width / 2);
      const existingRight = existingPos.x + (existingSize.width / 2);
      const existingTop = existingPos.y - (existingSize.height / 2);
      const existingBottom = existingPos.y + (existingSize.height / 2);
     
      const hasCollision = !(newRight < existingLeft ||
                             newLeft > existingRight ||
                             newBottom < existingTop ||
                             newTop > existingBottom);
     
      if (hasCollision) {
        return { hasCollision: true, collidingTable: existingTable };
      }
    }
   
    return { hasCollision: false };
  }, []);

  const findNonCollidingPosition = useCallback((requestedPosition, tableSize, allTables) => {
   
    const collision = checkTableCollision(requestedPosition, tableSize, allTables);
    if (!collision.hasCollision) {
      return requestedPosition;
    }
   
    const STEP = 50;
    for (let radius = STEP; radius <= 500; radius += STEP) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
        const x = requestedPosition.x + Math.cos(angle) * radius;
        const y = requestedPosition.y + Math.sin(angle) * radius;
       
        const testPosition = { x, y };
        const testCollision = checkTableCollision(testPosition, tableSize, allTables);
       
        if (!testCollision.hasCollision) {
          return testPosition;
        }
      }
    }
   
    return requestedPosition;
  }, [checkTableCollision]);

  const addTable = useCallback((event, type = null, capacity = null) => {
   
    if (!canEdit) {
      setError(t('events.accessDenied'));
      return;
    }

    let position;
   
    if (event.constrainedPosition) {
      position = event.constrainedPosition;
    } else {
      position = { x: 300, y: 300 };
    }
   
    const finalCapacity = capacity || tableCapacity;
    const finalType = type || tableType;
    const tableSize = calculateTableSize(finalType, finalCapacity);
   
       
    if (isSeparatedSeating) {
      setTables(prevTables => {
        const allTables = [...prevTables, ...maleTables, ...femaleTables];

        const finalPosition = findNonCollidingPosition(position, tableSize, allTables);

        const tableNumbers = allTables.filter(t => !t.isDraft).map(table => {
          const match = table.name.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        const nextTableNumber = tableNumbers.length === 0 ? 1 : Math.max(...tableNumbers) + 1;

        const newTable = {
          id: `table_${Date.now()}`,
          name: `${t('seating.tableName')} ${nextTableNumber}`,
          type: finalType,
          capacity: finalCapacity,
          position: finalPosition,
          rotation: 0,
          size: tableSize,
          gender: null,
          notes: '',
          isDraft: true
        };

        const newTables = [...prevTables, newTable];

        setIsAddingTable(false);
        setSelectedTable(newTable);
        setEditingTable(newTable);
        setIsTableModalOpen(true);

        return newTables;
      });
    } else {
      setTables(prevTables => {
        const finalPosition = findNonCollidingPosition(position, tableSize, prevTables);

        const tableNumbers = prevTables.filter(t => !t.isDraft).map(table => {
          const match = table.name.match(/(\d+)/);
          return match ? parseInt(match[1], 10) : 0;
        });
        const nextTableNumber = tableNumbers.length === 0 ? 1 : Math.max(...tableNumbers) + 1;

        const newTable = {
          id: `table_${Date.now()}`,
          name: `${t('seating.tableName')} ${nextTableNumber}`,
          type: finalType,
          capacity: finalCapacity,
          position: finalPosition,
          rotation: 0,
          size: tableSize,
          gender: null,
          notes: '',
          isDraft: true
        };

        const newTables = [...prevTables, newTable];

        setIsAddingTable(false);
        setSelectedTable(newTable);
        setEditingTable(newTable);
        setIsTableModalOpen(true);

        return newTables;
      });
    }
   
  }, [maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, t, calculateTableSize, canEdit, isSeparatedSeating, tableCapacity, tableType]);

  const handleAddTablesFromAI = useCallback(async (tablesToAdd, gender = null) => {
    try {
      if (isSeparatedSeating && gender) {
        if (gender === 'male') {
          const existingIds = new Set(maleTables.map(t => t.id));
          const trulyNewTables = tablesToAdd.filter(t => !existingIds.has(t.id));
          const updatedExistingTables = maleTables.map(existingTable => {
            const update = tablesToAdd.find(t => t.id === existingTable.id);
            return update ? { ...existingTable, ...update } : existingTable;
          });
          const newMaleTables = [...updatedExistingTables, ...trulyNewTables];
          setMaleTables(newMaleTables);
         
          const layoutData = {
            maleTables: newMaleTables,
            femaleTables,
            maleArrangement,
            femaleArrangement,
            isSeparatedSeating: true,
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
            setMaleTables(maleTables);
            throw new Error(t('seating.errors.saveTablesFailed'));
          }
        } else {
          const existingIds = new Set(femaleTables.map(t => t.id));
          const trulyNewTables = tablesToAdd.filter(t => !existingIds.has(t.id));
          const updatedExistingTables = femaleTables.map(existingTable => {
            const update = tablesToAdd.find(t => t.id === existingTable.id);
            return update ? { ...existingTable, ...update } : existingTable;
          });
          const newFemaleTables = [...updatedExistingTables, ...trulyNewTables];
          setFemaleTables(newFemaleTables);
         
          const layoutData = {
            maleTables,
            femaleTables: newFemaleTables,
            maleArrangement,
            femaleArrangement,
            isSeparatedSeating: true,
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
            setFemaleTables(femaleTables);
            throw new Error(t('seating.errors.saveTablesFailed'));
          }
        }
      } else {
        const existingIds = new Set(tables.map(t => t.id));
        const trulyNewTables = tablesToAdd.filter(t => !existingIds.has(t.id));
       
        const updatedExistingTables = tables.map(existingTable => {
          const update = tablesToAdd.find(t => t.id === existingTable.id);
          return update ? { ...existingTable, ...update } : existingTable;
        });
       
        const newTables = [...updatedExistingTables, ...trulyNewTables];
        setTables(newTables);
       
        const layoutData = {
          tables: newTables,
          arrangement: seatingArrangement,
          isSeparatedSeating: false,
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
      }
    } catch (err) {
      setError(t('seating.errors.addTablesError'));
      return false;
    }
  }, [tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, t, isSeparatedSeating]);

  const handleAddTableFromView = useCallback((newTable) => {
   
    const nextTableNumber = getNextTableNumber();
   
    const allExistingTables = [...tables, ...maleTables, ...femaleTables];
    const defaultPosition = { x: 1100, y: 300 };
    const tableSize = newTable.size || { width: 100, height: 100 };
   
    const finalPosition = findNonCollidingPosition(defaultPosition, tableSize, allExistingTables);
       
    const tableWithCorrectName = {
      ...newTable,
      name: `${t('seating.tableName')} ${nextTableNumber}`,
      notes: newTable.notes || '',
      position: finalPosition,
      size: tableSize,
      fromTableView: true,
      autoPositioned: false,
      isDraft: true
    };
       
    if (isSeparatedSeating && genderFilter !== 'all') {
      if (genderFilter === 'male') {
        const newMaleTables = [...maleTables, tableWithCorrectName];

        setMaleTables(newMaleTables);

        setSelectedTable(tableWithCorrectName);
        setEditingTable(tableWithCorrectName);
        setIsTableModalOpen(true);

      } else {
        const newFemaleTables = [...femaleTables, tableWithCorrectName];

        setFemaleTables(newFemaleTables);

        setSelectedTable(tableWithCorrectName);
        setEditingTable(tableWithCorrectName);
        setIsTableModalOpen(true);
      }
    } else {
      const newTables = [...tables, tableWithCorrectName];

      setTables(newTables);

      setSelectedTable(tableWithCorrectName);
      setEditingTable(tableWithCorrectName);
      setIsTableModalOpen(true);
    }
   
  }, [tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, t, isSeparatedSeating, genderFilter, getNextTableNumber]);

  const updateTable = useCallback((tableId, updates) => {    
    if (!canEdit) {
      setError(t('events.accessDenied'));
      return;
    }

    if (isSeparatedSeating) {
      const isInMaleTables = maleTables.some(t => t.id === tableId);
      const isInFemaleTables = femaleTables.some(t => t.id === tableId);
   
      if (isInMaleTables) {
        let newMaleTables;
        let newMaleArrangement = { ...maleArrangement };
     
        if (updates === null) {
          newMaleTables = maleTables.filter(table => table.id !== tableId);
          delete newMaleArrangement[tableId];
          setSelectedTable(null);
       
          const newEditedNames = new Set(manuallyEditedTableNames);
          newEditedNames.delete(tableId);
          setManuallyEditedTableNames(newEditedNames);
        } else {
          const currentTable = maleTables.find(t => t.id === tableId);
       
          if (updates.name && currentTable && updates.name !== currentTable.name) {
            const tableNumber = parseInt(currentTable.name.match(/\d+/)?.[0] || '1');
            const autoGeneratedName = generateTableNameWithGroup(tableNumber, tableId, maleArrangement, 'male');
         
            if (updates.name !== autoGeneratedName && updates.name !== currentTable.name) {
              const newEditedNames = new Set(manuallyEditedTableNames);
              newEditedNames.add(tableId);
              setManuallyEditedTableNames(newEditedNames);
            }
          }
       
          newMaleTables = maleTables.map(table =>
            table.id === tableId ? { ...table, ...updates } : table
          );
         
        }
     
        setMaleTables(newMaleTables);
        setMaleArrangement(newMaleArrangement);
       
        const dataToSave = {
          tables,
          arrangement: seatingArrangement,
          maleTables: newMaleTables,
          femaleTables,
          maleArrangement: newMaleArrangement,
          femaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        };
       
        saveSeatingArrangement(dataToSave)
       
      } else if (isInFemaleTables) {
        let newFemaleTables;
        let newFemaleArrangement = { ...femaleArrangement };
     
        if (updates === null) {
          newFemaleTables = femaleTables.filter(table => table.id !== tableId);
          delete newFemaleArrangement[tableId];
          setSelectedTable(null);
       
          const newEditedNames = new Set(manuallyEditedTableNames);
          newEditedNames.delete(tableId);
          setManuallyEditedTableNames(newEditedNames);
        } else {
          const currentTable = femaleTables.find(t => t.id === tableId);
       
          if (updates.name && currentTable && updates.name !== currentTable.name) {
            const tableNumber = parseInt(currentTable.name.match(/\d+/)?.[0] || '1');
            const autoGeneratedName = generateTableNameWithGroup(tableNumber, tableId, femaleArrangement, 'female');
         
            if (updates.name !== autoGeneratedName && updates.name !== currentTable.name) {
              const newEditedNames = new Set(manuallyEditedTableNames);
              newEditedNames.add(tableId);
              setManuallyEditedTableNames(newEditedNames);
            }
          }
       
          newFemaleTables = femaleTables.map(table =>
            table.id === tableId ? { ...table, ...updates } : table
          );
         
        }
     
        setFemaleTables(newFemaleTables);
        setFemaleArrangement(newFemaleArrangement);
       
        const dataToSave = {
          tables,
          arrangement: seatingArrangement,
          maleTables,
          femaleTables: newFemaleTables,
          maleArrangement,
          femaleArrangement: newFemaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        };
       
        saveSeatingArrangement(dataToSave)
       
      } else {
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
       
        const dataToSave = {
          tables: newTables,
          arrangement: newArrangement,
          maleTables,
          femaleTables,
          maleArrangement,
          femaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        };
       
        saveSeatingArrangement(dataToSave)
      }
    } else {
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
     
      const dataToSave = {
        tables: newTables,
        arrangement: newArrangement,
        isSeparatedSeating: false,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      };
     
      saveSeatingArrangement(dataToSave)
    }
   
  }, [tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, manuallyEditedTableNames, generateTableNameWithGroup, canEdit, isSeparatedSeating, calculateTableSize, t]);

  const deleteTable = useCallback((tableId) => {
    if (!canEdit) {
      setError(t('events.accessDenied'));
      return;
    }

    if (isSeparatedSeating) {
      const isInMaleTables = maleTables.some(t => t.id === tableId);
      const isInFemaleTables = femaleTables.some(t => t.id === tableId);
      const isInNeutralTables = tables.some(t => t.id === tableId);

      if (isInMaleTables) {
        const newMaleTables = maleTables.filter(table => table.id !== tableId);
        const newMaleArrangement = { ...maleArrangement };
        delete newMaleArrangement[tableId];

        const newEditedNames = new Set(manuallyEditedTableNames);
        newEditedNames.delete(tableId);
        setManuallyEditedTableNames(newEditedNames);

        setMaleTables(newMaleTables);
        setMaleArrangement(newMaleArrangement);

        saveSeatingArrangement({
          maleTables: newMaleTables,
          femaleTables,
          maleArrangement: newMaleArrangement,
          femaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        });
      } else if (isInFemaleTables) {
        const newFemaleTables = femaleTables.filter(table => table.id !== tableId);
        const newFemaleArrangement = { ...femaleArrangement };
        delete newFemaleArrangement[tableId];

        const newEditedNames = new Set(manuallyEditedTableNames);
        newEditedNames.delete(tableId);
        setManuallyEditedTableNames(newEditedNames);

        setFemaleTables(newFemaleTables);
        setFemaleArrangement(newFemaleArrangement);

        saveSeatingArrangement({
          maleTables,
          femaleTables: newFemaleTables,
          maleArrangement,
          femaleArrangement: newFemaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        });
      } else if (isInNeutralTables) {
        const newTables = tables.filter(table => table.id !== tableId);
        const newArrangement = { ...seatingArrangement };
        delete newArrangement[tableId];

        const newEditedNames = new Set(manuallyEditedTableNames);
        newEditedNames.delete(tableId);
        setManuallyEditedTableNames(newEditedNames);

        setTables(newTables);
        setSeatingArrangement(newArrangement);

        saveSeatingArrangement({
          tables: newTables,
          arrangement: newArrangement,
          maleTables,
          femaleTables,
          maleArrangement,
          femaleArrangement,
          isSeparatedSeating: true,
          preferences,
          layoutSettings: {
            canvasScale,
            canvasOffset
          }
        });
      }
    } else {
      const newTables = tables.filter(table => table.id !== tableId);
      const newArrangement = { ...seatingArrangement };
      delete newArrangement[tableId];

      const newEditedNames = new Set(manuallyEditedTableNames);
      newEditedNames.delete(tableId);
      setManuallyEditedTableNames(newEditedNames);

      setTables(newTables);
      setSeatingArrangement(newArrangement);

      saveSeatingArrangement({
        tables: newTables,
        arrangement: newArrangement,
        isSeparatedSeating: false,
        preferences,
        layoutSettings: {
          canvasScale,
          canvasOffset
        }
      });
    }
  }, [tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, canvasScale, canvasOffset, saveSeatingArrangement, manuallyEditedTableNames, canEdit, isSeparatedSeating]);

  const repositionTableByGender = useCallback((table, newGender, existingGenderTables, shouldReposition = true) => {

    if (!shouldReposition && !table.fromTableView) {
      return {
        ...table,
        gender: newGender
      };
    }
   
    const calculateNextAvailablePosition = (targetGender) => {
      const startX = targetGender === 'male' ? 300 : 1200;
      const startY = 250;
      const spacing = 200;
      const cols = 3;

      const allExistingTables = [
        ...(tables || []),
        ...(maleTables || []),
        ...(femaleTables || [])
      ];

      const occupiedPositions = new Set();
      allExistingTables.forEach(t => {
        if (t.id === table.id) {
          return;
        }
       
        if (t.position) {
          const posKey = `${Math.round(t.position.x)},${Math.round(t.position.y)}`;
          occupiedPositions.add(posKey);
        }
      });

      let position = 0;
      while (position < 100) {
        const row = Math.floor(position / cols);
        const col = position % cols;
        const x = startX + col * spacing;
        const y = startY + row * spacing;
        const posKey = `${x},${y}`;
       
        if (!occupiedPositions.has(posKey)) {
          return { x, y };
        }
        position++;
      }

      const lastRow = Math.floor(allExistingTables.length / cols);
      const lastCol = allExistingTables.length % cols;
      return {
        x: startX + lastCol * spacing,
        y: startY + lastRow * spacing
      };
    };
   
    const newPosition = calculateNextAvailablePosition(newGender);
   
    const repositionedTable = {
      ...table,
      gender: newGender,
      position: newPosition
    };
 
    return repositionedTable;
  }, [tables, maleTables, femaleTables]);

  const seatGuest = useCallback((guestId, tableId) => {

    if (!canEdit) {
      setError(t('events.accessDenied'));
      return false;
    }

    let draggedGender = null;
    if (guestId.endsWith('_male')) {
      draggedGender = 'male';
    } else if (guestId.endsWith('_female')) {
      draggedGender = 'female';
    }
   
    const actualGuestId = guestId.replace('_male', '').replace('_female', '');
   
    let guest;
   
    if (draggedGuest) {
      if (draggedGuest._id === guestId || draggedGuest.originalId === actualGuestId) {
        guest = draggedGuest;
       
        if (!draggedGender && guest.displayGender) {
          draggedGender = guest.displayGender;
        } else if (!draggedGender && guest.gender) {
          draggedGender = guest.gender;
        }
      }
    }
   
    if (!guest) {
      const baseGuest = confirmedGuests.find(g => g._id === actualGuestId);
     
      if (!baseGuest) {
        return false;
      }
     
      if (isSeparatedSeating) {
        if (!draggedGender) {
          if (baseGuest.maleCount > 0 && (!baseGuest.femaleCount || baseGuest.femaleCount === 0)) {
            draggedGender = 'male';
          } else if (baseGuest.femaleCount > 0 && (!baseGuest.maleCount || baseGuest.maleCount === 0)) {
            draggedGender = 'female';
          } else if (baseGuest.gender) {
            draggedGender = baseGuest.gender;
          } else {
            setError(t('seating.errors.cannotDetermineGender'));
            return false;
          }
        }
       
        guest = {
          ...baseGuest,
          _id: `${baseGuest._id}_${draggedGender}`,
          originalId: baseGuest._id,
          displayGender: draggedGender,
          gender: draggedGender,
          attendingCount: draggedGender === 'male' ? (baseGuest.maleCount || 0) : (baseGuest.femaleCount || 0),
          maleCount: draggedGender === 'male' ? (baseGuest.maleCount || 0) : 0,
          femaleCount: draggedGender === 'female' ? (baseGuest.femaleCount || 0) : 0
        };
      } else {
        guest = baseGuest;
      }
    }
   
    if (!guest) {
      return false;
    }

    if (isSeparatedSeating) {
     
      if (!draggedGender) {
        setError(t('seating.errors.cannotDetermineGender'));
        return false;
      }
     
      let table = tables.find(t => t.id === tableId);
      let isNeutralTable = !!table;
      let isInMaleTables = false;
      let isInFemaleTables = false;
      let currentTables = tables;
      let currentArrangement = seatingArrangement || {};
     
      if (!table) {
        table = maleTables.find(t => t.id === tableId);
        if (table) {
          isInMaleTables = true;
          currentTables = maleTables;
          currentArrangement = maleArrangement || {};
        } else {
          table = femaleTables.find(t => t.id === tableId);
          if (table) {
            isInFemaleTables = true;
            currentTables = femaleTables;
            currentArrangement = femaleArrangement || {};
          }
        }
      }
     
      if (!table) {
        setError(t('seating.errors.tableNotFound'));
        return false;
      }
     
      if (isNeutralTable) {
       
        const seatedGuests = currentArrangement[tableId] || [];
       
        if (seatedGuests.length === 0) {
         
          const newTables = tables.filter(t => t.id !== tableId);
         
          const isManuallyPlaced = table.position &&
            (table.position.x !== 300 || table.position.y !== 300) &&
            !table.fromTableView;
                   
          const tableWithGender = repositionTableByGender(
            table,
            draggedGender,
            draggedGender === 'male' ? maleTables : femaleTables,
            !isManuallyPlaced
          );
                   
          if (draggedGender === 'male') {
            const newMaleTables = [...maleTables, tableWithGender];
            const newMaleArrangement = { ...maleArrangement, [tableId]: [actualGuestId] };
           
            const updatedMaleTables = updateTableNamesWithGroups(newMaleTables, newMaleArrangement);
           
            setTables(newTables);
            setMaleTables(updatedMaleTables);
            setMaleArrangement(newMaleArrangement);
           
            autoSave({
              tables: newTables,
              arrangement: seatingArrangement,
              maleTables: updatedMaleTables,
              femaleTables,
              maleArrangement: newMaleArrangement,
              femaleArrangement,
              isSeparatedSeating: true,
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
           
            setError('');
            return true;
           
          } else if (draggedGender === 'female') {
            const newFemaleTables = [...femaleTables, tableWithGender];
            const newFemaleArrangement = { ...femaleArrangement, [tableId]: [actualGuestId] };
           
            const updatedFemaleTables = updateTableNamesWithGroups(newFemaleTables, newFemaleArrangement);
           
            setTables(newTables);
            setFemaleTables(updatedFemaleTables);
            setFemaleArrangement(newFemaleArrangement);
           
            autoSave({
              tables: newTables,
              arrangement: seatingArrangement,
              maleTables,
              femaleTables: updatedFemaleTables,
              maleArrangement,
              femaleArrangement: newFemaleArrangement,
              isSeparatedSeating: true,
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
           
            setError('');
            return true;
          }
        } else {
          setError(t('seating.errors.neutralTableOccupied'));
          return false;
        }
      }
     
      if ((draggedGender === 'male' && !isInMaleTables) ||
          (draggedGender === 'female' && !isInFemaleTables)) {
        setError(t('seating.errors.genderMismatch'));
        return false;
      }

      const currentSeatedAtTable = currentArrangement[tableId] || [];
     
      const currentOccupancy = currentSeatedAtTable.reduce((sum, seatedGuestId) => {
        const g = confirmedGuests.find(guest => guest._id === seatedGuestId);
        if (!g) return sum;
       
        if (draggedGender === 'male') {
          return sum + (g.maleCount || 0);
        } else {
          return sum + (g.femaleCount || 0);
        }
      }, 0);
     
      const peopleToAdd = guest.attendingCount || 1;

      if (currentOccupancy + peopleToAdd > table.capacity) {
        setError(t('seating.errors.tableOvercapacity', {
          table: table.name,
          capacity: table.capacity,
          needed: peopleToAdd,
          available: table.capacity - currentOccupancy
        }));
        return false;
      }

      const newArrangement = { ...currentArrangement };
     
      Object.keys(newArrangement).forEach(tId => {
        newArrangement[tId] = newArrangement[tId].filter(id => id !== actualGuestId);
        if (newArrangement[tId].length === 0) {
          delete newArrangement[tId];
        }
      });

      if (!newArrangement[tableId]) {
        newArrangement[tableId] = [];
      }
     
      if (!newArrangement[tableId].includes(actualGuestId)) {
        newArrangement[tableId].push(actualGuestId);
      }
     
      if (draggedGender === 'male') {
        setMaleArrangement(newArrangement);
       
        setTimeout(() => {
          const updatedTables = updateTableNamesWithGroups(currentTables, newArrangement);
          setMaleTables(updatedTables);
         
          autoSave({
            tables,
            arrangement: seatingArrangement,
            maleTables: updatedTables,
            femaleTables,
            maleArrangement: newArrangement,
            femaleArrangement,
            isSeparatedSeating: true,
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
      } else {
        setFemaleArrangement(newArrangement);
       
        setTimeout(() => {
          const updatedTables = updateTableNamesWithGroups(currentTables, newArrangement);
          setFemaleTables(updatedTables);
         
          autoSave({
            tables,
            arrangement: seatingArrangement,
            maleTables,
            femaleTables: updatedTables,
            maleArrangement,
            femaleArrangement: newArrangement,
            isSeparatedSeating: true,
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
      }
     
      setError('');
      return true;
     
    } else {
     
      const table = tables.find(t => t.id === tableId);
      if (!table) {
        return false;
      }

      const currentSeatedAtTable = seatingArrangement[tableId] || [];
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
        newArrangement[tId] = newArrangement[tId].filter(id => id !== actualGuestId);
        if (newArrangement[tId].length === 0) {
          delete newArrangement[tId];
        }
      });

      if (!newArrangement[tableId]) {
        newArrangement[tableId] = [];
      }
     
      if (!newArrangement[tableId].includes(actualGuestId)) {
        newArrangement[tableId].push(actualGuestId);
      }

      setSeatingArrangement(newArrangement);
     
      setTimeout(() => {
        const updatedTables = updateTableNamesWithGroups(tables, newArrangement);
        setTables(updatedTables);
       
        autoSave({
          tables: updatedTables,
          arrangement: newArrangement,
          isSeparatedSeating: false,
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
     
      setError('');
      return true;
    }
  }, [canEdit, t, confirmedGuests, draggedGuest, isSeparatedSeating, tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, updateTableNamesWithGroups, autoSave, preferences, canvasScale, canvasOffset, lastSyncData, createGuestFingerprint, repositionTableByGender]);

  const unseatGuest = useCallback((guestIdParam) => {
   
    const guestId = guestIdParam.toString().replace(/_male$|_female$/, '');
    const gender = guestIdParam.toString().includes('_male') ? 'male'
                : guestIdParam.toString().includes('_female') ? 'female'
                : null;

    if (isSeparatedSeating && gender) {
      if (gender === 'male') {
       
        const updatedMaleArrangement = { ...maleArrangement };
        let emptyTableIds = [];
       
        Object.keys(updatedMaleArrangement).forEach(tableId => {
          const beforeLength = updatedMaleArrangement[tableId].length;
          updatedMaleArrangement[tableId] = updatedMaleArrangement[tableId].filter(id => id !== guestId);
          const afterLength = updatedMaleArrangement[tableId].length;
                   
          if (updatedMaleArrangement[tableId].length === 0) {
            delete updatedMaleArrangement[tableId];
            emptyTableIds.push(tableId);          }
        });
               
        let updatedMaleTables = [...maleTables];
        let updatedNeutralTables = [...tables];
       
        emptyTableIds.forEach(tableId => {
          const tableIndex = updatedMaleTables.findIndex(t => t.id === tableId);
         
          if (tableIndex !== -1) {
            const table = updatedMaleTables[tableIndex];
           
            const neutralTable = { ...table };
            delete neutralTable.gender;
           
            const tableNumber = neutralTable.name.match(/\d+/)?.[0] || '1';
            neutralTable.name = `${t('seating.tableName')} ${tableNumber}`;
           
            const newEditedNames = new Set(manuallyEditedTableNames);
            newEditedNames.delete(tableId);
            setManuallyEditedTableNames(newEditedNames);
                       
            updatedNeutralTables.push(neutralTable);
            updatedMaleTables.splice(tableIndex, 1);
           
            if (editingTable && editingTable.id === tableId) {
              setIsTableModalOpen(false);
              setEditingTable(null);
              setSelectedTable(null);
            }
           
          }
        });
       
        updatedMaleTables = updateTableNamesWithGroups(updatedMaleTables, updatedMaleArrangement, 'male');
       
        updatedNeutralTables = updateTableNamesWithGroups(updatedNeutralTables, seatingArrangement, null);
       
        setMaleArrangement(updatedMaleArrangement);
        setMaleTables(updatedMaleTables);
        setTables(updatedNeutralTables);
               
        const dataToSave = {
          tables: updatedNeutralTables || [],
          arrangement: seatingArrangement || {},
          maleTables: updatedMaleTables || [],
          femaleTables: femaleTables || [],
          maleArrangement: updatedMaleArrangement || {},
          femaleArrangement: femaleArrangement || {},
          isSeparatedSeating: true,
          preferences,
          layoutSettings: { canvasScale, canvasOffset }
        };
       
        saveSeatingArrangement(dataToSave);
       
      } else if (gender === 'female') {
       
        const updatedFemaleArrangement = { ...femaleArrangement };
        let emptyTableIds = [];
       
        Object.keys(updatedFemaleArrangement).forEach(tableId => {
          const beforeLength = updatedFemaleArrangement[tableId].length;
          updatedFemaleArrangement[tableId] = updatedFemaleArrangement[tableId].filter(id => id !== guestId);
          const afterLength = updatedFemaleArrangement[tableId].length;
                   
          if (updatedFemaleArrangement[tableId].length === 0) {
            delete updatedFemaleArrangement[tableId];
            emptyTableIds.push(tableId);
          }
        });
               
        let updatedFemaleTables = [...femaleTables];
        let updatedNeutralTables = [...tables];
               
        emptyTableIds.forEach(tableId => {
          const tableIndex = updatedFemaleTables.findIndex(t => t.id === tableId);
         
          if (tableIndex !== -1) {
            const table = updatedFemaleTables[tableIndex];
           
            const neutralTable = { ...table };
            delete neutralTable.gender;
           
            const tableNumber = neutralTable.name.match(/\d+/)?.[0] || '1';
            neutralTable.name = `${t('seating.tableName')} ${tableNumber}`;
           
            const newEditedNames = new Set(manuallyEditedTableNames);
            newEditedNames.delete(tableId);
            setManuallyEditedTableNames(newEditedNames);
                       
            updatedNeutralTables.push(neutralTable);
            updatedFemaleTables.splice(tableIndex, 1);
           
            if (editingTable && editingTable.id === tableId) {
              setIsTableModalOpen(false);
              setEditingTable(null);
              setSelectedTable(null);
            }
           
          }
        });
       
        updatedFemaleTables = updateTableNamesWithGroups(updatedFemaleTables, updatedFemaleArrangement, 'female');
       
        updatedNeutralTables = updateTableNamesWithGroups(updatedNeutralTables, seatingArrangement, null);
       
        setFemaleArrangement(updatedFemaleArrangement);
        setFemaleTables(updatedFemaleTables);
        setTables(updatedNeutralTables);
       
        const dataToSave = {
          tables: updatedNeutralTables || [],
          arrangement: seatingArrangement || {},
          maleTables: maleTables || [],
          femaleTables: updatedFemaleTables || [],
          maleArrangement: maleArrangement || {},
          femaleArrangement: updatedFemaleArrangement || {},
          isSeparatedSeating: true,
          preferences,
          layoutSettings: { canvasScale, canvasOffset }
        };
       
        saveSeatingArrangement(dataToSave);
      }
    } else {
      const updatedArrangement = { ...seatingArrangement };
      Object.keys(updatedArrangement).forEach(tableId => {
        updatedArrangement[tableId] = updatedArrangement[tableId].filter(id => id !== guestId);
        if (updatedArrangement[tableId].length === 0) {
          delete updatedArrangement[tableId];
        }
      });
      setSeatingArrangement(updatedArrangement);
     
      const dataToSave = {
        tables,
        arrangement: updatedArrangement,
        isSeparatedSeating: false,
        preferences,
        layoutSettings: { canvasScale, canvasOffset }
      };
      saveSeatingArrangement(dataToSave);
    }
  }, [seatingArrangement, isSeparatedSeating, maleArrangement, femaleArrangement, saveSeatingArrangement, tables, maleTables, femaleTables, preferences, canvasScale, canvasOffset, t, manuallyEditedTableNames, updateTableNamesWithGroups, editingTable]);

 
const clearAllSeating = useCallback(() => {
  if (!canEdit) {
    setError(t('events.accessDenied'));
    return;
  }

  const hasAnythingToDelete = isSeparatedSeating
    ? (maleArrangement && Object.keys(maleArrangement).length > 0) ||
      (femaleArrangement && Object.keys(femaleArrangement).length > 0) ||
      (maleTables && maleTables.length > 0) ||
      (femaleTables && femaleTables.length > 0) ||
      (tables && tables.length > 0) ||
      (seatingArrangement && Object.keys(seatingArrangement).length > 0)
    : (tables && tables.length > 0) ||
      (seatingArrangement && Object.keys(seatingArrangement).length > 0);

  if (!hasAnythingToDelete) return;

  setIsClearModalOpen(true);
}, [canEdit, isSeparatedSeating, maleArrangement, femaleArrangement, maleTables, femaleTables, tables, seatingArrangement, t]);

  const handleConfirmClearAll = useCallback(() => {
    if (isSeparatedSeating) {
      setMaleArrangement({});
      setFemaleArrangement({});
      setMaleTables([]);
      setFemaleTables([]);
      setTables([]);
      setSeatingArrangement({});
     
      autoSave({
        tables: [],
        arrangement: {},
        maleTables: [],
        femaleTables: [],
        maleArrangement: {},
        femaleArrangement: {},
        isSeparatedSeating: true,
        preferences,
        layoutSettings: { canvasScale, canvasOffset }
      });
    } else {
      setSeatingArrangement({});
      setTables([]);
     
      autoSave({
        tables: [],
        arrangement: {},
        isSeparatedSeating: false,
        preferences,
        layoutSettings: { canvasScale, canvasOffset }
      });
    }
   
    setSelectedTable(null);
    setEditingTable(null);
    setError('');
    setManuallyEditedTableNames(new Set());
    setLastSyncData(null);
   
    setIsClearModalOpen(false);
  }, [isSeparatedSeating, preferences, canvasScale, canvasOffset, autoSave]);

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
      const exportData = isSeparatedSeating ? {
        maleTables,
        femaleTables,
        maleArrangement,
        femaleArrangement,
        guests: confirmedGuests,
        isSeparatedSeating: true
      } : {
        tables,
        arrangement: seatingArrangement,
        guests: confirmedGuests,
        isSeparatedSeating: false
      };

      const response = await makeApiRequest(`/api/events/${eventId}/seating/export?format=${format}`, {
        method: 'POST',
        body: JSON.stringify(exportData)
      });

      if (!response) return;

      if (response.ok) {
        const data = await response.json();
     
        switch (format) {
          case 'pdf':
            handlePrintExport(data);
            break;
          case 'excel':
            handleCSVExport(data);
            break;
          case 'png':
            handlePNGExport();
            break;
          default:
            setError(t('seating.errors.invalidFormat'));
        }
      }
    } catch (err) {
      setError(t('seating.errors.exportFailed'));
    }
  }, [eventId, makeApiRequest, t, isSeparatedSeating, maleTables, femaleTables, maleArrangement, femaleArrangement, confirmedGuests, tables, seatingArrangement]);

  const handlePrintExport = useCallback((data) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setError(t('seating.errors.popupBlocked'));
      return;
    }

    const isSeparated = data.isSeparatedSeating;
   
    let tableRows = '';
    let actualOccupiedTables = 0;
    let actualTotalTables = 0;
    let actualSeatedPeople = 0;
   
    if (isSeparated) {
      const maleTableRows = (data.maleTables || []).map(table => {
        const guestsList = table.guests.map(guest =>
          `${guest.name} (${guest.attendingCount})`
        ).join(', ');
     
        const totalPeople = table.guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
        if (table.guests.length > 0) actualOccupiedTables++;
        actualSeatedPeople += totalPeople;
     
        return `
          <tr>
            <td>${table.name}</td>
            <td>${t('seating.genderFilter.male')}</td>
            <td>${table.capacity}</td>
            <td>${totalPeople}</td>
            <td>${guestsList || t('seating.export.noGuests')}</td>
          </tr>
        `;
      }).join('');
     
      const femaleTableRows = (data.femaleTables || []).map(table => {
        const guestsList = table.guests.map(guest =>
          `${guest.name} (${guest.attendingCount})`
        ).join(', ');
     
        const totalPeople = table.guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
        if (table.guests.length > 0) actualOccupiedTables++;
        actualSeatedPeople += totalPeople;
     
        return `
          <tr>
            <td>${table.name}</td>
            <td>${t('seating.genderFilter.female')}</td>
            <td>${table.capacity}</td>
            <td>${totalPeople}</td>
            <td>${guestsList || t('seating.export.noGuests')}</td>
          </tr>
        `;
      }).join('');
     
      tableRows = maleTableRows + femaleTableRows;
      actualTotalTables = (data.maleTables || []).length + (data.femaleTables || []).length;
     
    } else {
      tableRows = data.tables.map(table => {
        const guestsList = table.guests.map(guest =>
          `${guest.name} (${guest.attendingCount})`
        ).join(', ');
     
        const totalPeople = table.guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
     
        return `
          <tr>
            <td>${table.name}</td>
            <td>${table.capacity}</td>
            <td>${totalPeople}</td>
            <td>${guestsList || t('seating.export.noGuests')}</td>
          </tr>
        `;
      }).join('');
     
      actualOccupiedTables = data.tables.filter(table =>
        table.guests && table.guests.length > 0
      ).length;
     
      actualTotalTables = data.tables.length;
     
      actualSeatedPeople = data.tables.reduce((sum, table) =>
        sum + table.guests.reduce((guestSum, g) => guestSum + (g.attendingCount || 1), 0), 0
      );
    }

    const eventDate = data.event.date ? new Date(data.event.date).toLocaleDateString('he-IL') : '';

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <title>${t('seating.export.title')} - ${data.event.name || ''}</title>
        <style>
          @media print {
            body { margin: 0; padding: 20px; }
            .no-print { display: none !important; }
          }
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .header h1 {
            margin: 10px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: right;
          }
          th {
            background-color: #f4f4f4;
            font-weight: bold;
          }
          .print-button {
            margin: 20px 0;
            padding: 10px 20px;
            background: #007bff;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 16px;
          }
          .print-button:hover {
            background: #0056b3;
          }
          .statistics {
            margin-top: 30px;
          }
          .statistics h3 {
            margin-bottom: 15px;
          }
          .statistics p {
            margin: 8px 0;
          }
        </style>
      </head>
      <body>
        <button onclick="window.print()" class="print-button no-print">
          ${t('seating.export.print')}
        </button>
        <div class="header">
          <h1>${t('seating.export.title')}</h1>
          ${data.event.name ? `<h2>${data.event.name}</h2>` : ''}
          ${eventDate ? `<p>${eventDate}</p>` : ''}
          ${isSeparated ? `<p><strong>${t('seating.separatedSeating.label')}</strong></p>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th>${t('seating.export.tableName')}</th>
              ${isSeparated ? `<th>${t('seating.gender')}</th>` : ''}
              <th>${t('seating.export.capacity')}</th>
              <th>${t('seating.export.totalPeople')}</th>
              <th>${t('seating.export.guests')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="statistics">
          <h3>${t('seating.export.statistics')}</h3>
          <p>${t('seating.stats.totalTables')}: ${actualTotalTables}</p>
          <p>${t('seating.stats.occupiedTables')}: ${actualOccupiedTables}</p>
          <p>${t('seating.stats.totalGuests')}: ${data.statistics.totalPeople || 0}</p>
          <p>${t('seating.stats.seatedGuests')}: ${actualSeatedPeople}</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }, [t]);

  const handleCSVExport = useCallback((data) => {
    const BOM = '\uFEFF';

    const isSeparated = data.isSeparatedSeating;
    let allTables = [];
   
    if (isSeparated) {
      allTables = [...(data.maleTables || []), ...(data.femaleTables || [])];
    } else {
      allTables = data.tables || [];
    }
   
    if (allTables.length === 0) {
      setError(t('seating.errors.noTables'));
      return;
    }

    const headers = allTables.map(table => {
      if (isSeparated) {
        const gender = (data.maleTables || []).some(t => t.name === table.name)
          ? t('seating.genderFilter.male')
          : t('seating.genderFilter.female');
        return `${table.name} (${gender})`;
      }
      return table.name;
    });

    const maxGuestsInTable = Math.max(...allTables.map(table => table.guests.length), 0);

    const rows = [];
    for (let i = 0; i < maxGuestsInTable; i++) {
      const row = allTables.map(table => {
        if (table.guests[i]) {
          const guest = table.guests[i];
          return `${guest.name} (${guest.attendingCount})`;
        }
        return '';
      });
      rows.push(row);
    }

    const summaryRow = allTables.map(table => {
      const totalPeople = table.guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
      return `="${totalPeople}/${table.capacity}"`;
    });

    const csvContent = BOM + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
      summaryRow.join(',')
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `seating-chart-${data.event.name || 'event'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }, [t]);

  const handlePNGExport = useCallback(() => {
    const canvasContainer = document.querySelector('.seating-canvas-container');
    if (!canvasContainer) {
      setError(t('seating.errors.canvasNotFound'));
      return;
    }

    const canvas = canvasContainer.querySelector('canvas');
    if (!canvas) {
      const svgElement = canvasContainer.querySelector('svg');
      if (svgElement) {
        exportSVGAsPNG(svgElement);
        return;
      }
      setError(t('seating.errors.canvasNotFound'));
      return;
    }

    canvas.toBlob((blob) => {
      if (!blob) {
        setError(t('seating.errors.exportFailed'));
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `seating-chart-${new Date().toISOString().split('T')[0]}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }, 'image/png');
  }, [t]);

  const exportSVGAsPNG = useCallback((svgElement) => {
    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgElement.getBoundingClientRect().width * 2;
      canvas.height = svgElement.getBoundingClientRect().height * 2;
   
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
   
      canvas.toBlob((blob) => {
        if (!blob) {
          setError(t('seating.errors.exportFailed'));
          return;
        }

        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `seating-chart-${new Date().toISOString().split('T')[0]}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }, 'image/png');
   
      URL.revokeObjectURL(url);
    };
 
    img.onerror = () => {
      setError(t('seating.errors.exportFailed'));
      URL.revokeObjectURL(url);
    };
 
    img.src = url;
  }, [t]);

  const handleCanvasOffsetChange = useCallback((newOffset) => {
    setCanvasOffset(newOffset);
   
    const saveData = isSeparatedSeating ? {
      maleTables,
      femaleTables,
      maleArrangement,
      femaleArrangement,
      isSeparatedSeating: true,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset: typeof newOffset === 'function' ? newOffset(canvasOffset) : newOffset
      }
    } : {
      tables,
      arrangement: seatingArrangement,
      isSeparatedSeating: false,
      preferences,
      layoutSettings: {
        canvasScale,
        canvasOffset: typeof newOffset === 'function' ? newOffset(canvasOffset) : newOffset
      }
    };
   
    autoSave(saveData);
  }, [canvasScale, canvasOffset, tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, autoSave, isSeparatedSeating]);

  const handleCanvasScaleChange = useCallback((newScale) => {
    const actualScale = typeof newScale === 'function' ? newScale(canvasScale) : newScale;
    setCanvasScale(actualScale);
   
    const saveData = isSeparatedSeating ? {
      maleTables,
      femaleTables,
      maleArrangement,
      femaleArrangement,
      isSeparatedSeating: true,
      preferences,
      layoutSettings: {
        canvasScale: actualScale,
        canvasOffset
      }
    } : {
      tables,
      arrangement: seatingArrangement,
      isSeparatedSeating: false,
      preferences,
      layoutSettings: {
        canvasScale: actualScale,
        canvasOffset
      }
    };
   
    autoSave(saveData);
  }, [canvasScale, canvasOffset, tables, maleTables, femaleTables, seatingArrangement, maleArrangement, femaleArrangement, preferences, autoSave, isSeparatedSeating]);

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
          if (isSeparatedSeating) {
            setMaleTables(result.seating.maleTables || []);
            setFemaleTables(result.seating.femaleTables || []);
            setMaleArrangement(result.seating.maleArrangement || {});
            setFemaleArrangement(result.seating.femaleArrangement || {});
          } else {
            setTables(result.seating.tables);
            setSeatingArrangement(result.seating.arrangement);
          }
         
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
  }, [syncInProgress, makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, isSeparatedSeating]);

  const handleApplySyncOption = useCallback(async (optionId, customArrangement = null) => {
    try {
      setSyncInProgress(true);
     
      const response = await makeApiRequest(`/api/events/${eventId}/seating/sync/apply-option`, {
        method: 'POST',
        body: JSON.stringify({
          optionId,
          customArrangement,
          isSeparatedSeating
        })
      });

      if (!response) return;

      if (response.ok) {
        const result = await response.json();
       
        if (isSeparatedSeating) {
          setMaleTables(result.seating.maleTables);
          setFemaleTables(result.seating.femaleTables);
          setMaleArrangement(result.seating.maleArrangement);
          setFemaleArrangement(result.seating.femaleArrangement);
        } else {
          setTables(result.seating.tables);
          setSeatingArrangement(result.seating.arrangement);
        }
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
  }, [makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint, isSeparatedSeating]);

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
       
        if (isSeparatedSeating) {
          setMaleTables(result.seating.maleTables);
          setFemaleTables(result.seating.femaleTables);
          setMaleArrangement(result.seating.maleArrangement);
          setFemaleArrangement(result.seating.femaleArrangement);
        } else {
          setTables(result.seating.tables);
          setSeatingArrangement(result.seating.arrangement);
        }
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
  }, [makeApiRequest, eventId, showSyncNotification, t, fetchConfirmedGuests, createGuestFingerprint, isSeparatedSeating]);

  useEffect(() => {
    const initializeData = async () => {
      await fetchEventPermissions();
      const guestData = await fetchConfirmedGuests();
      const seatingData = await fetchSeatingArrangement();
     
      const hasExistingSeating = seatingData && (
        (seatingData.isSeparatedSeating &&
          ((seatingData.maleTables && seatingData.maleTables.length > 0) ||
          (seatingData.femaleTables && seatingData.femaleTables.length > 0))) ||
        (!seatingData.isSeparatedSeating && seatingData.tables && seatingData.tables.length > 0)
      );
     
      if (hasExistingSeating) {
        await checkAndHandlePendingSync();
      }
     
      if (guestData && guestData.confirmed) {
        const initialFingerprint = createGuestFingerprint(guestData.confirmed);
        setLastSyncData(initialFingerprint);
      }
    };

    initializeData();
  }, [eventId, fetchEventPermissions, fetchConfirmedGuests, fetchSeatingArrangement, checkAndHandlePendingSync, createGuestFingerprint]);
 
  const getCurrentTables = useCallback(() => {
    const filterDrafts = (tablesList) => tablesList.filter(t => !t.isDraft);

    if (isSeparatedSeating) {
      if (genderFilter === 'male') return filterDrafts(maleTables);
      if (genderFilter === 'female') return filterDrafts(femaleTables);
      return [...filterDrafts(tables), ...filterDrafts(maleTables), ...filterDrafts(femaleTables)];
    }
    return filterDrafts(tables);
  }, [isSeparatedSeating, genderFilter, tables, maleTables, femaleTables]);

  const getCurrentArrangement = useCallback(() => {
    if (isSeparatedSeating) {
      if (genderFilter === 'male') return maleArrangement;
      if (genderFilter === 'female') return femaleArrangement;
      return { ...seatingArrangement, ...maleArrangement, ...femaleArrangement };
    }
    return seatingArrangement;
  }, [isSeparatedSeating, genderFilter, seatingArrangement, maleArrangement, femaleArrangement]);

  const getFilteredGuests = useCallback(() => {
    if (!isSeparatedSeating) {
      return confirmedGuests;
    }

    return confirmedGuests;
  }, [confirmedGuests, isSeparatedSeating]);

  const stats = (() => {
    const savedTables = tables.filter(t => !t.isDraft);
    const savedMaleTables = maleTables.filter(t => !t.isDraft);
    const savedFemaleTables = femaleTables.filter(t => !t.isDraft);

    if (isSeparatedSeating) {
      const totalMaleGuests = confirmedGuests.reduce((sum, g) => sum + (g.maleCount || 0), 0);
      const totalFemaleGuests = confirmedGuests.reduce((sum, g) => sum + (g.femaleCount || 0), 0);
      const totalGuests = totalMaleGuests + totalFemaleGuests;

      const allMaleSeatedIds = Object.values(maleArrangement).flat();
      const allFemaleSeatedIds = Object.values(femaleArrangement).flat();

      const maleSeatedPeople = allMaleSeatedIds.reduce((sum, guestId) => {
        const guest = confirmedGuests.find(g => g._id === guestId);
        if (!guest) return sum;
        return sum + (guest.maleCount || 0);
      }, 0);

      const femaleSeatedPeople = allFemaleSeatedIds.reduce((sum, guestId) => {
        const guest = confirmedGuests.find(g => g._id === guestId);
        if (!guest) return sum;
        return sum + (guest.femaleCount || 0);
      }, 0);

      const unseatedMaleGuests = Math.max(0, totalMaleGuests - maleSeatedPeople);
      const unseatedFemaleGuests = Math.max(0, totalFemaleGuests - femaleSeatedPeople);

      return {
        totalGuests,
        totalMaleGuests,
        totalFemaleGuests,
        seatedGuests: maleSeatedPeople + femaleSeatedPeople,
        maleSeatedGuests: maleSeatedPeople,
        femaleSeatedGuests: femaleSeatedPeople,
        unseatedMaleGuests,
        unseatedFemaleGuests,
        totalTables: savedTables.length + savedMaleTables.length + savedFemaleTables.length,
        maleTables: savedMaleTables.length,
        femaleTables: savedFemaleTables.length,
        occupiedTables: Object.keys(maleArrangement).length + Object.keys(femaleArrangement).length
      };
    } else {
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

      return {
        totalGuests,
        seatedGuests,
        totalTables: savedTables.length,
        occupiedTables: Object.keys(seatingArrangement).length
      };
    }
  })();

  useEffect(() => {
    if (!isPolling || !canEdit === false) {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await makeApiRequest(`/api/events/${eventId}/seating`);
        if (!response || !response.ok) {
          return;
        }

        const data = await response.json();
        const serverUpdatedAt = new Date(data.updatedAt).getTime();
       
        if (!lastServerUpdate) {
          setLastServerUpdate(serverUpdatedAt);
          return;
        }

        if (serverUpdatedAt > lastServerUpdate) {
          setLastServerUpdate(serverUpdatedAt);
         
          if (data.isSeparatedSeating) {
            setMaleTables(data.maleTables || []);
            setFemaleTables(data.femaleTables || []);
            setMaleArrangement(data.maleArrangement || {});
            setFemaleArrangement(data.femaleArrangement || {});
          } else {
            setTables(data.tables || []);
            setSeatingArrangement(data.arrangement || {});
          }
         
          if (data.layoutSettings) {
            setCanvasScale(data.layoutSettings.canvasScale || 1);
            setCanvasOffset(data.layoutSettings.canvasOffset || { x: 0, y: 0 });
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [eventId, makeApiRequest, lastServerUpdate, isPolling, canEdit]);

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
              disabled={!canEdit}
            >
              {t('seating.mode.ai')}
            </button>
          </div>

          {isSeparatedSeating && (
            <div className="seating-gender-filter">
              <button
                className={`filter-button ${genderFilter === 'all' ? 'active' : ''}`}
                onClick={() => setGenderFilter('all')}
              >
                {t('seating.genderFilter.all')}
              </button>
              <button
                className={`filter-button ${genderFilter === 'male' ? 'active' : ''}`}
                onClick={() => setGenderFilter('male')}
              >
                {t('seating.genderFilter.male')}
              </button>
              <button
                className={`filter-button ${genderFilter === 'female' ? 'active' : ''}`}
                onClick={() => setGenderFilter('female')}
              >
                {t('seating.genderFilter.female')}
              </button>
            </div>
          )}

          <div className="seating-view-selector">
            <button
              className={`view-button ${viewMode === 'visual' ? 'active' : ''}`}
              onClick={() => setViewMode('visual')}
            >
               {t('seating.view.visual')}
            </button>
            <button
              className={`view-button ${viewMode === 'table' ? 'active' : ''}`}
              onClick={() => setViewMode('table')}
            >
               {t('seating.view.table')}
            </button>
          </div>

          <div className="seating-actions">
            {mode === 'ai' && (
              <button
                className="seating-action-button ai-button"
                onClick={() => setIsAIModalOpen(true)}
                disabled={confirmedGuests.length === 0 || !canEdit}
              >
                {t('seating.generateAI')}
              </button>
            )}

           <button
            className="seating-action-button clear-all-button"
            onClick={clearAllSeating}
            disabled={
              !canEdit ||
              (isSeparatedSeating
                ?
                  ((!maleArrangement || Object.keys(maleArrangement).length === 0) &&
                  (!femaleArrangement || Object.keys(femaleArrangement).length === 0) &&
                  (!maleTables || maleTables.length === 0) &&
                  (!femaleTables || femaleTables.length === 0) &&
                  (!tables || tables.length === 0) &&
                  (!seatingArrangement || Object.keys(seatingArrangement).length === 0))
                :
                  ((!tables || tables.length === 0) &&
                  (!seatingArrangement || Object.keys(seatingArrangement).length === 0))
              )
            }
            title={t('seating.clearAllTooltip')}
          >
            🗑️ {t('seating.clearAll')}
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

        <div className="guests-stats-bar">
          <div className="guests-stat-item">
            <div className="summary-value large">{stats.totalGuests}</div>
            <div className="summary-label">{t('seating.stats.totalGuests')}</div>
            {isSeparatedSeating && (
              <div className="stat-sublabel">
                {stats.totalMaleGuests} ♂ | {stats.totalFemaleGuests} ♀
              </div>
            )}
          </div>
         
          <div className="vertical-divider"></div>

          <div className="guests-stat-item">
            <div className="summary-value large success-text">{stats.seatedGuests}</div>
            <div className="summary-label">{t('seating.stats.seatedGuests')}</div>
          </div>
         
          <div className="vertical-divider"></div>

          <div className="guests-stat-item">
            <div className="summary-value large">{stats.totalTables}</div>
            <div className="summary-label">{t('seating.stats.totalTables')}</div>
          </div>
         
          <div className="vertical-divider"></div>

          <div className="guests-stat-item">
            <div className="summary-value large pending-text">{stats.occupiedTables}</div>
            <div className="summary-label">{t('seating.stats.occupiedTables')}</div>
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
                      disabled={!canEdit}
                    >
                      <option value="round">{t('seating.tableTypes.round')}</option>
                      <option value="rectangular">{t('seating.tableTypes.rectangular')}</option>
                      <option value="square">{t('seating.tableTypes.square')}</option>
                    </select>
                   
                    <select
                      value={tableCapacity}
                      onChange={(e) => setTableCapacity(parseInt(e.target.value))}
                      disabled={!canEdit}
                      className="capacity-select"
                    >
                      {[8, 10, 12, 14, 16, 18, 20, 22, 24].map(capacity => (
                        <option key={capacity} value={capacity}>
                          {capacity} {t('seating.table.seats')}
                        </option>
                      ))}
                    </select>
                   
                    <button
                      className={`add-table-button ${isAddingTable ? 'active' : ''}`}
                      onClick={() => setIsAddingTable(!isAddingTable)}
                      disabled={!canEdit}
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
                tables={getCurrentTables()}
                seatingArrangement={getCurrentArrangement()}
                maleArrangement={maleArrangement}
                femaleArrangement={femaleArrangement}
                guests={getFilteredGuests()}
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
                isSeparatedSeating={isSeparatedSeating}
                genderFilter={genderFilter}
                maleTables={maleTables}
                femaleTables={femaleTables}
                canEdit={canEdit}
              />
              </div>

              <div className="seating-sidebar">
                <GuestsList
                  guests={getFilteredGuests()}
                  tables={getCurrentTables()}
                  seatingArrangement={getCurrentArrangement()}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onUnseatGuest={unseatGuest}
                  syncNotification={syncNotification}
                  isSeparatedSeating={isSeparatedSeating}
                  genderFilter={genderFilter}
                  onGenderFilterChange={setGenderFilter}
                  maleArrangement={maleArrangement}
                  femaleArrangement={femaleArrangement}
                  canEdit={canEdit}
                />
              </div>
            </>
          ) : (
            <div className="seating-table-view-container">
              <SeatingTableView
                tables={getCurrentTables()}
                guests={getFilteredGuests()}
                seatingArrangement={getCurrentArrangement()}
                onSeatGuest={seatGuest}
                onUnseatGuest={unseatGuest}
                onEditTable={handleTableClick}
                onAddTable={handleAddTableFromView}
                onDeleteTable={deleteTable}
                canEdit={canEdit}
                isSeparatedSeating={isSeparatedSeating}
                genderFilter={genderFilter}
                maleTables={maleTables}
                femaleTables={femaleTables}
                maleArrangement={maleArrangement}
                femaleArrangement={femaleArrangement}
              />
            </div>
          )}
        </div>

        <TableDetailsModal
          isOpen={isTableModalOpen}
          table={editingTable}
          guests={getFilteredGuests()}
          seatingArrangement={getCurrentArrangement()}
          onClose={(wasSaved = false) => {
            if (editingTable && editingTable.isDraft && !wasSaved) {
              if (isSeparatedSeating) {
                const isInMaleTables = maleTables.some(t => t.id === editingTable.id);
                const isInFemaleTables = femaleTables.some(t => t.id === editingTable.id);

                if (isInMaleTables) {
                  setMaleTables(maleTables.filter(t => t.id !== editingTable.id));
                } else if (isInFemaleTables) {
                  setFemaleTables(femaleTables.filter(t => t.id !== editingTable.id));
                } else {
                  setTables(tables.filter(t => t.id !== editingTable.id));
                }
              } else {
                setTables(tables.filter(t => t.id !== editingTable.id));
              }
            } else if (!editingTable?.isDraft) {
              if (isSeparatedSeating) {
                const updatedMaleTables = updateTableNamesWithGroups(maleTables, maleArrangement, 'male');
                const updatedFemaleTables = updateTableNamesWithGroups(femaleTables, femaleArrangement, 'female');
                setMaleTables(updatedMaleTables);
                setFemaleTables(updatedFemaleTables);
              } else {
                const updatedTables = updateTableNamesWithGroups(tables, seatingArrangement);
                setTables(updatedTables);
              }
            }

            setIsTableModalOpen(false);
            setEditingTable(null);
            setSelectedTable(null);
          }}
          onUpdateTable={updateTable}
          onDeleteTable={deleteTable}
          onSeatGuest={seatGuest}
          onUnseatGuest={unseatGuest}
          isSeparatedSeating={isSeparatedSeating}
          genderFilter={genderFilter}
          maleTables={maleTables}
          femaleTables={femaleTables}
          maleArrangement={maleArrangement}
          femaleArrangement={femaleArrangement}
        />

        <AISeatingModal
          isOpen={isAIModalOpen}
          guests={confirmedGuests}
          tables={tables}
          maleTables={maleTables}
          femaleTables={femaleTables}
          preferences={preferences}
          seatingArrangement={seatingArrangement}
          maleArrangement={maleArrangement}
          femaleArrangement={femaleArrangement}
          isSeparatedSeating={isSeparatedSeating}
          onClose={() => setIsAIModalOpen(false)}
          onGenerate={generateAISeating}
          onFetchTableSuggestion={fetchTableSuggestion}
          eventId={eventId}
          onAddTables={handleAddTablesFromAI}
          getNextTableNumber={getNextTableNumber}
          onPreferencesChange={(newPrefs) => {
            setPreferences(prev => ({
              ...prev,
              ...newPrefs
            }));
          }}
        />

        <SyncOptionsModal
          isOpen={isSyncOptionsModalOpen}
          onClose={() => setIsSyncOptionsModalOpen(false)}
          options={syncOptions}
          affectedGuests={affectedGuests}
          pendingTriggers={pendingSyncTriggers}
          onApplyOption={handleApplySyncOption}
          onMoveToUnassigned={handleMoveAffectedGuestsToUnassigned}
          isSeparatedSeating={isSeparatedSeating}
          canEdit={canEdit}
        />

         {isClearModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3>{t('dashboard.confirmDelete')}</h3>
                <button className="modal-close" onClick={() => setIsClearModalOpen(false)}>×</button>
              </div>
              <div className="modal-body">
                <p>{t('seating.confirmClearAll')}</p>
              </div>
              <div className="modal-footer">
                <button className="modal-btn delete" onClick={handleConfirmClearAll}>
                  {t('common.delete')}
                </button>
                <button className="modal-btn cancel" onClick={() => setIsClearModalOpen(false)}>
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        )}


        {isClearModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>{t('dashboard.confirmDelete')}</h3>
              <button className="modal-close" onClick={() => setIsClearModalOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p>{t('seating.confirmClearAll')}</p>
            </div>
            <div className="modal-footer">
              <button className="modal-btn delete" onClick={handleConfirmClearAll}>
                {t('common.delete')}
              </button>
              <button className="modal-btn cancel" onClick={() => setIsClearModalOpen(false)}>
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </FeaturePageTemplate>
  );
};

export default EventSeatingPage;