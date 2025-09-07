import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import FeaturePageTemplate from './FeaturePageTemplate';
import SeatingCanvas from './components/SeatingCanvas';
import GuestsList from './components/GuestsList';
import TableDetailsModal from './components/TableDetailsModal';
import AISeatingModal from '../../components/AISeatingModal';
import SeatingTableView from './components/SeatingTableView';
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
  
  const canvasRef = useRef(null);

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

  const fetchConfirmedGuests = useCallback(async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/guests`);
      if (!response) return;

      if (response.ok) {
        const allGuests = await response.json();
        const confirmed = allGuests.filter(guest => guest.rsvpStatus === 'confirmed');
        setGuests(allGuests);
        setConfirmedGuests(confirmed);
        setError('');
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.fetchGuests'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    }
  }, [eventId, makeApiRequest, t]);

  const fetchSeatingArrangement = useCallback(async () => {
    try {
      const response = await makeApiRequest(`/api/events/${eventId}/seating`);
      if (!response) return;

      if (response.ok) {
        const data = await response.json();
        setTables(data.tables || []);
        setSeatingArrangement(data.arrangement || {});
        setPreferences(data.preferences || {
          groupTogether: [],
          keepSeparate: [],
          specialRequests: []
        });
        if (data.layoutSettings) {
          setCanvasScale(data.layoutSettings.canvasScale || 1);
          setCanvasOffset(data.layoutSettings.canvasOffset || { x: 0, y: 0 });
        }
      } else if (response.status === 404) {
        setTables([]);
        setSeatingArrangement({});
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || t('seating.errors.fetchArrangement'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
    } finally {
      setLoading(false);
    }
  }, [eventId, makeApiRequest, t]);

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

      if (!response) return false;

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
  }, [eventId, makeApiRequest, tables, preferences, confirmedGuests, seatingArrangement, canvasScale, canvasOffset, autoSave, t, updateTableNamesWithGroups]);

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

  useEffect(() => {
    fetchConfirmedGuests();
    fetchSeatingArrangement();
  }, [fetchConfirmedGuests, fetchSeatingArrangement]);

  const stats = {
    totalGuests: confirmedGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
    seatedGuests: Object.values(seatingArrangement).flat().reduce((sum, guestId) => {
      const guest = confirmedGuests.find(g => g._id === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0),
    totalTables: tables.length,
    occupiedTables: Object.keys(seatingArrangement).length
  };

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
      </div>
    </FeaturePageTemplate>
  );
};

export default EventSeatingPage;