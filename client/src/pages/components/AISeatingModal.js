import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

const AISeatingModal = ({
  isOpen,
  guests,
  tables,
  preferences,
  seatingArrangement,
  onClose,
  onGenerate,
  onAddTables,
  getNextTableNumber
}) => {
  const { t } = useTranslation();
  const [aiPreferences, setAiPreferences] = useState({
    prioritizeGroups: true,
    balanceTableSizes: true,
    considerSpecialNeeds: true,
    mixGroups: false,
    separateAgeGroups: false,
    prioritizeVIPs: false,
    customInstructions: ''
  });
  
  const [tableSettings, setTableSettings] = useState([
    { type: 'round', capacity: 8, count: 0 },
    { type: 'round', capacity: 10, count: 0 },
    { type: 'rectangular', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 16, count: 0 }
  ]);
  
  const [customTableSettings, setCustomTableSettings] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTableCreation, setShowTableCreation] = useState(false);
  const [showExistingArrangementWarning, setShowExistingArrangementWarning] = useState(false);
  const [existingArrangementAction, setExistingArrangementAction] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  const hasExistingArrangement = seatingArrangement && Object.keys(seatingArrangement).length > 0 && Object.values(seatingArrangement).some(arr => arr.length > 0);

  const generateTableNameWithGroup = (tableNumber, tableId, arrangement, guestsList) => {
    const baseName = `${t('seating.tableName')} ${tableNumber}`;
    
    if (!arrangement || !arrangement[tableId] || arrangement[tableId].length === 0) {
      return baseName;
    }
    
    const seatedGuestIds = arrangement[tableId] || [];
    const tableGuests = seatedGuestIds.map(guestId => 
      guestsList.find(g => g._id === guestId)
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
  };

  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false);
      setShowTableCreation(false);
      setShowExistingArrangementWarning(false);
      setExistingArrangementAction('');
      setInitialLoad(true);
    } else if (initialLoad) {
      setInitialLoad(false);
      
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      
      if (hasExistingArrangement && Object.keys(seatingArrangement).length > 0) {
        setShowExistingArrangementWarning(true);
        return;
      }
      
      if (totalCapacity < totalGuests || tables.length === 0) {
        setShowTableCreation(true);
        if (tables.length === 0) {
          autoSuggestTables(totalGuests);
        }
      } else {
        setShowTableCreation(false);
      }
    }
  }, [isOpen, initialLoad, tables.length, guests, tables, hasExistingArrangement, seatingArrangement]);

  const autoSuggestTables = (guestsNeedingSeats) => {
    if (guestsNeedingSeats === 0) return;
    
    const newTableSettings = [...tableSettings];
    newTableSettings.forEach(setting => setting.count = 0);
    
    let availableCapacityInExistingTables = 0;
    if (existingArrangementAction === 'continue') {
      const seatedGuestsCount = getSeatedGuestsCount();
      const totalExistingCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      availableCapacityInExistingTables = totalExistingCapacity - seatedGuestsCount;
    } else {
      availableCapacityInExistingTables = tables.reduce((sum, table) => sum + table.capacity, 0);
    }
    
    const guestsNeedingNewTables = Math.max(0, guestsNeedingSeats - availableCapacityInExistingTables);
    
    if (guestsNeedingNewTables === 0) {
      return;
    }
    
    let remainingGuests = guestsNeedingNewTables;
    
    while (remainingGuests > 0) {
      if (remainingGuests <= 6) {
        newTableSettings[0].count += 1;
        remainingGuests = 0;
      } else if (remainingGuests <= 8) {
        newTableSettings[0].count += 1;
        remainingGuests = 0;
      } else if (remainingGuests <= 10) {
        newTableSettings[1].count += 1;
        remainingGuests = 0;
      } else if (remainingGuests <= 16) {
        newTableSettings[0].count += 2;
        remainingGuests = 0;
      } else if (remainingGuests <= 18) {
        newTableSettings[0].count += 1;
        newTableSettings[1].count += 1;
        remainingGuests = 0;
      } else {
        if (remainingGuests % 10 <= 2 && remainingGuests >= 20) {
          newTableSettings[1].count += 1;
          remainingGuests -= 10;
        } else {
          newTableSettings[0].count += 1;
          remainingGuests -= 8;
        }
      }
    }
    
    setTableSettings(newTableSettings);
  };

  const getSeatedGuestsCount = () => {
    if (!hasExistingArrangement) return 0;
    
    return Object.values(seatingArrangement).flat().reduce((sum, guestId) => {
      const guest = guests.find(g => g._id === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
  };

  if (!isOpen) return null;

  const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
  const plannedCapacity = tableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0) + 
                         customTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0);
  const utilizationRate = totalCapacity > 0 ? (totalGuests / totalCapacity) * 100 : 0;

  const groupStats = guests.reduce((acc, guest) => {
    const group = guest.customGroup || guest.group;
    if (!acc[group]) {
      acc[group] = { count: 0, people: 0 };
    }
    acc[group].count++;
    acc[group].people += guest.attendingCount || 1;
    return acc;
  }, {});

  const handleExistingArrangementChoice = (action) => {
    setExistingArrangementAction(action);
    setShowExistingArrangementWarning(false);
    
    if (action === 'clear') {
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      
      if (totalCapacity < totalGuests) {
        setShowTableCreation(true);
        autoSuggestTables(totalGuests);
      }
    } else if (action === 'continue') {
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const seatedGuestsCount = getSeatedGuestsCount();
      const unseatedGuestsCount = totalGuests - seatedGuestsCount;
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      const availableCapacity = totalCapacity - seatedGuestsCount;
      
      if (availableCapacity < unseatedGuestsCount) {
        setShowTableCreation(true);
        autoSuggestTables(unseatedGuestsCount);
      }
    }
  };

  const addCustomTableType = () => {
    const newCustomTable = {
      id: `custom_${Date.now()}`,
      type: 'round',
      capacity: 6,
      count: 1
    };
    setCustomTableSettings(prev => [...prev, newCustomTable]);
  };

  const updateCustomTableSetting = (id, field, value) => {
    setCustomTableSettings(prev => 
      prev.map(setting => 
        setting.id === id 
          ? { ...setting, [field]: field === 'count' || field === 'capacity' ? (parseInt(value) || 0) : value }
          : setting
      )
    );
  };

  const removeCustomTableSetting = (id) => {
    setCustomTableSettings(prev => prev.filter(setting => setting.id !== id));
  };

  const handleGenerate = async (customPreferences = null) => {
    setIsGenerating(true);
    
    try {
      const generationOptions = customPreferences || {
        ...aiPreferences,
        preserveExisting: existingArrangementAction === 'continue',
        clearExisting: existingArrangementAction === 'clear'
      };
      
      const result = await onGenerate(generationOptions);
      
      if (!customPreferences) {
        onClose(); 
      }
      
      return result;
    } catch (error) {
      return false;
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreateTables = async () => {
    const tablesToCreate = [];
    let tableCounter = getNextTableNumber ? getNextTableNumber() : tables.length + 1;
    
    const totalTables = tableSettings.reduce((sum, s) => sum + s.count, 0) + 
                       customTableSettings.reduce((sum, s) => sum + s.count, 0);
    
    const cols = Math.ceil(Math.sqrt(totalTables + tables.length));
    const spacing = 200;
    const startX = 300;
    const startY = 250;
    
    let currentTable = tables.length;
    
    tableSettings.forEach(setting => {
      for (let i = 0; i < setting.count; i++) {
        const row = Math.floor(currentTable / cols);
        const col = currentTable % cols;
        
        const table = {
          id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${t('seating.tableName')} ${tableCounter}`,
          type: setting.type,
          capacity: setting.capacity,
          position: {
            x: startX + col * spacing,
            y: startY + row * spacing
          },
          rotation: 0,
          size: setting.type === 'round' 
            ? { width: 120, height: 120 } 
            : { width: 160, height: 100 }
        };
        tablesToCreate.push(table);
        tableCounter++;
        currentTable++;
      }
    });
    
    customTableSettings.forEach(setting => {
      for (let i = 0; i < setting.count; i++) {
        const row = Math.floor(currentTable / cols);
        const col = currentTable % cols;
        
        const table = {
          id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
          name: `${t('seating.tableName')} ${tableCounter}`,
          type: setting.type,
          capacity: setting.capacity,
          position: {
            x: startX + col * spacing,
            y: startY + row * spacing
          },
          rotation: 0,
          size: setting.type === 'round' 
            ? { width: Math.max(80, Math.min(200, 60 + (setting.capacity * 8))), height: Math.max(80, Math.min(200, 60 + (setting.capacity * 8))) } 
            : { width: Math.max(120, (60 + (setting.capacity * 8)) * 1.4), height: Math.max(60, (60 + (setting.capacity * 8)) * 0.7) }
        };
        tablesToCreate.push(table);
        tableCounter++;
        currentTable++;
      }
    });
    
    if (tablesToCreate.length > 0) {
      try {
        setIsGenerating(true);
        
        await onAddTables(tablesToCreate);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        const allTablesForGeneration = [...tables, ...tablesToCreate];
        
        const aiPreferencesWithExisting = {
          ...aiPreferences,
          preserveExisting: existingArrangementAction === 'continue',
          clearExisting: existingArrangementAction === 'clear',
          allTables: allTablesForGeneration
        };
        
        const result = await handleGenerate(aiPreferencesWithExisting);
        
        if (result && result.arrangement) {
          const updatedTables = tablesToCreate.map(table => {
            const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
            return {
              ...table,
              name: generateTableNameWithGroup(tableNumber, table.id, result.arrangement, guests)
            };
          });
          
          if (updatedTables.length > 0) {
            await onAddTables(updatedTables);
          }
        }
        
        onClose();
      } catch (error) {
        setIsGenerating(false);
      }
    } else {
      const aiPreferencesWithExisting = {
        ...aiPreferences,
        preserveExisting: existingArrangementAction === 'continue',
        clearExisting: existingArrangementAction === 'clear',
        allTables: tables
      };
      
      await handleGenerate(aiPreferencesWithExisting);
    }
  };

  const handlePreferenceChange = (key, value) => {
    setAiPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleTableSettingChange = (index, field, value) => {
    const newSettings = [...tableSettings];
    newSettings[index][field] = parseInt(value) || 0;
    setTableSettings(newSettings);
  };

  const seatedGuestsCount = getSeatedGuestsCount();
  const unseatedGuestsCount = totalGuests - seatedGuestsCount;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-seating-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🤖 {t('seating.ai.title')}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {showExistingArrangementWarning && (
            <div className="existing-arrangement-warning">
              <div className="warning-icon">⚠️</div>
              <h4>{t('seating.ai.existingArrangementFound')}</h4>
              <div className="existing-arrangement-info">
                <p>
                  {t('seating.ai.existingArrangementDescription', {
                    tablesCount: Object.keys(seatingArrangement).length,
                    seatedGuests: seatedGuestsCount,
                    totalGuests: totalGuests
                  })}
                </p>
                <div className="arrangement-stats">
                  <div className="stat-item">
                    <span className="stat-value">{seatedGuestsCount}</span>
                    <span className="stat-label">{t('seating.ai.seatedGuests')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{unseatedGuestsCount}</span>
                    <span className="stat-label">{t('seating.ai.unseatedGuests')}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-value">{Object.keys(seatingArrangement).length}</span>
                    <span className="stat-label">{t('seating.ai.populatedTables')}</span>
                  </div>
                </div>
              </div>
              
              <div className="arrangement-choice">
                <h5>{t('seating.ai.howToContinue')}</h5>
                <div className="choice-buttons">
                  <button 
                    className="choice-button continue-button"
                    onClick={() => handleExistingArrangementChoice('continue')}
                  >
                    <div className="choice-icon">🔄</div>
                    <div className="choice-content">
                      <div className="choice-title">{t('seating.ai.continueFromExisting')}</div>
                      <div className="choice-description">
                        {t('seating.ai.continueDescription')}
                        {(() => {
                          const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
                          const availableCapacity = totalCapacity - seatedGuestsCount;
                          return availableCapacity >= unseatedGuestsCount ? (
                            <div className="choice-note success">
                              {t('seating.ai.enoughCapacity', { capacity: availableCapacity })}
                            </div>
                          ) : (
                            <div className="choice-note warning">
                              {t('seating.ai.needMoreTables')}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </button>
                  
                  <button 
                    className="choice-button clear-button"
                    onClick={() => handleExistingArrangementChoice('clear')}
                  >
                    <div className="choice-icon">🗑️</div>
                    <div className="choice-content">
                      <div className="choice-title">{t('seating.ai.startOver')}</div>
                      <div className="choice-description">
                        {t('seating.ai.clearDescription')}
                        {(() => {
                          const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
                          return totalCapacity >= totalGuests ? (
                            <div className="choice-note success">
                              {t('seating.ai.enoughCapacityExisting')}
                            </div>
                          ) : (
                            <div className="choice-note warning">
                              {t('seating.ai.needMoreTables')}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </button>
                </div>
                
                {(() => {
                  const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
                  const availableCapacity = totalCapacity - seatedGuestsCount;
                  return availableCapacity >= unseatedGuestsCount && (
                    <div className="direct-continue-section">
                      <button 
                        className="direct-continue-button"
                        onClick={async () => {
                          setExistingArrangementAction('continue');
                          setShowExistingArrangementWarning(false);
                          const directOptions = {
                            ...aiPreferences,
                            preserveExisting: true,
                            clearExisting: false
                          };
                          await handleGenerate(directOptions);
                        }}
                      >
                        {t('seating.ai.directContinue')}
                      </button>
                      <div className="direct-continue-note">
                        {t('seating.ai.directContinueNote')}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {showTableCreation && !showExistingArrangementWarning && (
            <div className="table-creation-section">
              <h4>{t('seating.ai.createAdditionalTables')}</h4>
              <div className="table-creation-info">
                {existingArrangementAction === 'continue' ? (
                  <>
                    <p>{t('seating.ai.needAdditionalTablesForUnseated')}</p>
                    <div className="guest-summary">
                      <strong>{t('seating.ai.unseatedGuests')}: {unseatedGuestsCount}</strong>
                      <br />
                      <span>{t('seating.ai.availableSeats')}: {Math.max(0, totalCapacity - seatedGuestsCount)}</span>
                    </div>
                  </>
                ) : tables.length > 0 ? (
                  <>
                    <p>{t('seating.ai.existingTablesNotEnough', { tablesCount: tables.length, capacity: totalCapacity })}</p>
                    <div className="guest-summary">
                      <strong>{t('seating.ai.totalGuests')}: {totalGuests}</strong>
                      <br />
                      <span>{t('seating.ai.existingCapacity')}: {totalCapacity}</span>
                      <br />
                      <span>{t('seating.ai.additionalNeeded')}: {Math.max(0, totalGuests - totalCapacity)} {t('seating.ai.seats')}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <p>{t('seating.ai.noTablesYet')}</p>
                    <div className="guest-summary">
                      <strong>{t('seating.ai.totalGuests')}: {totalGuests}</strong>
                    </div>
                  </>
                )}
              </div>

              <div className="table-settings">
                <h5>{t('seating.ai.predefinedTables')}:</h5>
                {tableSettings.map((setting, index) => (
                  <div key={index} className="table-setting-row">
                    <div className="table-info">
                      <span className="table-type">
                        {setting.type === 'round' ? '🟡' : '🟩'} {t(`seating.ai.${setting.type}Table`)}
                      </span>
                      <span className="table-capacity">
                        ({setting.capacity} {t('seating.ai.seats')})
                      </span>
                    </div>
                    <div className="table-count-control">
                      <button 
                        type="button"
                        onClick={() => handleTableSettingChange(index, 'count', Math.max(0, setting.count - 1))}
                        className="count-btn"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={setting.count}
                        onChange={(e) => handleTableSettingChange(index, 'count', e.target.value)}
                        className="count-input"
                      />
                      <button 
                        type="button"
                        onClick={() => handleTableSettingChange(index, 'count', setting.count + 1)}
                        className="count-btn"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
                
                <div className="custom-tables-section">
                  <div className="custom-tables-header">
                    <h5>{t('seating.ai.customSizeTables')}:</h5>
                    <button 
                      type="button"
                      onClick={addCustomTableType}
                      className="add-custom-table-btn"
                    >
                      {t('seating.ai.addCustomTableButton')}
                    </button>
                  </div>
                  
                  {customTableSettings.length > 0 && (
                    <div className="custom-tables-list">
                      {customTableSettings.map((setting) => (
                        <div key={setting.id} className="custom-table-setting-row">
                          <div className="custom-table-config">
                            <select 
                              value={setting.type}
                              onChange={(e) => updateCustomTableSetting(setting.id, 'type', e.target.value)}
                              className="custom-type-select"
                            >
                              <option value="round">{t('seating.ai.round')}</option>
                              <option value="rectangular">{t('seating.ai.rectangular')}</option>
                              <option value="square">{t('seating.ai.square')}</option>
                            </select>
                            
                            <input
                              type="number"
                              min="4"
                              max="30"
                              value={setting.capacity}
                              onChange={(e) => updateCustomTableSetting(setting.id, 'capacity', e.target.value)}
                              className="custom-capacity-input"
                              placeholder={t('seating.ai.seatsPlaceholder')}
                            />
                            
                            <span className="capacity-label">{t('seating.ai.seats')}</span>
                          </div>
                          
                          <div className="table-count-control">
                            <button 
                              type="button"
                              onClick={() => updateCustomTableSetting(setting.id, 'count', Math.max(0, setting.count - 1))}
                              className="count-btn"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={setting.count}
                              onChange={(e) => updateCustomTableSetting(setting.id, 'count', e.target.value)}
                              className="count-input"
                            />
                            <button 
                              type="button"
                              onClick={() => updateCustomTableSetting(setting.id, 'count', setting.count + 1)}
                              className="count-btn"
                            >
                              +
                            </button>
                          </div>
                          
                          <button
                            type="button"
                            onClick={() => removeCustomTableSetting(setting.id)}
                            className="remove-custom-table-btn"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {customTableSettings.length === 0 && (
                    <div className="no-custom-tables-message">
                      {t('seating.ai.noCustomTablesMessage')}
                    </div>
                  )}
                </div>
              </div>

              <div className="capacity-summary">
                <div className="capacity-info">
                  <span>{t('seating.ai.existingTables')}: <strong>{tables.length}</strong> ({totalCapacity} {t('seating.ai.seats')})</span>
                  <span>{t('seating.ai.plannedNewTables')}: <strong>{tableSettings.reduce((sum, s) => sum + s.count, 0) + customTableSettings.reduce((sum, s) => sum + s.count, 0)}</strong> ({plannedCapacity} {t('seating.ai.seats')})</span>
                  <span>{t('seating.ai.totalCapacity')}: <strong>{totalCapacity + plannedCapacity}</strong> {t('seating.ai.seats')}</span>
                  {existingArrangementAction === 'continue' ? (
                    <span className={totalCapacity + plannedCapacity >= totalGuests ? 'sufficient' : 'insufficient'}>
                      {totalCapacity + plannedCapacity >= totalGuests ? t('seating.ai.enoughSeatsForAll') : t('seating.ai.notEnoughSeatsForAll')}
                    </span>
                  ) : (
                    <span className={totalCapacity + plannedCapacity >= totalGuests ? 'sufficient' : 'insufficient'}>
                      {totalCapacity + plannedCapacity >= totalGuests ? t('seating.ai.enoughSeats') : t('seating.ai.notEnoughSeats')}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {!showTableCreation && !showExistingArrangementWarning && (
            <>
              <div className="ai-overview">
                <h4>{t('seating.ai.overview')}</h4>
                <div className="overview-stats">
                  <div className="stat-item">
                    <span className="stat-label">{t('seating.ai.totalGuests')}</span>
                    <span className="stat-value">{totalGuests}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{t('seating.ai.totalTables')}</span>
                    <span className="stat-value">{tables.length}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{t('seating.ai.totalCapacity')}</span>
                    <span className="stat-value">{totalCapacity}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">{t('seating.ai.utilization')}</span>
                    <span className={`stat-value ${utilizationRate > 100 ? 'overcapacity' : utilizationRate > 90 ? 'warning' : 'good'}`}>
                      {utilizationRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {utilizationRate > 100 && (
                  <div className="capacity-warning">
                    {t('seating.ai.capacityWarning')}
                    <button 
                      onClick={() => setShowTableCreation(true)}
                      className="add-tables-warning-button"
                    >
                      {t('seating.ai.addTablesButton')}
                    </button>
                  </div>
                )}
              </div>

              <div className="group-stats">
                <h4>{t('seating.ai.groupBreakdown')}</h4>
                <div className="groups-grid">
                  {Object.entries(groupStats).map(([group, stats]) => (
                    <div key={group} className="group-stat-item">
                      <div className="group-name">
                        {['family', 'friends', 'work', 'other'].includes(group) 
                          ? t(`guests.groups.${group}`) 
                          : group}
                      </div>
                      <div className="group-numbers">
                        {stats.count} {t('seating.ai.guests')} ({stats.people} {t('seating.ai.people')})
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="ai-preferences">
                <h4>{t('seating.ai.preferences')}</h4>
                <div className="preferences-grid">
                  <label className="preference-item">
                    <input
                      type="checkbox"
                      checked={aiPreferences.prioritizeGroups}
                      onChange={(e) => handlePreferenceChange('prioritizeGroups', e.target.checked)}
                    />
                    <div className="preference-content">
                      <div className="preference-title">{t('seating.ai.prioritizeGroupsTitle')}</div>
                      <div className="preference-description">{t('seating.ai.prioritizeGroupsDescription')}</div>
                    </div>
                  </label>

                  <label className="preference-item">
                    <input
                      type="checkbox"
                      checked={aiPreferences.balanceTableSizes}
                      onChange={(e) => handlePreferenceChange('balanceTableSizes', e.target.checked)}
                    />
                    <div className="preference-content">
                      <div className="preference-title">{t('seating.ai.balanceTableSizesTitle')}</div>
                      <div className="preference-description">{t('seating.ai.balanceTableSizesDescription')}</div>
                    </div>
                  </label>

                  <label className="preference-item">
                    <input
                      type="checkbox"
                      checked={aiPreferences.considerSpecialNeeds}
                      onChange={(e) => handlePreferenceChange('considerSpecialNeeds', e.target.checked)}
                    />
                    <div className="preference-content">
                      <div className="preference-title">{t('seating.ai.considerSpecialNeedsTitle')}</div>
                      <div className="preference-description">{t('seating.ai.considerSpecialNeedsDescription')}</div>
                    </div>
                  </label>

                  <label className="preference-item">
                    <input
                      type="checkbox"
                      checked={aiPreferences.mixGroups}
                      onChange={(e) => handlePreferenceChange('mixGroups', e.target.checked)}
                    />
                    <div className="preference-content">
                      <div className="preference-title">{t('seating.ai.mixGroupsTitle')}</div>
                      <div className="preference-description">{t('seating.ai.mixGroupsDescription')}</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="custom-instructions">
                <h4>{t('seating.ai.additionalInstructions')}</h4>
                <textarea
                  value={aiPreferences.customInstructions}
                  onChange={(e) => handlePreferenceChange('customInstructions', e.target.value)}
                  placeholder={t('seating.ai.customInstructionsPlaceholder')}
                  className="custom-instructions-textarea"
                  rows="4"
                />
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <div className="footer-info">
            {!showTableCreation && !showExistingArrangementWarning && (
              <span className="generation-time-estimate">
                {t('seating.ai.estimatedTime')}
              </span>
            )}
          </div>
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose} disabled={isGenerating}>
              {t('common.cancel')}
            </button>
            {showExistingArrangementWarning ? null : showTableCreation ? (
              <button 
                className="create-tables-btn" 
                onClick={handleCreateTables}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <>
                    <span className="loading-spinner">⏳</span>
                    {t('seating.ai.creatingTablesAndArranging')}
                  </>
                ) : tableSettings.reduce((sum, s) => sum + s.count, 0) + customTableSettings.reduce((sum, s) => sum + s.count, 0) > 0 ? (
                  <>
                    {t('seating.ai.createTablesAndArrange')}
                  </>
                ) : (
                  <>
                    {t('seating.ai.startArrangingWithExistingTables')}
                  </>
                )}
              </button>
            ) : (
              <button 
                className="generate-button" 
                onClick={async () => {
                  await handleGenerate();
                }}
                disabled={isGenerating || tables.length === 0 || guests.length === 0}
              >
                {isGenerating ? (
                  <>
                    <span className="loading-spinner">⏳</span>
                    {t('seating.ai.generating')}
                  </>
                ) : (
                  <>
                    {existingArrangementAction === 'continue' ? t('seating.ai.continueArrangement') : t('seating.ai.createArrangement')}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AISeatingModal;