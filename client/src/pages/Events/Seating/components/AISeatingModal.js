import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  getNextTableNumber,
  isSeparatedSeating = false,
  maleTables = [],
  femaleTables = [],
  maleArrangement = {},
  femaleArrangement = {},
  canEdit = true,
  onFetchTableSuggestion,
  eventId,
  onPreferencesChange
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
    { type: 'round', capacity: 10, count: 0 },
    { type: 'round', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 24, count: 0 }
  ]);
 
  const [customTableSettings, setCustomTableSettings] = useState([]);
 
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTableCreation, setShowTableCreation] = useState(false);
  const [showExistingArrangementWarning, setShowExistingArrangementWarning] = useState(false);
  const [existingArrangementAction, setExistingArrangementAction] = useState('');
  const [initialLoad, setInitialLoad] = useState(true);
  const [isFetchingSuggestion, setIsFetchingSuggestion] = useState(false);
  const [capacityWarning, setCapacityWarning] = useState('');
  const [showGroupMixingConfig, setShowGroupMixingConfig] = useState(false);
  const [newGroupMixRule, setNewGroupMixRule] = useState({
    group1: '',
    group2: '',
  });

  const [showSeatingRules, setShowSeatingRules] = useState(false);
  const [seatingRules, setSeatingRules] = useState({
    mustSitTogether: []
  });
  const [newMustSitRule, setNewMustSitRule] = useState({
    guest1Id: '',
    guest2Id: ''
  });

  const [showGroupPolicies, setShowGroupPolicies] = useState(false);

  const [genderView, setGenderView] = useState('male');
  const [maleTableSettings, setMaleTableSettings] = useState([
    { type: 'round', capacity: 10, count: 0 },
    { type: 'round', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 24, count: 0 }
  ]);

  const [femaleTableSettings, setFemaleTableSettings] = useState([
    { type: 'round', capacity: 10, count: 0 },
    { type: 'round', capacity: 12, count: 0 },
    { type: 'rectangular', capacity: 24, count: 0 }
  ]);

  const [customMaleTableSettings, setCustomMaleTableSettings] = useState([]);
  const [customFemaleTableSettings, setCustomFemaleTableSettings] = useState([]);

  // Store original suggested table settings to detect user modifications
  const [suggestedTableSettings, setSuggestedTableSettings] = useState(null);
  const [suggestedMaleTableSettings, setSuggestedMaleTableSettings] = useState(null);
  const [suggestedFemaleTableSettings, setSuggestedFemaleTableSettings] = useState(null);

  const isFetchingRef = useRef(false);
  const lastFetchKey = useRef('');
  const isInitializingPrefsRef = useRef(false);

  const canAddMustSitRule = React.useMemo(() => {
  if (!newMustSitRule.guest1Id || !newMustSitRule.guest2Id) {
    return { canAdd: false, reason: '' };
  }
 
  if (newMustSitRule.guest1Id === newMustSitRule.guest2Id) {
    return { canAdd: false, reason: t('seating.ai.errorSameGuest') };
  }
 
  const guest1 = guests.find(g => g._id === newMustSitRule.guest1Id);
  const guest2 = guests.find(g => g._id === newMustSitRule.guest2Id);
 
  if (!guest1 || !guest2) {
    return { canAdd: false, reason: '' };
  }
 
  const group1 = guest1.customGroup || guest1.group;
  const group2 = guest2.customGroup || guest2.group;
 
  if (group1 !== group2) {
    return { canAdd: false, reason: t('seating.ai.errorDifferentGroups') };
  }
 
  return { canAdd: true, reason: '' };
}, [newMustSitRule.guest1Id, newMustSitRule.guest2Id, guests]);

  const hasExistingArrangement = isSeparatedSeating
    ? (maleArrangement && Object.keys(maleArrangement).length > 0 && Object.values(maleArrangement).some(arr => arr.length > 0)) ||
      (femaleArrangement && Object.keys(femaleArrangement).length > 0 && Object.values(femaleArrangement).some(arr => arr.length > 0))
    : (seatingArrangement && Object.keys(seatingArrangement).length > 0 && Object.values(seatingArrangement).some(arr => arr.length > 0));

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

  const maleGuests = useMemo(() => {
    if (!isSeparatedSeating || !guests) return [];
    return guests
      .filter(g => g.maleCount && g.maleCount > 0)
      .map(g => ({
        ...g,
        attendingCount: g.maleCount
      }));
  }, [guests, isSeparatedSeating]);

  const femaleGuests = useMemo(() => {
    if (!isSeparatedSeating || !guests) return [];
    return guests
      .filter(g => g.femaleCount && g.femaleCount > 0)
      .map(g => ({
        ...g,
        attendingCount: g.femaleCount
      }));
  }, [guests, isSeparatedSeating]);

  useEffect(() => {
    if (isOpen && preferences) {
      isInitializingPrefsRef.current = true;
      setAiPreferences(prev => ({
        ...prev,
        allowGroupMixing: preferences.allowGroupMixing || false,
        groupMixingRules: preferences.groupMixingRules || [],
        groupPolicies: preferences.groupPolicies || {},
        preferredTableSize: preferences.preferredTableSize || 12
      }));
      setTimeout(() => {
        isInitializingPrefsRef.current = false;
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isInitializingPrefsRef.current) return;
    if (onPreferencesChange && isOpen) {
      onPreferencesChange({
        seatingRules: seatingRules,
        allowGroupMixing: aiPreferences.allowGroupMixing,
        groupMixingRules: aiPreferences.groupMixingRules,
        groupPolicies: aiPreferences.groupPolicies,
        preferredTableSize: aiPreferences.preferredTableSize
      });
    }
  }, [seatingRules, aiPreferences.allowGroupMixing, aiPreferences.groupMixingRules, aiPreferences.groupPolicies, aiPreferences.preferredTableSize, isOpen, onPreferencesChange]);

  useEffect(() => {
    if (!isOpen) {
      setIsGenerating(false);
      setShowTableCreation(false);
      setShowExistingArrangementWarning(false);
      setExistingArrangementAction('');
      setInitialLoad(true);
      setShowGroupMixingConfig(false);
      setShowSeatingRules(false);
      setGenderView('male');
      isFetchingRef.current = false;
      lastFetchKey.current = '';
    } else if (initialLoad) {
      setInitialLoad(false);
     
      const loadInitialSuggestion = async () => {
        if (preferences?.seatingRules) {
          setSeatingRules({
            mustSitTogether: preferences.seatingRules.mustSitTogether || [],
            cannotSitTogether: preferences.seatingRules.cannotSitTogether || []
          });
        }
       
        if (isSeparatedSeating) {
          const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
          const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
          const totalMaleCapacity = maleTables.reduce((sum, table) => sum + table.capacity, 0);
          const totalFemaleCapacity = femaleTables.reduce((sum, table) => sum + table.capacity, 0);
         
          if (hasExistingArrangement && (Object.keys(maleArrangement).length > 0 || Object.keys(femaleArrangement).length > 0)) {
            setShowExistingArrangementWarning(true);
            return;
          }
         
          if (totalMaleCapacity < totalMaleGuests || maleTables.length === 0) {
            setShowTableCreation(true);
            if (maleTables.length === 0) {
              await autoSuggestTables(totalMaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'male');
            }
          }
         
          if (totalFemaleCapacity < totalFemaleGuests || femaleTables.length === 0) {
            setShowTableCreation(true);
            if (femaleTables.length === 0) {
              await autoSuggestTables(totalFemaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'female');
            }
          }
        } else {
          const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
          const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
         
          if (hasExistingArrangement && Object.keys(seatingArrangement).length > 0) {
            setShowExistingArrangementWarning(true);
            return;
          }
         
          if (totalCapacity < totalGuests || tables.length === 0) {
            setShowTableCreation(true);
            if (tables.length === 0) {
              await autoSuggestTables(totalGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies);
            }
          } else {
            setShowTableCreation(false);
          }
        }
      };
     
      loadInitialSuggestion();
    }
  }, [isOpen, initialLoad]); 

  useEffect(() => {
    if (!isOpen || initialLoad || !showTableCreation) {
      return;
    }

    if (!aiPreferences.allowGroupMixing || Object.keys(aiPreferences.groupPolicies).length === 0) {
      return;
    }
     
    const updateSuggestion = async () => {

      if (isSeparatedSeating) {
        const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
        const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
        const totalMaleCapacity = maleTables.reduce((sum, table) => sum + table.capacity, 0);
        const totalFemaleCapacity = femaleTables.reduce((sum, table) => sum + table.capacity, 0);
       
        let maleGuestsNeedingSeats = 0;
        let femaleGuestsNeedingSeats = 0;
       
        if (existingArrangementAction === 'continue') {
          const seatedMaleGuestsCount = getSeatedGuestsCount('male');
          const seatedFemaleGuestsCount = getSeatedGuestsCount('female');
          maleGuestsNeedingSeats = totalMaleGuests - seatedMaleGuestsCount;
          femaleGuestsNeedingSeats = totalFemaleGuests - seatedFemaleGuestsCount;
        } else {
          maleGuestsNeedingSeats = totalMaleGuests;
          femaleGuestsNeedingSeats = totalFemaleGuests;
        }
       
        if (totalMaleCapacity < maleGuestsNeedingSeats) {
          await autoSuggestTables(maleGuestsNeedingSeats, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'male');
        }
       
        if (totalFemaleCapacity < femaleGuestsNeedingSeats) {
          await autoSuggestTables(femaleGuestsNeedingSeats, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'female');
        }
      } else {
        const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
        let guestsNeedingSeats = 0;
       
        if (existingArrangementAction === 'continue') {
          const seatedGuestsCount = getSeatedGuestsCount();
          guestsNeedingSeats = totalGuests - seatedGuestsCount;
        } else {
          guestsNeedingSeats = totalGuests;
        }
       
        if (totalCapacity < guestsNeedingSeats) {
          await autoSuggestTables(guestsNeedingSeats, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies);
        }
      }
    };
   
    updateSuggestion();
  }, [aiPreferences.allowGroupMixing, aiPreferences.groupPolicies]); 

 useEffect(() => {
  if (!showTableCreation) {
    setCapacityWarning('');
    return;
  }

  const calculateBufferPercent = (customSettings, allowMixing, groupMixingRules, groupPolicies, isSeparated = false) => {
    const hasSmallTables = customSettings.some(s => s.count > 0 && s.capacity < 10);
    const hasMediumTables = customSettings.some(s => s.count > 0 && s.capacity >= 10 && s.capacity <= 12);
    const hasNonStandardTables = customSettings.some(s => s.count > 0 && 
      ((s.capacity >= 13 && s.capacity <= 23) || (s.capacity >= 25 && s.capacity <= 30)));
    
    if (allowMixing && (!groupMixingRules || groupMixingRules.length === 0)) {
      if (isSeparated) {
        if (hasSmallTables) return 1.35;
        if (hasNonStandardTables) return 1.35;
        if (hasMediumTables) return 1.25;
        return 1.20;
      }
      if (hasSmallTables) return 1.15;
      if (hasNonStandardTables) return 1.15;
      if (hasMediumTables) return 1.10;
      return 1.05;
    }
    
    if ((groupMixingRules && groupMixingRules.length > 0) || (groupPolicies && Object.keys(groupPolicies).length > 0)) {
      if (isSeparated) {
        if (hasSmallTables) return 1.50;
        if (hasNonStandardTables) return 1.50;
        if (hasMediumTables) return 1.40;
        return 1.25;
      }
      if (hasSmallTables) return 1.25;
      if (hasNonStandardTables) return 1.25;
      if (hasMediumTables) return 1.15;
      return 1.10;
    }

    if (isSeparated) {
      if (hasSmallTables) return 2;
      if (hasNonStandardTables) return 2.5;
      if (hasMediumTables) return 1.95;
      return 1.25;
    }
    
    if (hasSmallTables) return 1.3;
    if (hasNonStandardTables) return 1.35;
    if (hasMediumTables) return 1.15;
    return 1.10;
  };

  const checkCapacityForSide = (presetSettings, customSettings, existingTables, guestsCount, suggestedSettings = null) => {
    const presetCapacity = presetSettings.reduce((sum, s) => sum + (s.count * s.capacity), 0);
    const customCapacity = customSettings.reduce((sum, s) => sum + (s.count * s.capacity), 0);
    const existingCapacity = existingTables.reduce((sum, table) => sum + table.capacity, 0);
    const totalAvailable = presetCapacity + customCapacity + existingCapacity;

    const presetTablesCount = presetSettings.reduce((sum, s) => sum + s.count, 0);
    const customTablesCount = customSettings.reduce((sum, s) => sum + s.count, 0);
    const totalPlannedTables = presetTablesCount + customTablesCount;
    const usingCustomOnly = presetTablesCount === 0 && customTablesCount > 0;

    // Check if preset tables were modified from the original suggestion
    const usingModifiedPreset = suggestedSettings &&
      !usingCustomOnly &&
      presetTablesCount > 0 &&
      JSON.stringify(presetSettings.map(s => s.count)) !== JSON.stringify(suggestedSettings.map(s => s.count));
    
    const hasInvalidSize = customSettings.some(s => s.count > 0 && s.capacity < 8);
    if (hasInvalidSize) {
      return { valid: false, reason: 'invalidSize' };
    }
    
    let largestTableCapacity = 0;
    presetSettings.forEach(s => {
      if (s.count > 0 && s.capacity > largestTableCapacity) largestTableCapacity = s.capacity;
    });
    customSettings.forEach(s => {
      if (s.count > 0 && s.capacity > largestTableCapacity) largestTableCapacity = s.capacity;
    });
    
    let requiredCapacity = guestsCount;
    if (usingCustomOnly) {
      const bufferPercent = calculateBufferPercent(
        customSettings, 
        aiPreferences.allowGroupMixing,
        aiPreferences.groupMixingRules,
        aiPreferences.groupPolicies,
        isSeparatedSeating
      );
      requiredCapacity = Math.ceil(guestsCount * bufferPercent);
    }
    
    // Skip capacity warnings when using custom tables only or modified preset tables - emergency tables will be created if needed
    if (usingCustomOnly || usingModifiedPreset) {
      return { valid: true };
    }

    if (totalPlannedTables === 0 && existingCapacity < guestsCount) {
      return { valid: false, reason: 'noTables', missing: guestsCount - existingCapacity };
    }

    if (totalAvailable < requiredCapacity) {
      return { valid: false, reason: 'insufficientCapacity', missing: requiredCapacity - totalAvailable };
    }

    return { valid: true };
  };

  if (isSeparatedSeating) {
    const maleGuestsCount = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
    const femaleGuestsCount = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);

    const maleCheck = checkCapacityForSide(maleTableSettings, customMaleTableSettings, maleTables, maleGuestsCount, suggestedMaleTableSettings);
    const femaleCheck = checkCapacityForSide(femaleTableSettings, customFemaleTableSettings, femaleTables, femaleGuestsCount, suggestedFemaleTableSettings);
    
    const largestMaleGuestSize = guests.reduce((max, guest) => Math.max(max, guest.maleCount || 0), 0);
    const largestFemaleGuestSize = guests.reduce((max, guest) => Math.max(max, guest.femaleCount || 0), 0);
    
    let largestMaleTableCapacity = 0;
    maleTableSettings.forEach(s => { if (s.count > 0) largestMaleTableCapacity = Math.max(largestMaleTableCapacity, s.capacity); });
    customMaleTableSettings.forEach(s => { if (s.count > 0) largestMaleTableCapacity = Math.max(largestMaleTableCapacity, s.capacity); });
    
    let largestFemaleTableCapacity = 0;
    femaleTableSettings.forEach(s => { if (s.count > 0) largestFemaleTableCapacity = Math.max(largestFemaleTableCapacity, s.capacity); });
    customFemaleTableSettings.forEach(s => { if (s.count > 0) largestFemaleTableCapacity = Math.max(largestFemaleTableCapacity, s.capacity); });
    
    if (largestMaleTableCapacity > 0 && largestMaleGuestSize > largestMaleTableCapacity) {
      setCapacityWarning(t('seating.ai.guestTooLargeWarningMale', { 
        guestSize: largestMaleGuestSize, 
        tableSize: largestMaleTableCapacity 
      }));
      return;
    }
    
    if (largestFemaleTableCapacity > 0 && largestFemaleGuestSize > largestFemaleTableCapacity) {
      setCapacityWarning(t('seating.ai.guestTooLargeWarningFemale', { 
        guestSize: largestFemaleGuestSize, 
        tableSize: largestFemaleTableCapacity 
      }));
      return;
    }
    
    if (!maleCheck.valid) {
      if (maleCheck.reason === 'invalidSize') {
        setCapacityWarning(t('seating.ai.tableSizeTooSmallWarning'));
      } else {
        setCapacityWarning(t('seating.ai.insufficientMaleCapacityWarning', { missing: maleCheck.missing }));
      }
      return;
    }
    
    if (!femaleCheck.valid) {
      if (femaleCheck.reason === 'invalidSize') {
        setCapacityWarning(t('seating.ai.tableSizeTooSmallWarning'));
      } else {
        setCapacityWarning(t('seating.ai.insufficientFemaleCapacityWarning', { missing: femaleCheck.missing }));
      }
      return;
    }
    
    setCapacityWarning('');
    
  } else {
    const currentCustomSettings = customTableSettings;
    const currentPresetSettings = tableSettings;

    const presetCapacity = currentPresetSettings.reduce((sum, s) => sum + (s.count * s.capacity), 0);
    const customCapacity = currentCustomSettings.reduce((sum, s) => sum + (s.count * s.capacity), 0);
    const existingCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
    const guestsNeeded = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    const totalAvailable = presetCapacity + customCapacity + existingCapacity;
    const totalPlannedTables = currentPresetSettings.reduce((sum, s) => sum + s.count, 0) + 
                               currentCustomSettings.reduce((sum, s) => sum + s.count, 0);

    const presetTablesCount = currentPresetSettings.reduce((sum, s) => sum + s.count, 0);
    const customTablesCount = currentCustomSettings.reduce((sum, s) => sum + s.count, 0);
    const usingCustomTablesOnly = presetTablesCount === 0 && customTablesCount > 0;

    // Check if preset tables were modified from the original suggestion
    const usingModifiedPresetTables = suggestedTableSettings &&
      !usingCustomTablesOnly &&
      presetTablesCount > 0 &&
      JSON.stringify(currentPresetSettings.map(s => s.count)) !== JSON.stringify(suggestedTableSettings.map(s => s.count));

    const largestGuestSize = guests.reduce((max, guest) => Math.max(max, guest.attendingCount || 1), 0);

    let largestPlannedTableCapacity = 0;
    currentPresetSettings.forEach(s => {
      if (s.count > 0 && s.capacity > largestPlannedTableCapacity) {
        largestPlannedTableCapacity = s.capacity;
      }
    });
    currentCustomSettings.forEach(s => {
      if (s.count > 0 && s.capacity > largestPlannedTableCapacity) {
        largestPlannedTableCapacity = s.capacity;
      }
    });

    let requiredCapacity = guestsNeeded;
    if (usingCustomTablesOnly) {
      const bufferPercent = calculateBufferPercent(
        currentCustomSettings,
        aiPreferences.allowGroupMixing,
        aiPreferences.groupMixingRules,
        aiPreferences.groupPolicies
      );
      requiredCapacity = Math.ceil(guestsNeeded * bufferPercent);
    }

    const hasInvalidCustomTableSize = currentCustomSettings.some(s => s.count > 0 && s.capacity < 8);
    
    if (hasInvalidCustomTableSize) {
      setCapacityWarning(t('seating.ai.tableSizeTooSmallWarning'));
    }
    else if (totalPlannedTables === 0 && existingCapacity < guestsNeeded && !usingCustomTablesOnly && !usingModifiedPresetTables) {
      const missingSeats = guestsNeeded - existingCapacity;
      setCapacityWarning(t('seating.ai.insufficientCapacityWarning', { missing: missingSeats }));
    }
    else if (largestPlannedTableCapacity > 0 && largestGuestSize > largestPlannedTableCapacity) {
      setCapacityWarning(t('seating.ai.guestTooLargeWarning', {
        guestSize: largestGuestSize,
        tableSize: largestPlannedTableCapacity
      }));
    }
    else if (totalAvailable < requiredCapacity && !usingCustomTablesOnly && !usingModifiedPresetTables) {
      // Skip capacity warning when using custom tables only or modified preset tables - emergency tables will be created if needed
      const missingSeats = requiredCapacity - totalAvailable;
      setCapacityWarning(t('seating.ai.insufficientCapacityWarning', { missing: missingSeats }));
    } else {
      setCapacityWarning('');
    }
  }
}, [showTableCreation, tableSettings, customTableSettings, maleTableSettings, femaleTableSettings, 
    customMaleTableSettings, customFemaleTableSettings, guests, tables, maleTables, femaleTables,
    isSeparatedSeating, t, aiPreferences.allowGroupMixing, aiPreferences.groupMixingRules, aiPreferences.groupPolicies]);

  const autoSuggestTables = async (guestsNeedingSeats, allowMixing = null, customGroupPolicies = null, gender = null, customGroupMixingRules = null, preserveExisting = false) => {

    if (guestsNeedingSeats === 0) {
      return;
    }

    if (!onFetchTableSuggestion) {
      return;
    }

    const fetchKey = `${guestsNeedingSeats}-${allowMixing}-${gender}-${JSON.stringify(customGroupPolicies)}`;
    
    if (isFetchingRef.current || lastFetchKey.current === fetchKey) {
      return;
    }

    isFetchingRef.current = true;
    lastFetchKey.current = fetchKey;
    setIsFetchingSuggestion(true);

    try {
      const options = {
        allowGroupMixing: allowMixing !== null ? allowMixing : aiPreferences.allowGroupMixing,
        groupMixingRules: customGroupMixingRules !== null ? customGroupMixingRules : (aiPreferences.groupMixingRules || []),
        groupPolicies: customGroupPolicies || aiPreferences.groupPolicies || {},
        preferredTableSize: aiPreferences.preferredTableSize || 12,
        preserveExisting: preserveExisting,
      };

      const result = await onFetchTableSuggestion(options);

      if (!result) {
        setIsFetchingSuggestion(false);
        return;
      }

      if (isSeparatedSeating && gender) {
        const isGenderMale = gender === 'male';
        const settings = isGenderMale ? result.maleTableSettings : result.femaleTableSettings;

        if (settings) {
          const currentSettings = isGenderMale ? maleTableSettings : femaleTableSettings;
          const newSettings = currentSettings.map(s => ({ ...s, count: 0 }));

          Object.entries(settings).forEach(([capacity, count]) => {
            const index = newSettings.findIndex(s => s.capacity === parseInt(capacity));
            if (index !== -1) {
              newSettings[index].count = count;
            } else {
            }
          });
          if (isGenderMale) {
            setMaleTableSettings(newSettings);
            // Store original suggested settings to detect modifications (deep copy)
            setSuggestedMaleTableSettings(newSettings.map(s => ({ ...s })));
          } else {
            setFemaleTableSettings(newSettings);
            // Store original suggested settings to detect modifications (deep copy)
            setSuggestedFemaleTableSettings(newSettings.map(s => ({ ...s })));
          }
        }
      } else if (!isSeparatedSeating && result.tableSettings) {
        const newSettings = tableSettings.map(s => ({ ...s, count: 0 }));

        Object.entries(result.tableSettings).forEach(([capacity, count]) => {
          const index = newSettings.findIndex(s => s.capacity === parseInt(capacity));
          if (index !== -1) {
            newSettings[index].count = count;
          }
        });

        setTableSettings(newSettings);
        // Store original suggested settings to detect modifications (deep copy to prevent reference issues)
        const suggestedCopy = newSettings.map(s => ({ ...s }));
        setSuggestedTableSettings(suggestedCopy);
        console.log('=== SUGGESTION RECEIVED ===');
        console.log('Storing suggested settings:', JSON.stringify(suggestedCopy.map(s => ({ capacity: s.capacity, count: s.count }))));
      }
    } catch (error) {
      console.error('Error fetching table suggestion:', error);
    } finally {
      isFetchingRef.current = false;
      setIsFetchingSuggestion(false);
      setTimeout(() => {
        if (lastFetchKey.current === fetchKey) {
          lastFetchKey.current = '';
        }
      }, 500);
    }
  };

  const getSeatedGuestsCount = (gender = null) => {
    if (isSeparatedSeating && gender) {
      const arrangement = gender === 'male' ? maleArrangement : femaleArrangement;
     
      if (!arrangement || Object.keys(arrangement).length === 0) return 0;
     
      return Object.values(arrangement).flat().reduce((sum, guestId) => {
        const guest = guests.find(g => g._id === guestId);
        if (!guest) return sum;
       
        if (gender === 'male') {
          return sum + (guest.maleCount || 0);
        } else {
          return sum + (guest.femaleCount || 0);
        }
      }, 0);
    } else {
      if (!hasExistingArrangement) return 0;
     
      return Object.values(seatingArrangement).flat().reduce((sum, guestId) => {
        const guest = guests.find(g => g._id === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);
    }
  };

    if (!isOpen) return null;

    const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
    const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
   
    const totalCapacity = tables.reduce((sum, table) => sum + table.capacity, 0);
    const totalMaleCapacity = maleTables.reduce((sum, table) => sum + table.capacity, 0);
    const totalFemaleCapacity = femaleTables.reduce((sum, table) => sum + table.capacity, 0);
   
    const plannedCapacity = tableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0) +
                          customTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0);
    const plannedMaleCapacity = maleTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0) +
                                customMaleTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0);
    const plannedFemaleCapacity = femaleTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0) +
                                  customFemaleTableSettings.reduce((sum, setting) => sum + (setting.count * setting.capacity), 0);
   
    const utilizationRate = totalCapacity > 0 ? (totalGuests / totalCapacity) * 100 : 0;
    const maleUtilizationRate = totalMaleCapacity > 0 ? (totalMaleGuests / totalMaleCapacity) * 100 : 0;
    const femaleUtilizationRate = totalFemaleCapacity > 0 ? (totalFemaleGuests / totalFemaleCapacity) * 100 : 0;

    const groupStats = guests.reduce((acc, guest) => {
      const group = guest.customGroup || guest.group;
      if (!acc[group]) {
        acc[group] = { count: 0, people: 0 };
      }
      acc[group].count++;
      acc[group].people += guest.attendingCount || 1;
      return acc;
    }, {});

    const handleExistingArrangementChoice = async (action) => {
      setExistingArrangementAction(action);
      setShowExistingArrangementWarning(false);
     
      if (action === 'clear') {
        if (isSeparatedSeating) {
          if (totalMaleCapacity < totalMaleGuests) {
            setShowTableCreation(true);
            await autoSuggestTables(totalMaleGuests, null, aiPreferences.groupPolicies, 'male');
          }
          if (totalFemaleCapacity < totalFemaleGuests) {
            setShowTableCreation(true);
            await autoSuggestTables(totalFemaleGuests, null, aiPreferences.groupPolicies, 'female');
          }
        } else {
          if (totalCapacity < totalGuests) {
            setShowTableCreation(true);
            await autoSuggestTables(totalGuests, null, aiPreferences.groupPolicies);
          }
        }
      } else if (action === 'continue') {
        if (isSeparatedSeating) {
          const seatedMaleGuestsCount = getSeatedGuestsCount('male');
          const seatedFemaleGuestsCount = getSeatedGuestsCount('female');
          const unseatedMaleGuestsCount = totalMaleGuests - seatedMaleGuestsCount;
          const unseatedFemaleGuestsCount = totalFemaleGuests - seatedFemaleGuestsCount;
          const availableMaleCapacity = totalMaleCapacity - seatedMaleGuestsCount;
          const availableFemaleCapacity = totalFemaleCapacity - seatedFemaleGuestsCount;
         
          if (availableMaleCapacity < unseatedMaleGuestsCount) {
            setShowTableCreation(true);
            await autoSuggestTables(unseatedMaleGuestsCount, null, aiPreferences.groupPolicies, 'male', null, true);
          }
         
          if (availableFemaleCapacity < unseatedFemaleGuestsCount) {
            setShowTableCreation(true);
            await autoSuggestTables(unseatedFemaleGuestsCount, null, aiPreferences.groupPolicies, 'female', null, true);
          }
        } else {
          const seatedGuestsCount = getSeatedGuestsCount();
          const unseatedGuestsCount = totalGuests - seatedGuestsCount;
          const availableCapacity = totalCapacity - seatedGuestsCount;
         
          if (availableCapacity < unseatedGuestsCount) {
            setShowTableCreation(true);
            await autoSuggestTables(unseatedGuestsCount, null, aiPreferences.groupPolicies, null, null, true);
          }
        }
      }
    };

  const addCustomTableType = (gender = null) => {
    const newCustomTable = {
      id: `custom_${Date.now()}`,
      type: 'round',
      capacity: 12,
      count: 1
    };
   
    if (isSeparatedSeating && gender) {
      if (gender === 'male') {
        setCustomMaleTableSettings(prev => [...prev, newCustomTable]);
      } else {
        setCustomFemaleTableSettings(prev => [...prev, newCustomTable]);
      }
    } else {
      setCustomTableSettings(prev => [...prev, newCustomTable]);
    }
  };

  const updateCustomTableSetting = (id, field, value, gender = null) => {
    if (isSeparatedSeating && gender) {
      if (gender === 'male') {
        setCustomMaleTableSettings(prev =>
          prev.map(setting =>
            setting.id === id
              ? { ...setting, [field]: field === 'count' || field === 'capacity' ? (parseInt(value) || 0) : value }
              : setting
          )
        );
      } else {
        setCustomFemaleTableSettings(prev =>
          prev.map(setting =>
            setting.id === id
              ? { ...setting, [field]: field === 'count' || field === 'capacity' ? (parseInt(value) || 0) : value }
              : setting
          )
        );
      }
    } else {
      setCustomTableSettings(prev =>
        prev.map(setting =>
          setting.id === id
            ? { ...setting, [field]: field === 'count' || field === 'capacity' ? (parseInt(value) || 0) : value }
            : setting
        )
      );
    }
  };

  const removeCustomTableSetting = (id, gender = null) => {
    if (isSeparatedSeating && gender) {
      if (gender === 'male') {
        setCustomMaleTableSettings(prev => prev.filter(setting => setting.id !== id));
      } else {
        setCustomFemaleTableSettings(prev => prev.filter(setting => setting.id !== id));
      }
    } else {
      setCustomTableSettings(prev => prev.filter(setting => setting.id !== id));
    }
  };

  const addGroupMixRule = async () => {
    if (newGroupMixRule.group1 && newGroupMixRule.group2 && newGroupMixRule.group1 !== newGroupMixRule.group2) {
      const newRules = [...aiPreferences.groupMixingRules, {
        id: Date.now().toString(),
        group1: newGroupMixRule.group1,
        group2: newGroupMixRule.group2
      }];
     
      setAiPreferences(prev => ({
        ...prev,
        groupMixingRules: newRules
      }));
      setNewGroupMixRule({ group1: '', group2: '' });
     
      if (showTableCreation) {
        if (isSeparatedSeating) {
          const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
          const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
          await autoSuggestTables(totalMaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'male', newRules);
          await autoSuggestTables(totalFemaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'female', newRules);
        } else {
          const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
          await autoSuggestTables(totalGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, null, newRules);
        }
      }
    }
  };

  const removeGroupMixRule = async (ruleId) => {
    const newRules = aiPreferences.groupMixingRules.filter(rule => rule.id !== ruleId);
   
    setAiPreferences(prev => ({
      ...prev,
      groupMixingRules: newRules
    }));
   
    if (showTableCreation) {
      if (isSeparatedSeating) {
        const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
        const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
        await autoSuggestTables(totalMaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'male', newRules);
        await autoSuggestTables(totalFemaleGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, 'female', newRules);
      } else {
        const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        await autoSuggestTables(totalGuests, aiPreferences.allowGroupMixing, aiPreferences.groupPolicies, null, newRules);
      }
    }
  };

  const addMustSitRule = () => {
    if (!newMustSitRule.guest1Id || !newMustSitRule.guest2Id) {
      return;
    }
   
    if (newMustSitRule.guest1Id === newMustSitRule.guest2Id) {
      return;
    }
   
    const guest1 = guests.find(g => g._id === newMustSitRule.guest1Id);
    const guest2 = guests.find(g => g._id === newMustSitRule.guest2Id);
   
    if (!guest1 || !guest2) {
      return;
    }
   
    const group1 = guest1.customGroup || guest1.group;
    const group2 = guest2.customGroup || guest2.group;
   
    if (group1 !== group2) {
      return;
    }
   
    setSeatingRules(prev => ({
      ...prev,
      mustSitTogether: [...prev.mustSitTogether, {
        id: Date.now().toString(),
        guest1Id: newMustSitRule.guest1Id,
        guest2Id: newMustSitRule.guest2Id
      }]
    }));
   
    setNewMustSitRule({ guest1Id: '', guest2Id: '' });
  };

  const removeMustSitRule = (ruleId) => {
    setSeatingRules(prev => ({
      ...prev,
      mustSitTogether: prev.mustSitTogether.filter(rule => rule.id !== ruleId)
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
        currentArrangement: isSeparatedSeating ? null : seatingArrangement,
        currentMaleArrangement: isSeparatedSeating ? maleArrangement : null,
        currentFemaleArrangement: isSeparatedSeating ? femaleArrangement : null,
        seatingRules,
        groupMixingRules: aiPreferences.groupMixingRules,
        groupPolicies: aiPreferences.groupPolicies,
        isSeparatedSeating
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
    const CANVAS_HEIGHT = 1600;
    const BOUNDARY_PADDING = 150;
    const SPACING_X = 200;
    const SPACING_Y = 180;
    const COLS = isSeparatedSeating ? 4 : 5;
    const MAX_Y = CANVAS_HEIGHT - BOUNDARY_PADDING;
    const START_X = 300;  
    const START_Y = 250;  
    const FEMALE_START_X = 1200;

    if (isSeparatedSeating) {
      const maleTablesList = [];
      const femaleTablesList = [];
      let maleTableCounter = getNextTableNumber ? getNextTableNumber() : maleTables.length + 1;
      let femaleTableCounter = maleTableCounter;
     
      const presetMaleTablesCount = maleTableSettings.reduce((sum, s) => sum + s.count, 0);
      const customMaleTablesCount = customMaleTableSettings.reduce((sum, s) => sum + s.count, 0);
      const totalMaleTables = presetMaleTablesCount + customMaleTablesCount;
      const useMaleCustomTablesOnly = presetMaleTablesCount === 0 && customMaleTablesCount > 0;

      // Check if preset tables were modified from the original suggestion
      const useMaleModifiedPresetTables = suggestedMaleTableSettings &&
        !useMaleCustomTablesOnly &&
        presetMaleTablesCount > 0 &&
        JSON.stringify(maleTableSettings.map(s => s.count)) !== JSON.stringify(suggestedMaleTableSettings.map(s => s.count));

      const presetFemaleTablesCount = femaleTableSettings.reduce((sum, s) => sum + s.count, 0);
      const customFemaleTablesCount = customFemaleTableSettings.reduce((sum, s) => sum + s.count, 0);
      const totalFemaleTables = presetFemaleTablesCount + customFemaleTablesCount;
      const useFemaleCustomTablesOnly = presetFemaleTablesCount === 0 && customFemaleTablesCount > 0;

      // Check if preset tables were modified from the original suggestion
      const useFemaleModifiedPresetTables = suggestedFemaleTableSettings &&
        !useFemaleCustomTablesOnly &&
        presetFemaleTablesCount > 0 &&
        JSON.stringify(femaleTableSettings.map(s => s.count)) !== JSON.stringify(suggestedFemaleTableSettings.map(s => s.count));
     
      const maleCols = COLS;
      const femaleCols = COLS;
     
      let startingMaleTableIndex = 0;
      let startingFemaleTableIndex = 0;
      if (existingArrangementAction === 'continue') {
        startingMaleTableIndex = maleTables.length;
        startingFemaleTableIndex = femaleTables.length;
      }
     
      let currentTable = startingMaleTableIndex;
     
      maleTableSettings.forEach(setting => {
        for (let i = 0; i < setting.count; i++) {
          const row = Math.floor(currentTable / maleCols);
          const col = currentTable % maleCols;
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${maleTableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: START_X + col * SPACING_X,
              y: y
            },
            rotation: 0,
            size: setting.type === 'round'
              ? { width: 120, height: 120 }
              : { width: 160, height: 100 },
            order: currentTable
          };
          maleTablesList.push(table);
          maleTableCounter++;
          femaleTableCounter++;
          currentTable++;
        }
      });
     
      customMaleTableSettings.forEach(setting => {
        for (let i = 0; i < setting.count; i++) {
          const row = Math.floor(currentTable / maleCols);
          const col = currentTable % maleCols;
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${maleTableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: START_X + col * SPACING_X,
              y: y
            },
            rotation: 0,
           size: setting.type === 'round'
              ? { width: 120, height: 120 }
              : { width: 160, height: 100 },
            order: currentTable
          };
          maleTablesList.push(table);
          maleTableCounter++;
          femaleTableCounter++;
          currentTable++;
        }
      });
     
      let currentFemaleTable = startingFemaleTableIndex;
     
      femaleTableSettings.forEach(setting => {
        for (let i = 0; i < setting.count; i++) {
          const row = Math.floor(currentFemaleTable / femaleCols);
          const col = currentFemaleTable % femaleCols;
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentFemaleTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${femaleTableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: FEMALE_START_X + col * SPACING_X,
              y: y
            },
            rotation: 0,
            size: setting.type === 'round'
              ? { width: 120, height: 120 }
              : { width: 160, height: 100 },
            order: currentFemaleTable
          };
          femaleTablesList.push(table);
          femaleTableCounter++;
          currentFemaleTable++;
        }
      });
     
      customFemaleTableSettings.forEach(setting => {
        for (let i = 0; i < setting.count; i++) {
          const row = Math.floor(currentFemaleTable / femaleCols);
          const col = currentFemaleTable % femaleCols;
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentFemaleTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${femaleTableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: FEMALE_START_X + col * SPACING_X,
              y: y
            },
            rotation: 0,
            size: setting.type === 'round'
              ? { width: 120, height: 120 }
              : { width: 160, height: 100 },
            order: currentFemaleTable
          };
          femaleTablesList.push(table);
          femaleTableCounter++;
          currentFemaleTable++;
        }
      });
     
      if (maleTablesList.length > 0 || femaleTablesList.length > 0) {
        try {
          setIsGenerating(true);
          
          if (existingArrangementAction === 'continue') {
            if (maleTables.length > 0) {
              const repositionedMaleTables = maleTables.map((table, index) => {
                const row = Math.floor(index / maleCols);
                const col = index % maleCols;
                const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
                return {
                  ...table,
                  position: {
                    x: START_X + col * SPACING_X,
                    y: y
                  }
                };
              });
              await onAddTables(repositionedMaleTables, 'male');
            }
            if (femaleTables.length > 0) {
              const repositionedFemaleTables = femaleTables.map((table, index) => {
                const row = Math.floor(index / femaleCols);
                const col = index % femaleCols;
                const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
                return {
                  ...table,
                  position: {
                    x: FEMALE_START_X + col * SPACING_X,
                    y: y
                  }
                };
              });
              await onAddTables(repositionedFemaleTables, 'female');
            }
          }

          if (maleTablesList.length > 0) {
            await onAddTables(maleTablesList, 'male');
          }
         
          if (femaleTablesList.length > 0) {
            await onAddTables(femaleTablesList, 'female');
          }
         
          await new Promise(resolve => setTimeout(resolve, 1500));
         
          const allMaleTablesForGeneration = useMaleCustomTablesOnly ? maleTablesList : [...maleTables, ...maleTablesList];
          const allFemaleTablesForGeneration = useFemaleCustomTablesOnly ? femaleTablesList : [...femaleTables, ...femaleTablesList];
         
          const aiPreferencesWithExisting = {
            ...aiPreferences,
            preserveExisting: existingArrangementAction === 'continue',
            clearExisting: existingArrangementAction === 'clear',
            currentMaleArrangement: maleArrangement,
            currentFemaleArrangement: femaleArrangement,
            allMaleTables: allMaleTablesForGeneration,
            allFemaleTables: allFemaleTablesForGeneration,
            seatingRules,
            groupMixingRules: aiPreferences.groupMixingRules,
            groupPolicies: aiPreferences.groupPolicies,
            isSeparatedSeating: true,
            maleTables: maleTablesList,
            femaleTables: femaleTablesList,
            useMaleCustomTablesOnly: useMaleCustomTablesOnly,
            useFemaleCustomTablesOnly: useFemaleCustomTablesOnly,
            useMaleModifiedPresetTables: useMaleModifiedPresetTables,
            useFemaleModifiedPresetTables: useFemaleModifiedPresetTables,
            preferences: {
              ...aiPreferences,
              useMaleCustomTablesOnly: useMaleCustomTablesOnly,
              useFemaleCustomTablesOnly: useFemaleCustomTablesOnly,
              useMaleModifiedPresetTables: useMaleModifiedPresetTables,
              useFemaleModifiedPresetTables: useFemaleModifiedPresetTables
            }
          };
         
          const result = await handleGenerate(aiPreferencesWithExisting);
         
          if (result && result.maleArrangement && result.femaleArrangement) {
            let maleTablesToUpdate = result.maleTables || [];
            let maleArrangementToUse = result.maleArrangement;
            let femaleTablesToUpdate = result.femaleTables || [];
            let femaleArrangementToUse = result.femaleArrangement;
            
            const maleCols = 4;
            const femaleCols = 4;
            
            
            if (useFemaleCustomTablesOnly) {
              const totalFemaleGuestsToSeat = femaleGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
              const seatedFemaleGuestsInArrangement = Object.values(result.femaleArrangement).reduce((sum, tableGuests) => {
                return sum + tableGuests.reduce((guestSum, guestId) => {
                  const guest = femaleGuests.find(g => g._id === guestId);
                  return guestSum + (guest ? (guest.attendingCount || 1) : 0);
                }, 0);
              }, 0);
              const allFemaleGuestsSeated = seatedFemaleGuestsInArrangement >= totalFemaleGuestsToSeat;
              
              if (allFemaleGuestsSeated) {
                femaleTablesToUpdate = (result.femaleTables || []).filter(table => {
                  const tableGuests = result.femaleArrangement[table.id] || [];
                  return tableGuests.length > 0;
                });
                
                femaleArrangementToUse = {};
                femaleTablesToUpdate.forEach(table => {
                  if (result.femaleArrangement[table.id]) {
                    femaleArrangementToUse[table.id] = result.femaleArrangement[table.id];
                  }
                });

                let femaleTableCounter = (useMaleCustomTablesOnly ? maleTablesToUpdate.length : (result.maleTables?.length || 0)) + 1;
                if (getNextTableNumber) {
                  femaleTableCounter = getNextTableNumber() + (useMaleCustomTablesOnly ? maleTablesToUpdate.length : (result.maleTables?.length || 0));
                }
                femaleTablesToUpdate = femaleTablesToUpdate.map((table, index) => {
                  const row = Math.floor(index / femaleCols);
                  const col = index % femaleCols;
                  return {
                    ...table,
                    name: `${t('seating.tableName')} ${femaleTableCounter++}`,
                    position: {
                      x: FEMALE_START_X + col * SPACING_X,
                      y: Math.min(START_Y + row * SPACING_Y, MAX_Y - 100)
                    }
                  };
                });
              }
            }
            
            const updatedMaleTables = maleTablesToUpdate.map(table => {
              const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
              return {
                ...table, 
                name: generateTableNameWithGroup(tableNumber, table.id, maleArrangementToUse, maleGuests)
              };
            });
            
            const updatedFemaleTables = femaleTablesToUpdate.map(table => {
              const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
              return {
                ...table,  
                name: generateTableNameWithGroup(tableNumber, table.id, femaleArrangementToUse, femaleGuests)
              };
            });
            
            if (updatedMaleTables.length > 0) {
              await onAddTables(updatedMaleTables, 'male');
            }
            
            if (updatedFemaleTables.length > 0) {
              await onAddTables(updatedFemaleTables, 'female');
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
          allMaleTables: maleTables,
          allFemaleTables: femaleTables,
          currentMaleArrangement: maleArrangement,
          currentFemaleArrangement: femaleArrangement,
          seatingRules,
          groupMixingRules: aiPreferences.groupMixingRules,
          groupPolicies: aiPreferences.groupPolicies,
          isSeparatedSeating: true
        };
       
        await handleGenerate(aiPreferencesWithExisting);
      }
    } else {
      const tablesToCreate = [];
      let tableCounter = getNextTableNumber ? getNextTableNumber() : tables.length + 1;
     
      const totalTables = tableSettings.reduce((sum, s) => sum + s.count, 0) +
                        customTableSettings.reduce((sum, s) => sum + s.count, 0);
     
      const cols = COLS;
     
      let startingTableIndex = 0;
      if (existingArrangementAction === 'continue' && tables.length > 0) {
        startingTableIndex = tables.length;
      }
     
      let currentTable = startingTableIndex;
     
      tableSettings.forEach(setting => {
        for (let i = 0; i < setting.count; i++) {
          const row = Math.floor(currentTable / cols);
          const col = currentTable % cols;
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${tableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: START_X + col * SPACING_X,
              y: y
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
          const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
         
          const table = {
            id: `table_${Date.now()}_${currentTable}_${Math.random().toString(36).substr(2, 9)}`,
            name: `${t('seating.tableName')} ${tableCounter}`,
            type: setting.type,
            capacity: setting.capacity,
            position: {
              x: START_X + col * SPACING_X,
              y: y
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
     
      if (tablesToCreate.length > 0) {

        try {
          setIsGenerating(true);
          
          if (existingArrangementAction === 'continue' && tables.length > 0) {
            const repositionedExistingTables = tables.map((table, index) => {
              const row = Math.floor(index / cols);
              const col = index % cols;
              const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
              return {
                ...table,
                position: {
                  x: START_X + col * SPACING_X,
                  y: y
                }
              };
            });
            await onAddTables(repositionedExistingTables);
          }

          await onAddTables(tablesToCreate);
         
          await new Promise(resolve => setTimeout(resolve, 1500));
         
          const presetTablesCount = tableSettings.reduce((sum, s) => sum + s.count, 0);
          const customTablesCount = customTableSettings.reduce((sum, s) => sum + s.count, 0);
          const useCustomTablesOnly = presetTablesCount === 0 && customTablesCount > 0;

          // Check if preset tables were modified from the original suggestion
          const useModifiedPresetTables = suggestedTableSettings &&
            !useCustomTablesOnly &&
            presetTablesCount > 0 &&
            JSON.stringify(tableSettings.map(s => s.count)) !== JSON.stringify(suggestedTableSettings.map(s => s.count));

          console.log('=== HANDLE CREATE TABLES (non-separated) ===');
          console.log('Current tableSettings:', JSON.stringify(tableSettings.map(s => ({ capacity: s.capacity, count: s.count }))));
          console.log('Suggested tableSettings:', suggestedTableSettings ? JSON.stringify(suggestedTableSettings.map(s => ({ capacity: s.capacity, count: s.count }))) : 'null');
          console.log('presetTablesCount:', presetTablesCount);
          console.log('customTablesCount:', customTablesCount);
          console.log('useCustomTablesOnly:', useCustomTablesOnly);
          console.log('useModifiedPresetTables:', useModifiedPresetTables);
          console.log('tablesToCreate count:', tablesToCreate.length);

          const allTablesForGeneration = useCustomTablesOnly ? tablesToCreate : [...tables, ...tablesToCreate];

          const aiPreferencesWithExisting = {
            ...aiPreferences,
            preserveExisting: existingArrangementAction === 'continue',
            clearExisting: existingArrangementAction === 'clear',
            currentArrangement: seatingArrangement,
            allTables: allTablesForGeneration,
            seatingRules,
            groupMixingRules: aiPreferences.groupMixingRules,
            groupPolicies: aiPreferences.groupPolicies,
            isSeparatedSeating: false,
            useCustomTablesOnly: useCustomTablesOnly,
            useModifiedPresetTables: useModifiedPresetTables,
            preferences: {
              ...aiPreferences,
              useCustomTablesOnly: useCustomTablesOnly,
              useModifiedPresetTables: useModifiedPresetTables
            }
          };

          const result = await handleGenerate(aiPreferencesWithExisting);

          if (result && result.arrangement) {
            const backendTables = result.tables || [];
            
            let tablesToUpdate = backendTables;
            let arrangementToUse = result.arrangement;
            
            const allTablesToUpdate = tablesToUpdate.map(backendTable => {
              const tableNumber = parseInt(backendTable.name.match(/\d+/)?.[0] || '1');
              return {
                ...backendTable,
                name: generateTableNameWithGroup(tableNumber, backendTable.id, arrangementToUse, guests),
                size: backendTable.capacity === 24
                  ? { width: 160, height: 100 }
                  : backendTable.capacity === 12
                  ? { width: 120, height: 120 }
                  : { width: 120, height: 120 }
              };
            });
           
            if (allTablesToUpdate.length > 0) {
              await onAddTables(allTablesToUpdate);
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
          groupPolicies: aiPreferences.groupPolicies,
          isSeparatedSeating: false
        };
       
        await handleGenerate(aiPreferencesWithExisting);
      }
    }
  };

  const handlePreferenceChange = (key, value) => {
    setAiPreferences(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleAllowGroupMixingChange = async (value) => {
    const updatedPreferences = {
      ...aiPreferences,
      allowGroupMixing: value
    };
   
    setAiPreferences(updatedPreferences);
   
    if (isSeparatedSeating) {
      const totalMaleGuests = guests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
      const totalFemaleGuests = guests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
     
      let maleGuestsNeedingCalculation = 0;
      let femaleGuestsNeedingCalculation = 0;
     
      if (existingArrangementAction === 'continue') {
        const seatedMaleGuestsCount = getSeatedGuestsCount('male');
        const seatedFemaleGuestsCount = getSeatedGuestsCount('female');
        maleGuestsNeedingCalculation = totalMaleGuests - seatedMaleGuestsCount;
        femaleGuestsNeedingCalculation = totalFemaleGuests - seatedFemaleGuestsCount;
      } else {
        maleGuestsNeedingCalculation = totalMaleGuests;
        femaleGuestsNeedingCalculation = totalFemaleGuests;
      }
     
      await autoSuggestTables(maleGuestsNeedingCalculation, value, updatedPreferences.groupPolicies, 'male');
      await autoSuggestTables(femaleGuestsNeedingCalculation, value, updatedPreferences.groupPolicies, 'female');
    } else {
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      let guestsNeedingCalculation = 0;
     
      if (existingArrangementAction === 'continue') {
        const seatedGuestsCount = getSeatedGuestsCount();
        guestsNeedingCalculation = totalGuests - seatedGuestsCount;
      } else {
        guestsNeedingCalculation = totalGuests;
      }
     
      await autoSuggestTables(guestsNeedingCalculation, value, updatedPreferences.groupPolicies);
    }
  };

  const handleTableSettingChange = (index, field, value, gender = null) => {
    if (isSeparatedSeating && gender) {
      if (gender === 'male') {
        const newSettings = [...maleTableSettings];
        newSettings[index][field] = parseInt(value) || 0;
        setMaleTableSettings(newSettings);
      } else {
        const newSettings = [...femaleTableSettings];
        newSettings[index][field] = parseInt(value) || 0;
        setFemaleTableSettings(newSettings);
      }
    } else {
      const newSettings = [...tableSettings];
      newSettings[index][field] = parseInt(value) || 0;
      setTableSettings(newSettings);
    }
  };

  const seatedGuestsCount = getSeatedGuestsCount();
  const unseatedGuestsCount = totalGuests - seatedGuestsCount;
 
  const seatedMaleGuestsCount = getSeatedGuestsCount('male');
  const seatedFemaleGuestsCount = getSeatedGuestsCount('female');
  const unseatedMaleGuestsCount = Math.max(0, totalMaleGuests - seatedMaleGuestsCount);
  const unseatedFemaleGuestsCount = Math.max(0, totalFemaleGuests - seatedFemaleGuestsCount);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content ai-seating-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{t('seating.ai.title')}</h3>
          <button className="modal-close" onClick={onClose}></button>
        </div>

        <div className="modal-body">
          {showExistingArrangementWarning && (
            <div className="existing-arrangement-warning">
              <div className="warning-icon"></div>
              <h4>{t('seating.ai.existingArrangementFound')}</h4>
              <div className="existing-arrangement-info">
                {isSeparatedSeating ? (
                  <p>
                    {t('seating.ai.existingArrangementDescriptionSeparated', {
                      maleTablesCount: Object.keys(maleArrangement).length,
                      femaleTablesCount: Object.keys(femaleArrangement).length,
                      seatedMaleGuests: seatedMaleGuestsCount,
                      seatedFemaleGuests: seatedFemaleGuestsCount,
                      totalMaleGuests: totalMaleGuests,
                      totalFemaleGuests: totalFemaleGuests
                    })}
                  </p>
                ) : (
                  <p>
                    {t('seating.ai.existingArrangementDescription', {
                      tablesCount: Object.keys(seatingArrangement).length,
                      seatedGuests: seatedGuestsCount,
                      totalGuests: totalGuests
                    })}
                  </p>
                )}
               
                <div className="arrangement-stats">
                  {isSeparatedSeating ? (
                    <>
                     <div className="stat-item">
                        <span className="stat-value">{seatedMaleGuestsCount}</span>
                        <span className="stat-label">{t('seating.ai.seatedMaleGuests')}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{Math.max(0, unseatedMaleGuestsCount)}</span>
                        <span className="stat-label">{t('seating.ai.unseatedMaleGuests')}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{seatedFemaleGuestsCount}</span>
                        <span className="stat-label">{t('seating.ai.seatedFemaleGuests')}</span>
                      </div>
                      <div className="stat-item">
                        <span className="stat-value">{Math.max(0, unseatedFemaleGuestsCount)}</span>
                        <span className="stat-label">{t('seating.ai.unseatedFemaleGuests')}</span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
                </div>
              </div>
             
              <div className="arrangement-choice">
                <h5>{t('seating.ai.howToContinue')}</h5>
                <div className="choice-buttons">
                  <button
                    className="choice-button continue-button"
                    onClick={() => handleExistingArrangementChoice('continue')}
                  >
                    <div className="choice-icon"></div>
                    <div className="choice-content">
                      <div className="choice-title">{t('seating.ai.continueFromExisting')}</div>
                      <div className="choice-description">
                        {t('seating.ai.continueDescription')}
                      </div>
                    </div>
                  </button>
                 
                  <button
                    className="choice-button clear-button"
                    onClick={() => handleExistingArrangementChoice('clear')}
                  >
                    <div className="choice-icon"></div>
                    <div className="choice-content">
                      <div className="choice-title">{t('seating.ai.startOver')}</div>
                      <div className="choice-description">
                        {t('seating.ai.clearDescription')}
                      </div>
                    </div>
                  </button>
                </div>
               
              </div>
            </div>
          )}
          {showTableCreation && !showExistingArrangementWarning && (
            <div className="table-creation-section">
              <h4>{t('seating.ai.createAdditionalTables')}</h4>
             
              {isSeparatedSeating && (
                <div className="gender-tabs">
                  <button
                    className={`gender-tab ${genderView === 'male' ? 'active' : ''}`}
                    onClick={() => setGenderView('male')}
                  >
                    {t('seating.ai.maleTables')}
                  </button>
                  <button
                    className={`gender-tab ${genderView === 'female' ? 'active' : ''}`}
                    onClick={() => setGenderView('female')}
                  >
                    {t('seating.ai.femaleTables')}
                  </button>
                </div>
              )}

              <div className="table-settings">
                <h5>{t('seating.ai.predefinedTables')}:</h5>
                {(isSeparatedSeating
                  ? (genderView === 'male' ? maleTableSettings : femaleTableSettings)
                  : tableSettings
                ).map((setting, index) => (
                  <div key={index} className="table-setting-row">
                    <div className="table-info">
                      <span className="table-type">
                        {t(`seating.ai.${setting.type}Table`)}
                      </span>
                      <span className="table-capacity">
                        ({setting.capacity} {t('seating.ai.seats')})
                      </span>
                    </div>
                    <div className="table-count-control">
                      <button
                        type="button"
                        onClick={() => handleTableSettingChange(
                          index,
                          'count',
                          Math.max(0, setting.count - 1),
                          isSeparatedSeating ? genderView : null
                        )}
                        className="count-btn"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={setting.count}
                        onChange={(e) => handleTableSettingChange(
                          index,
                          'count',
                          e.target.value,
                          isSeparatedSeating ? genderView : null
                        )}
                        className="count-input"
                      />
                      <button
                        type="button"
                        onClick={() => handleTableSettingChange(
                          index,
                          'count',
                          setting.count + 1,
                          isSeparatedSeating ? genderView : null
                        )}
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
                      onClick={() => addCustomTableType(isSeparatedSeating ? genderView : null)}
                      className="add-custom-table-btn"
                    >
                      {t('seating.ai.addCustomTableButton')}
                    </button>
                  </div>
                 
                  {(isSeparatedSeating
                    ? (genderView === 'male' ? customMaleTableSettings : customFemaleTableSettings)
                    : customTableSettings
                  ).length > 0 && (
                    <div className="custom-tables-list">
                      {(isSeparatedSeating
                        ? (genderView === 'male' ? customMaleTableSettings : customFemaleTableSettings)
                        : customTableSettings
                      ).map((setting) => (
                        <div key={setting.id} className="custom-table-setting-row">
                          <div className="custom-table-config">
                            <select
                              value={setting.type}
                              onChange={(e) => updateCustomTableSetting(
                                setting.id,
                                'type',
                                e.target.value,
                                isSeparatedSeating ? genderView : null
                              )}
                              className="custom-type-select"
                            >
                              <option value="round">{t('seating.ai.round')}</option>
                              <option value="rectangular">{t('seating.ai.rectangular')}</option>
                              <option value="square">{t('seating.ai.square')}</option>
                            </select>
                           
                            <input
                              type="number"
                              min="8"
                              max="30"
                              value={setting.capacity}
                              onChange={(e) => updateCustomTableSetting(
                                setting.id,
                                'capacity',
                                e.target.value,
                                isSeparatedSeating ? genderView : null
                              )}
                              className="custom-capacity-input"
                              placeholder={t('seating.ai.seatsPlaceholder')}
                            />
                           
                            <span className="capacity-label">{t('seating.ai.seats')}</span>
                          </div>
                         
                          <div className="table-count-control">
                            <button
                              type="button"
                              onClick={() => updateCustomTableSetting(
                                setting.id,
                                'count',
                                Math.max(0, setting.count - 1),
                                isSeparatedSeating ? genderView : null
                              )}
                              className="count-btn"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min="0"
                              max="20"
                              value={setting.count}
                              onChange={(e) => updateCustomTableSetting(
                                setting.id,
                                'count',
                                e.target.value,
                                isSeparatedSeating ? genderView : null
                              )}
                              className="count-input"
                            />
                            <button
                              type="button"
                              onClick={() => updateCustomTableSetting(
                                setting.id,
                                'count',
                                setting.count + 1,
                                isSeparatedSeating ? genderView : null
                              )}
                              className="count-btn"
                            >
                              +
                            </button>
                          </div>
                         
                          <button
                            type="button"
                            onClick={() => removeCustomTableSetting(setting.id, isSeparatedSeating ? genderView : null)}
                            className="remove-custom-table-btn"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                 
                  {(isSeparatedSeating
                    ? (genderView === 'male' ? customMaleTableSettings : customFemaleTableSettings)
                    : customTableSettings
                  ).length === 0 && (
                    <div className="no-custom-tables-message">
                      {t('seating.ai.noCustomTablesMessage')}
                    </div>
                  )}

                  {capacityWarning && (
                    <div className="capacity-warning-message">
                      ⚠️ {capacityWarning}
                    </div>
                  )}
                  
                  {!capacityWarning && (() => {
                    if (isSeparatedSeating) {
                      const malePresetCount = maleTableSettings.reduce((sum, s) => sum + s.count, 0);
                      const maleCustomCount = customMaleTableSettings.reduce((sum, s) => sum + s.count, 0);
                      const femalePresetCount = femaleTableSettings.reduce((sum, s) => sum + s.count, 0);
                      const femaleCustomCount = customFemaleTableSettings.reduce((sum, s) => sum + s.count, 0);
                      const usingMaleCustomOnly = malePresetCount === 0 && maleCustomCount > 0;
                      const usingFemaleCustomOnly = femalePresetCount === 0 && femaleCustomCount > 0;
                      
                      if (usingMaleCustomOnly || usingFemaleCustomOnly) {
                        return (
                          <div className="custom-tables-info-message">
                            ℹ️ {t('seating.ai.customTablesOptimizationNote')}
                          </div>
                        );
                      }
                    } else {
                      const presetCount = tableSettings.reduce((sum, s) => sum + s.count, 0);
                      const customCount = customTableSettings.reduce((sum, s) => sum + s.count, 0);
                      const usingCustomOnly = presetCount === 0 && customCount > 0;
                      
                      if (usingCustomOnly) {
                        return (
                          <div className="custom-tables-info-message">
                            ℹ️ {t('seating.ai.customTablesOptimizationNote')}
                          </div>
                        );
                      }
                    }
                    return null;
                  })()}
                </div>
              </div>

              <div className="capacity-summary">
                <div className="capacity-info">
                  {isSeparatedSeating ? (
                    genderView === 'male' ? (
                      <>
                        <span>{t('seating.ai.existingMaleTables')}: <strong>{maleTables.length}</strong> ({totalMaleCapacity} {t('seating.ai.seats')})</span>
                        <span>{t('seating.ai.plannedNewMaleTables')}: <strong>{maleTableSettings.reduce((sum, s) => sum + s.count, 0) + customMaleTableSettings.reduce((sum, s) => sum + s.count, 0)}</strong> ({plannedMaleCapacity} {t('seating.ai.seats')})</span>
                        <span>{t('seating.ai.totalMaleCapacity')}: <strong>{totalMaleCapacity + plannedMaleCapacity}</strong> {t('seating.ai.seats')}</span>
                      </>
                    ) : (
                      <>
                        <span>{t('seating.ai.existingFemaleTables')}: <strong>{femaleTables.length}</strong> ({totalFemaleCapacity} {t('seating.ai.seats')})</span>
                        <span>{t('seating.ai.plannedNewFemaleTables')}: <strong>{femaleTableSettings.reduce((sum, s) => sum + s.count, 0) + customFemaleTableSettings.reduce((sum, s) => sum + s.count, 0)}</strong> ({plannedFemaleCapacity} {t('seating.ai.seats')})</span>
                        <span>{t('seating.ai.totalFemaleCapacity')}: <strong>{totalFemaleCapacity + plannedFemaleCapacity}</strong> {t('seating.ai.seats')}</span>
                      </>
                    )
                  ) : (
                    <>
                      <span>{t('seating.ai.existingTables')}: <strong>{tables.length}</strong> ({totalCapacity} {t('seating.ai.seats')})</span>
                      <span>{t('seating.ai.plannedNewTables')}: <strong>{tableSettings.reduce((sum, s) => sum + s.count, 0) + customTableSettings.reduce((sum, s) => sum + s.count, 0)}</strong></span>
                      <span>{t('seating.ai.totalCapacity')}: <strong>{totalCapacity + plannedCapacity}</strong> {t('seating.ai.seats')}</span>
                    </>
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
                      {isSeparatedSeating ? (
                        <>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.totalMaleGuests')}</span>
                            <span className="stat-value">{totalMaleGuests}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.totalFemaleGuests')}</span>
                            <span className="stat-value">{totalFemaleGuests}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.totalMaleTables')}</span>
                            <span className="stat-value">{maleTables.length}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.totalFemaleTables')}</span>
                            <span className="stat-value">{femaleTables.length}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.maleCapacity')}</span>
                            <span className="stat-value">{totalMaleCapacity}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.femaleCapacity')}</span>
                            <span className="stat-value">{totalFemaleCapacity}</span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.maleUtilization')}</span>
                            <span className={`stat-value ${maleUtilizationRate > 100 ? 'overcapacity' : maleUtilizationRate > 90 ? 'warning' : 'good'}`}>
                              {maleUtilizationRate.toFixed(1)}%
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">{t('seating.ai.femaleUtilization')}</span>
                            <span className={`stat-value ${femaleUtilizationRate > 100 ? 'overcapacity' : femaleUtilizationRate > 90 ? 'warning' : 'good'}`}>
                              {femaleUtilizationRate.toFixed(1)}%
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </div>

                    {!isSeparatedSeating && utilizationRate > 100 && (
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
                   
                    {isSeparatedSeating && (maleUtilizationRate > 100 || femaleUtilizationRate > 100) && (
                      <div className="capacity-warning">
                        {t('seating.ai.capacityWarningSeparated')}
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
                  <h4>{t('seating.ai.seatingRulesTitle')}</h4>
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
                          value={newMustSitRule.guest2Id}
                          onChange={(e) => setNewMustSitRule(prev => ({ ...prev, guest2Id: e.target.value, guest1Id: '' }))}
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
                          value={newMustSitRule.guest1Id}
                          onChange={(e) => setNewMustSitRule(prev => ({ ...prev, guest1Id: e.target.value }))}
                          className="guest-select"
                          disabled={!newMustSitRule.guest2Id}
                        >
                          <option value="">{t('seating.ai.selectSecondGuest')}</option>
                          {(() => {
                            if (!newMustSitRule.guest2Id) return null;
                            const selectedGuest = guests.find(g => g._id === newMustSitRule.guest2Id);
                            if (!selectedGuest) return null;
                            const selectedGroup = selectedGuest.customGroup || selectedGuest.group;
                            
                            return guests.filter(guest => {
                              if (guest._id === newMustSitRule.guest2Id) return false;
                              const guestGroup = guest.customGroup || guest.group;
                              return guestGroup === selectedGroup;
                            }).map(guest => (
                              <option key={guest._id} value={guest._id}>
                                {guest.firstName} {guest.lastName}
                              </option>
                            ));
                          })()}
                        </select>

                        <button
                          type="button"
                          onClick={addMustSitRule}
                          disabled={!canAddMustSitRule.canAdd}
                          className="add-rule-btn"
                          title={canAddMustSitRule.reason}
                        >
                          {t('seating.ai.addRule')}
                        </button>
                        
                        {!canAddMustSitRule.canAdd && canAddMustSitRule.reason && (
                          <div className="validation-message error">
                            {canAddMustSitRule.reason}
                          </div>
                        )}
                      </div>

                      {seatingRules.mustSitTogether.length > 0 && (
                        <div className="added-rules-summary">
                          {seatingRules.mustSitTogether.map(rule => {
                            const guest1 = guests.find(g => g._id === rule.guest1Id);
                            const guest2 = guests.find(g => g._id === rule.guest2Id);
                            if (!guest1 || !guest2) return null;
                           
                            const guest1Name = `${guest1.firstName} ${guest1.lastName}`;
                            const guest2Name = `${guest2.firstName} ${guest2.lastName}`;
                           
                            return (
                              <div key={rule.id} className="validation-message success">
                                {t('seating.ai.mustSitTogetherRule', { guest1: guest1Name, guest2: guest2Name })}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="ai-preferences">
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
                        <div className="add-rule-form">
                        <select
                          value={newGroupMixRule.group1}
                          onChange={(e) => setNewGroupMixRule(prev => ({ ...prev, group1: e.target.value }))}
                          className="group-select guest-select"
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
                          className="group-select guest-select"
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
                              const currentPolicy = aiPreferences.groupPolicies[group] || '';
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
                                    <option value="">{t('seating.ai.policySelect')}</option>
                                    <option value="M">{t('seating.ai.policyMixable')}</option>
                                    <option value="S">{t('seating.ai.policySeparate')}</option>
                                  </select>
                                  <div className="policy-description">
                                    {currentPolicy === 'S'
                                      ? t('seating.ai.policySeparateDesc')
                                      : currentPolicy === 'M'
                                      ? t('seating.ai.policyMixableDesc')
                                      : ''}
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
          <div className="footer-actions">
            <button className="cancel-button" onClick={onClose} disabled={isGenerating || !canEdit}>
              {t('common.cancel')}
            </button>
            {showExistingArrangementWarning ? null : showTableCreation ? (
              <button
                className="create-tables-btn"
                onClick={handleCreateTables}
                disabled={isGenerating || !canEdit || !!capacityWarning}
              >
                {isGenerating ? (
                  t('seating.ai.creatingTablesAndArranging')
                ) : (
                  isSeparatedSeating ? (
                    t('seating.ai.createTablesAndArrangeSeparated')
                  ) : (
                    t('seating.ai.createTablesAndArrange')
                  )
                )}
              </button>
            ) : (
              <button
                className="generate-button"
                onClick={async () => {
                  await handleGenerate();
                }}
                disabled={
                  !canEdit ||
                  isGenerating ||
                  (isSeparatedSeating
                    ? (maleTables.length === 0 && femaleTables.length === 0)
                    : tables.length === 0) ||
                  guests.length === 0
                }
              >
                {isGenerating ? (
                  t('seating.ai.generating')
                ) : (
                  <>
                    {existingArrangementAction === 'continue'
                      ? t('seating.ai.continueArrangement')
                      : t('seating.ai.createArrangement')}
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