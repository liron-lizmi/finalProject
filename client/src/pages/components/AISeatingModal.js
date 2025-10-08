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
    customInstructions: '',
    allowGroupMixing: false,
    preferredTableSize: 12,
    groupMixingRules: [],
    groupPolicies: {}
  });
  
  const [tableSettings, setTableSettings] = useState([
    { type: 'round', capacity: 8, count: 0 },
    { type: 'round', capacity: 10, count: 0 },
    { type: 'round', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 16, count: 0 }
  ]);
  
  const [customTableSettings, setCustomTableSettings] = useState([]);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTableCreation, setShowTableCreation] = useState(false);
  const [showExistingArrangementWarning, setShowExistingArrangementWarning] = useState(false);
  const [existingArrangementAction, setExistingArrangementAction] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);

  const [showGroupMixingConfig, setShowGroupMixingConfig] = useState(false);
  const [newGroupMixRule, setNewGroupMixRule] = useState({
    group1: '',
    group2: '',
  });

  const [showSeatingRules, setShowSeatingRules] = useState(false);
  const [seatingRules, setSeatingRules] = useState({
    mustSitTogether: [],
    cannotSitTogether: []
  });
  const [newMustSitRule, setNewMustSitRule] = useState({
    guest1Id: '',
    guest2Id: '',
    reason: ''
  });
  const [newCannotSitRule, setNewCannotSitRule] = useState({
    guest1Id: '',
    guest2Id: '',
    reason: ''
  });
  const [showGroupPolicies, setShowGroupPolicies] = useState(false);

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

  const availableGroups = React.useMemo(() => {
    const groups = new Set();
    guests.forEach(guest => {
      const group = guest.customGroup || guest.group;
      if (group) groups.add(group);
    });
    return Array.from(groups);
  }, [guests]);

  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false);
      setShowTableCreation(false);
      setShowExistingArrangementWarning(false);
      setExistingArrangementAction('');
      setInitialLoad(true);
      setShowGroupMixingConfig(false);
      setShowSeatingRules(false);
    } else if (initialLoad) {
      setInitialLoad(false);
      
      if (preferences) {
        setSeatingRules({
          mustSitTogether: preferences.groupTogether || [],
          cannotSitTogether: preferences.keepSeparate || []
        });
      }
      
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      
      if (hasExistingArrangement && Object.keys(seatingArrangement).length > 0) {
        setShowExistingArrangementWarning(true);
        return;
      }
      
      if (totalCapacity < totalGuests || tables.length === 0) {
        setShowTableCreation(true);
        if (tables.length === 0) {
          autoSuggestTables(totalGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies);
        }
      } else {
        setShowTableCreation(false);
      }
    }
  }, [isOpen, initialLoad, tables.length, guests, tables, hasExistingArrangement, seatingArrangement, preferences]);


  useEffect(() => {
    if (isOpen && showTableCreation && aiPreferences.allowGroupMixing && 
        Object.keys(aiPreferences.groupPolicies).length > 0) {
      
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      
      let guestsNeedingSeats = 0;
      
      if (existingArrangementAction === 'continue') {
        const seatedGuestsCount = getSeatedGuestsCount();
        guestsNeedingSeats = totalGuests - seatedGuestsCount;
      } else {
        guestsNeedingSeats = totalGuests;
      }
      
      if (totalCapacity < guestsNeedingSeats || tables.length === 0) {
        autoSuggestTables(guestsNeedingSeats, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies);
      }
    }
  }, [isOpen, showTableCreation, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, guests, tables, existingArrangementAction]);

  const autoSuggestTables = (guestsNeedingSeats, allowMixing = null, customGroupPolicies = null) => {
    if (guestsNeedingSeats === 0) {
      return;
    }
    
    const effectiveGroupPolicies = customGroupPolicies || aiPreferences.groupPolicies || {};
        
    const newTableSettings = [...tableSettings];
    newTableSettings.forEach(setting => setting.count = 0);
    
    const shouldAllowMixing = allowMixing !== null ? allowMixing : aiPreferences.allowGroupMixing;
    
    const seatedGuestIds = new Set();
    if (seatingArrangement && Object.keys(seatingArrangement).length > 0) {
      Object.values(seatingArrangement).forEach(guestIds => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(id => seatedGuestIds.add(id));
        }
      });
    }
    
    const unseatedGuests = seatedGuestIds.size > 0
      ? guests.filter(guest => !seatedGuestIds.has(guest._id))
      : guests;
        
    const totalUnseatedPeople = unseatedGuests.reduce((sum, guest) => 
      sum + (guest.attendingCount || 1), 0
    );
    
    let totalAvailableCapacityInExisting = 0;
    let totalAvailableInEmpty = 0;
    const tableCapacityDetails = [];
    
    tables.forEach(table => {
      const tableGuestIds = (seatingArrangement && seatingArrangement[table.id]) || [];
      const tableGuests = tableGuestIds.map(guestId => 
        guests.find(g => g._id === guestId)
      ).filter(Boolean);
      
      const hasSGroupGuests = tableGuests.some(g => {
        const group = g.customGroup || g.group;
        const policy = effectiveGroupPolicies[group];
        return policy === 'S';
      });
      
      const currentOccupancy = tableGuests.reduce((sum, g) => 
        sum + (g.attendingCount || 1), 0
      );
      
      const availableCapacity = Math.max(0, table.capacity - currentOccupancy);
      
      const isEmpty = tableGuests.length === 0;
      const status = isEmpty ? 'EMPTY' : 
                    hasSGroupGuests ? 'HAS_S' : 'HAS_GUESTS';
      
      tableCapacityDetails.push({
        name: table.name,
        capacity: table.capacity,
        occupied: currentOccupancy,
        available: availableCapacity,
        status: status,
        isEmpty: isEmpty
      });
      
      if (!hasSGroupGuests && availableCapacity > 0) {
        totalAvailableCapacityInExisting += availableCapacity;
        if (isEmpty) {
          totalAvailableInEmpty += availableCapacity;
        }
      }
    });
    
    if (!shouldAllowMixing) {
      const groupCounts = {};
      unseatedGuests.forEach(guest => {
        const group = guest.customGroup || guest.group;
        if (!groupCounts[group]) {
          groupCounts[group] = 0;
        }
        groupCounts[group] += (guest.attendingCount || 1);
      });
      
      const existingTablesByGroup = {};
      if (seatingArrangement && Object.keys(seatingArrangement).length > 0) {
        tables.forEach(table => {
          const tableGuestIds = seatingArrangement[table.id] || [];
          if (tableGuestIds.length === 0) return;
          
          const tableGuests = tableGuestIds.map(guestId => 
            guests.find(g => g._id === guestId)
          ).filter(Boolean);
          
          if (tableGuests.length > 0) {
            const groupsInTable = {};
            tableGuests.forEach(guest => {
              const group = guest.customGroup || guest.group;
              groupsInTable[group] = (groupsInTable[group] || 0) + (guest.attendingCount || 1);
            });
            
            const dominantGroup = Object.keys(groupsInTable).reduce((a, b) => 
              groupsInTable[a] > groupsInTable[b] ? a : b
            );
            
            if (!existingTablesByGroup[dominantGroup]) {
              existingTablesByGroup[dominantGroup] = [];
            }
            
            const currentOccupancy = tableGuests.reduce((sum, g) => 
              sum + (g.attendingCount || 1), 0
            );
            const availableCapacity = table.capacity - currentOccupancy;
            
            if (availableCapacity > 0) {
              existingTablesByGroup[dominantGroup].push({
                tableId: table.id,
                tableName: table.name,
                availableCapacity
              });
            }
          }
        });
      }
      
      Object.entries(groupCounts).forEach(([group, totalPeople]) => {
        let peopleNeedingSeats = totalPeople;
        
        if (existingTablesByGroup[group]) {
          existingTablesByGroup[group].forEach(tableInfo => {
            if (peopleNeedingSeats > 0) {
              const canSeat = Math.min(tableInfo.availableCapacity, peopleNeedingSeats);
              peopleNeedingSeats -= canSeat;
            }
          });
        }
                
        while (peopleNeedingSeats > 0) {
          const preferredTableSize = aiPreferences.preferredTableSize || 12;
          let tableSize;
          
          if (peopleNeedingSeats <= 6) {
            tableSize = 8;
          } else if (peopleNeedingSeats <= 8) {
            tableSize = 10;
          } else if (peopleNeedingSeats <= 14) {
            tableSize = 12;
          } else {
            tableSize = preferredTableSize;
          }
          
          const tableIndex = newTableSettings.findIndex(s => s.capacity === tableSize);
          if (tableIndex !== -1) {
            newTableSettings[tableIndex].count += 1;
          }
          
          peopleNeedingSeats -= tableSize;
        }
      });
      
      setTableSettings(newTableSettings);
      return;
    }
        
    const groupsByPolicy = {
      separate: [],
      mixable: []
    };
    
    const groupSizes = {};
    unseatedGuests.forEach(guest => {
      const group = guest.customGroup || guest.group;
      const policy = effectiveGroupPolicies[group];
      const size = guest.attendingCount || 1;
      
      if (!groupSizes[group]) {
        groupSizes[group] = 0;
      }
      groupSizes[group] += size;
            
      if (policy === 'S') {
        if (!groupsByPolicy.separate.find(g => g.name === group)) {
          groupsByPolicy.separate.push({ name: group, size: 0 });
        }
        const groupObj = groupsByPolicy.separate.find(g => g.name === group);
        groupObj.size += size;
      } else {
        if (!groupsByPolicy.mixable.find(g => g.name === group)) {
          groupsByPolicy.mixable.push({ name: group, size: 0 });
        }
        const groupObj = groupsByPolicy.mixable.find(g => g.name === group);
        groupObj.size += size;
      }
    });
    
    let availableForSGroups = 0;
    
    groupsByPolicy.separate.forEach(group => {
      let reservedCapacity = 0;
      
      tables.forEach(table => {
        const tableGuestIds = (seatingArrangement && seatingArrangement[table.id]) || [];
        const tableGuests = tableGuestIds.map(guestId => 
          guests.find(g => g._id === guestId)
        ).filter(Boolean);
        
        const hasThisGroup = tableGuests.some(g => {
          const guestGroup = g.customGroup || g.group;
          return guestGroup === group.name;
        });
        
        if (hasThisGroup) {
          const currentOccupancy = tableGuests.reduce((sum, g) => 
            sum + (g.attendingCount || 1), 0
          );
          const availableCapacity = Math.max(0, table.capacity - currentOccupancy);
          reservedCapacity += availableCapacity;
        }
      });
      
      let remaining = Math.max(0, group.size - reservedCapacity);
      const preferredTableSize = aiPreferences.preferredTableSize || 12;
      
      while (remaining > 0) {
        let tableSize;
        
        if (remaining <= 6) {
          tableSize = 8;
        } else if (remaining <= 8) {
          tableSize = 10;
        } else if (remaining <= 14) {
          tableSize = 12;
        } else {
          tableSize = preferredTableSize;
        }
        
        const tableIndex = newTableSettings.findIndex(s => s.capacity === tableSize);
        if (tableIndex !== -1) {
          newTableSettings[tableIndex].count += 1;
        }
        
        remaining -= tableSize;
      }
    });
    
    const hasMixingRules = aiPreferences.groupMixingRules && aiPreferences.groupMixingRules.length > 0;
    
    if (hasMixingRules) {
      const groupsInRules = new Set();
      aiPreferences.groupMixingRules.forEach(rule => {
        const policy1 = effectiveGroupPolicies[rule.group1];
        const policy2 = effectiveGroupPolicies[rule.group2];
        
        if (policy1 !== 'S') {
          groupsInRules.add(rule.group1);
        }
        if (policy2 !== 'S') {
          groupsInRules.add(rule.group2);
        }
      });
          
      let clusteredGroupsSize = 0;
      groupsByPolicy.mixable.forEach(group => {
        if (groupsInRules.has(group.name)) {
          clusteredGroupsSize += group.size;
        }
      });
      
      let nonClusteredGroupsSize = 0;
      groupsByPolicy.mixable.forEach(group => {
        if (!groupsInRules.has(group.name)) {
          nonClusteredGroupsSize += group.size;
        }
      });
          
      if (clusteredGroupsSize > 0) {
        const neededForClustered = Math.max(0, clusteredGroupsSize - totalAvailableCapacityInExisting);
        const preferredTableSize = aiPreferences.preferredTableSize || 12;
        
        if (neededForClustered > 0) {
          let remaining = neededForClustered;
          
          while (remaining > 0) {
            let tableSize;
            
            if (remaining <= 6) {
              tableSize = 8;
            } else if (remaining <= 8) {
              tableSize = 10;
            } else if (remaining <= 14) {
              tableSize = 12;
            } else {
              tableSize = preferredTableSize;
            }
            
            const tableIndex = newTableSettings.findIndex(s => s.capacity === tableSize);
            if (tableIndex !== -1) {
              newTableSettings[tableIndex].count += 1;
            }
            
            remaining -= tableSize;
          }
        }
      }
      
    } else {
      const mixableTotal = groupsByPolicy.mixable.reduce((sum, group) => sum + group.size, 0);
      
      const neededForMixable = Math.max(0, mixableTotal - totalAvailableCapacityInExisting);
      
      if (neededForMixable > 0) {
        let remaining = neededForMixable;
        const preferredTableSize = aiPreferences.preferredTableSize || 12;
        
        while (remaining > 0) {
          let tableSize;
          
          if (remaining <= 6) {
            tableSize = 8;
          } else if (remaining <= 8) {
            tableSize = 10;
          } else if (remaining <= 14) {
            tableSize = 12;
          } else {
            tableSize = preferredTableSize;
          }
          
          const tableIndex = newTableSettings.findIndex(s => s.capacity === tableSize);
          if (tableIndex !== -1) {
            newTableSettings[tableIndex].count += 1;
          }
          
          remaining -= tableSize;
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
        autoSuggestTables(totalGuests, null, aiPreferences.groupPolicies);
      }
    } else if (action === 'continue') {
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const seatedGuestsCount = getSeatedGuestsCount();
      const unseatedGuestsCount = totalGuests - seatedGuestsCount;
      const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
      const availableCapacity = totalCapacity - seatedGuestsCount;
      
      if (availableCapacity < unseatedGuestsCount) {
        setShowTableCreation(true);
        autoSuggestTables(unseatedGuestsCount, null, aiPreferences.groupPolicies);
      }
    }
  };

  const addCustomTableType = () => {
    const newCustomTable = {
      id: `custom_${Date.now()}`,
      type: 'round',
      capacity: 12,
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

  const addGroupMixRule = () => {
    if (newGroupMixRule.group1 && newGroupMixRule.group2 && newGroupMixRule.group1 !== newGroupMixRule.group2) {
      setAiPreferences(prev => ({
        ...prev,
        groupMixingRules: [...prev.groupMixingRules, {
          id: Date.now().toString(),
          group1: newGroupMixRule.group1,
          group2: newGroupMixRule.group2
        }]
      }));
      setNewGroupMixRule({ group1: '', group2: '' });
    }
  };

  const removeGroupMixRule = (ruleId) => {
    setAiPreferences(prev => ({
      ...prev,
      groupMixingRules: prev.groupMixingRules.filter(rule => rule.id !== ruleId)
    }));
  };

  const addMustSitRule = () => {
    if (newMustSitRule.guest1Id && newMustSitRule.guest2Id && newMustSitRule.guest1Id !== newMustSitRule.guest2Id) {
      setSeatingRules(prev => ({
        ...prev,
        mustSitTogether: [...prev.mustSitTogether, {
          id: Date.now().toString(),
          guest1Id: newMustSitRule.guest1Id,
          guest2Id: newMustSitRule.guest2Id,
          reason: newMustSitRule.reason
        }]
      }));
      setNewMustSitRule({ guest1Id: '', guest2Id: '', reason: '' });
    }
  };

  const removeMustSitRule = (ruleId) => {
    setSeatingRules(prev => ({
      ...prev,
      mustSitTogether: prev.mustSitTogether.filter(rule => rule.id !== ruleId)
    }));
  };

  const addCannotSitRule = () => {
    if (newCannotSitRule.guest1Id && newCannotSitRule.guest2Id && newCannotSitRule.guest1Id !== newCannotSitRule.guest2Id) {
      setSeatingRules(prev => ({
        ...prev,
        cannotSitTogether: [...prev.cannotSitTogether, {
          id: Date.now().toString(),
          guest1Id: newCannotSitRule.guest1Id,
          guest2Id: newCannotSitRule.guest2Id,
          reason: newCannotSitRule.reason
        }]
      }));
      setNewCannotSitRule({ guest1Id: '', guest2Id: '', reason: '' });
    }
  };

  const removeCannotSitRule = (ruleId) => {
    setSeatingRules(prev => ({
      ...prev,
      cannotSitTogether: prev.cannotSitTogether.filter(rule => rule.id !== ruleId)
    }));
  };

  const getGuestName = (guestId) => {
    const guest = guests.find(g => g._id === guestId);
    return guest ? `${guest.firstName} ${guest.lastName}` : t('seating.ai.unknownGuest');
  };

  const getGroupDisplayName = (groupName) => {
    if (['family', 'friends', 'work', 'other'].includes(groupName)) {
      return t(`guests.groups.${groupName}`);
    }
    return groupName;
  };

  const handleGenerate = async (customPreferences = null) => {
    setIsGenerating(true);
    
    try {
      const generationOptions = customPreferences || {
        ...aiPreferences,
        preserveExisting: existingArrangementAction === 'continue',
        clearExisting: existingArrangementAction === 'clear',
        currentArrangement: seatingArrangement,
        seatingRules,
        groupMixingRules: aiPreferences.groupMixingRules,
        groupPolicies: aiPreferences.groupPolicies
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
          currentArrangement: seatingArrangement,
          allTables: allTablesForGeneration,
          seatingRules,
          groupMixingRules: aiPreferences.groupMixingRules,
          groupPolicies: aiPreferences.groupPolicies
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
        allTables: tables,
        currentArrangement: seatingArrangement,
        seatingRules,
        groupMixingRules: aiPreferences.groupMixingRules,
        groupPolicies: aiPreferences.groupPolicies
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

  const handleAllowGroupMixingChange = (value) => {
    const updatedPreferences = {
      ...aiPreferences,
      allowGroupMixing: value
    };
    
    setAiPreferences(updatedPreferences);
    
    const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    let guestsNeedingCalculation = 0;
    
    if (existingArrangementAction === 'continue') {
      const seatedGuestsCount = getSeatedGuestsCount();
      guestsNeedingCalculation = totalGuests - seatedGuestsCount;
    } else {
      guestsNeedingCalculation = totalGuests;
    }
    
    autoSuggestTables(guestsNeedingCalculation, value, updatedPreferences.groupPolicies);
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
                            clearExisting: false,
                            currentArrangement: seatingArrangement,
                            seatingRules,
                            groupMixingRules: aiPreferences.groupMixingRules
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

          {!showExistingArrangementWarning && (
            <>
              {!showTableCreation && (
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
                            {getGroupDisplayName(group)}
                          </div>
                          <div className="group-numbers">
                            {stats.count} {t('seating.ai.guests')} ({stats.people} {t('seating.ai.people')})
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="seating-rules-section">
                <div className="section-header">
                  <h4>{t('seating.ai.seatingRules')}</h4>
                  <button
                    type="button"
                    onClick={() => setShowSeatingRules(!showSeatingRules)}
                    className="toggle-section-btn"
                  >
                    {showSeatingRules ? t('seating.ai.hideRules') : t('seating.ai.showRules')}
                  </button>
                </div>

                {showSeatingRules && (
                  <div className="seating-rules-config">
                    <div className="rule-group">
                      <h5>{t('seating.ai.mustSitTogether')}</h5>
                      <div className="add-rule-form">
                        <select
                          value={newMustSitRule.guest1Id}
                          onChange={(e) => setNewMustSitRule(prev => ({ ...prev, guest1Id: e.target.value }))}
                          className="guest-select"
                        >
                          <option value="">{t('seating.ai.selectFirstGuest')}</option>
                          {guests.map(guest => (
                            <option key={guest._id} value={guest._id}>
                              {guest.firstName} {guest.lastName}
                            </option>
                          ))}
                        </select>
                        
                        <select
                          value={newMustSitRule.guest2Id}
                          onChange={(e) => setNewMustSitRule(prev => ({ ...prev, guest2Id: e.target.value }))}
                          className="guest-select"
                        >
                          <option value="">{t('seating.ai.selectSecondGuest')}</option>
                          {guests.filter(guest => guest._id !== newMustSitRule.guest1Id).map(guest => (
                            <option key={guest._id} value={guest._id}>
                              {guest.firstName} {guest.lastName}
                            </option>
                          ))}
                        </select>
                        
                        <input
                          type="text"
                          value={newMustSitRule.reason}
                          onChange={(e) => setNewMustSitRule(prev => ({ ...prev, reason: e.target.value }))}
                          placeholder={t('seating.ai.reasonOptional')}
                          className="reason-input"
                        />
                        
                        <button
                          type="button"
                          onClick={addMustSitRule}
                          disabled={!newMustSitRule.guest1Id || !newMustSitRule.guest2Id}
                          className="add-rule-btn"
                        >
                          {t('seating.ai.addRule')}
                        </button>
                      </div>
                      
                      {seatingRules.mustSitTogether.length > 0 && (
                        <div className="rules-list">
                          {seatingRules.mustSitTogether.map(rule => (
                            <div key={rule.id} className="rule-item must-sit">
                              <div className="rule-content">
                                <span className="rule-guests">
                                  {getGuestName(rule.guest1Id)} ↔ {getGuestName(rule.guest2Id)}
                                </span>
                                {rule.reason && <span className="rule-reason">{rule.reason}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeMustSitRule(rule.id)}
                                className="remove-rule-btn"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rule-group">
                      <h5>{t('seating.ai.cannotSitTogether')}</h5>
                      <div className="add-rule-form">
                        <select
                          value={newCannotSitRule.guest1Id}
                          onChange={(e) => setNewCannotSitRule(prev => ({ ...prev, guest1Id: e.target.value }))}
                          className="guest-select"
                        >
                          <option value="">{t('seating.ai.selectFirstGuest')}</option>
                          {guests.map(guest => (
                            <option key={guest._id} value={guest._id}>
                              {guest.firstName} {guest.lastName}
                            </option>
                          ))}
                        </select>
                        
                        <select
                          value={newCannotSitRule.guest2Id}
                          onChange={(e) => setNewCannotSitRule(prev => ({ ...prev, guest2Id: e.target.value }))}
                          className="guest-select"
                        >
                          <option value="">{t('seating.ai.selectSecondGuest')}</option>
                          {guests.filter(guest => guest._id !== newCannotSitRule.guest1Id).map(guest => (
                            <option key={guest._id} value={guest._id}>
                              {guest.firstName} {guest.lastName}
                            </option>
                          ))}
                        </select>
                        
                        <input
                          type="text"
                          value={newCannotSitRule.reason}
                          onChange={(e) => setNewCannotSitRule(prev => ({ ...prev, reason: e.target.value }))}
                          placeholder={t('seating.ai.reasonOptional')}
                          className="reason-input"
                        />
                        
                        <button
                          type="button"
                          onClick={addCannotSitRule}
                          disabled={!newCannotSitRule.guest1Id || !newCannotSitRule.guest2Id}
                          className="add-rule-btn"
                        >
                          {t('seating.ai.addRule')}
                        </button>
                      </div>
                      
                      {seatingRules.cannotSitTogether.length > 0 && (
                        <div className="rules-list">
                          {seatingRules.cannotSitTogether.map(rule => (
                            <div key={rule.id} className="rule-item cannot-sit">
                              <div className="rule-content">
                                <span className="rule-guests">
                                  {getGuestName(rule.guest1Id)} ⚠️ {getGuestName(rule.guest2Id)}
                                </span>
                                {rule.reason && <span className="rule-reason">{rule.reason}</span>}
                              </div>
                              <button
                                type="button"
                                onClick={() => removeCannotSitRule(rule.id)}
                                className="remove-rule-btn"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
                      checked={aiPreferences.allowGroupMixing}
                      onChange={(e) => handleAllowGroupMixingChange(e.target.checked)}
                    />
                    <div className="preference-content">
                      <div className="preference-title">{t('seating.ai.allowGroupMixingTitle')}</div>
                      <div className="preference-description">
                        {aiPreferences.groupMixingRules && aiPreferences.groupMixingRules.length > 0
                          ? t('seating.ai.allowGroupMixingWithRules')
                          : t('seating.ai.allowGroupMixingFree')}
                      </div>
                    </div>
                  </label>
                </div>

                {aiPreferences.allowGroupMixing && (
                  <div className="group-mixing-section">
                    <div className="section-header">
                      <h5>{t('seating.ai.groupMixingRules')}</h5>
                      <button
                        type="button"
                        onClick={() => setShowGroupMixingConfig(!showGroupMixingConfig)}
                        className="toggle-section-btn"
                      >
                        {showGroupMixingConfig ? t('seating.ai.hideMixing') : t('seating.ai.showMixing')}
                      </button>
                    </div>

                    {showGroupMixingConfig && (
                      <div className="group-mixing-config">
                        <div className="add-mix-rule-form">
                          <select
                            value={newGroupMixRule.group1}
                            onChange={(e) => setNewGroupMixRule(prev => ({ ...prev, group1: e.target.value }))}
                            className="group-select"
                          >
                            <option value="">{t('seating.ai.selectFirstGroup')}</option>
                            {availableGroups.map(group => (
                              <option key={group} value={group}>
                                {getGroupDisplayName(group)}
                              </option>
                            ))}
                          </select>
                          
                          <select
                            value={newGroupMixRule.group2}
                            onChange={(e) => setNewGroupMixRule(prev => ({ ...prev, group2: e.target.value }))}
                            className="group-select"
                          >
                            <option value="">{t('seating.ai.selectSecondGroup')}</option>
                            {availableGroups.filter(group => group !== newGroupMixRule.group1).map(group => (
                              <option key={group} value={group}>
                                {getGroupDisplayName(group)}
                              </option>
                            ))}
                          </select>
                          
                          <button
                            type="button"
                            onClick={addGroupMixRule}
                            disabled={!newGroupMixRule.group1 || !newGroupMixRule.group2}
                            className="add-rule-btn"
                          >
                            {t('seating.ai.addMixRule')}
                          </button>
                        </div>
                        
                        {aiPreferences.groupMixingRules.length > 0 && (
                          <div className="mix-rules-list">
                            {aiPreferences.groupMixingRules.map(rule => (
                              <div key={rule.id} className="mix-rule-item">
                                <div className="mix-rule-content">
                                  <span className="mix-rule-groups">
                                    {getGroupDisplayName(rule.group1)} + {getGroupDisplayName(rule.group2)}
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeGroupMixRule(rule.id)}
                                  className="remove-rule-btn"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                {aiPreferences.allowGroupMixing && (
                  <div className="group-policies-section">
                    <div className="section-header">
                      <h5>{t('seating.ai.groupPolicies')}</h5>
                      <button
                        type="button"
                        onClick={() => setShowGroupPolicies(!showGroupPolicies)}
                        className="toggle-section-btn"
                      >
                        {showGroupPolicies ? t('seating.ai.hidePolicies') : t('seating.ai.showPolicies')}
                      </button>
                    </div>

                    {showGroupPolicies && (
                      <div className="group-policies-config">
                        <div className="policies-info">
                          {t('seating.ai.groupPoliciesDescription')}
                        </div>
                        <div className="group-policies-list">
                          {(() => {
                            const groupsInMixingRules = new Set();
                            if (aiPreferences.groupMixingRules && aiPreferences.groupMixingRules.length > 0) {
                              aiPreferences.groupMixingRules.forEach(rule => {
                                groupsInMixingRules.add(rule.group1);
                                groupsInMixingRules.add(rule.group2);
                              });
                            }
                            
                            const availableGroupsForPolicy = availableGroups.filter(group => 
                              !groupsInMixingRules.has(group)
                            );

                            if (availableGroupsForPolicy.length === 0) {
                              return (
                                <div className="no-groups-message">
                                  {t('seating.ai.allGroupsInMixingRules')}
                                </div>
                              );
                            }

                            return availableGroupsForPolicy.map(group => {
                              const currentPolicy = aiPreferences.groupPolicies[group] || 'M';
                              return (
                                <div key={group} className="group-policy-item">
                                  <span className="group-policy-name">
                                    {getGroupDisplayName(group)}
                                  </span>
                                  <select
                                    value={currentPolicy}
                                    onChange={(e) => {
                                      setAiPreferences(prev => ({
                                        ...prev,
                                        groupPolicies: {
                                          ...prev.groupPolicies,
                                          [group]: e.target.value
                                        }
                                      }));
                                    }}
                                    className="policy-select"
                                  >
                                    <option value="M">{t('seating.ai.policyMixable')}</option>
                                    <option value="S">{t('seating.ai.policySeparate')}</option>
                                  </select>
                                  <div className="policy-description">
                                    {currentPolicy === 'S' 
                                      ? t('seating.ai.policySeparateDesc')
                                      : t('seating.ai.policyMixableDesc')}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                    )}
                  </div>
                )}
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