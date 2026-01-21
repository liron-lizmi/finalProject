const Seating = require('../models/Seating');
const Event = require('../models/Event');
const Guest = require('../models/Guest');


const normalizeGroupPolicies = (preferences) => {
  if (!preferences) return {};

  let normalized;
  if (preferences.toObject) {
    normalized = preferences.toObject();
  } else if (preferences._doc) {
    normalized = { ...preferences._doc };
  } else {
    normalized = JSON.parse(JSON.stringify(preferences));
  }

  if (normalized.groupPolicies instanceof Map) {
    const plainObject = {};
    normalized.groupPolicies.forEach((value, key) => {
      plainObject[key] = value;
    });
    normalized.groupPolicies = plainObject;
  }

  return normalized;
};

const getSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    let hasAccess = isOwner;
    let canEdit = isOwner;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
     
      hasAccess = true;
      canEdit = shareInfo.permission === 'edit';
    }

    if (!hasAccess) {
      return res.status(403).json({ message: req.t('events.accessDenied') });
    }

    let seating = await Seating.findOne({ event: eventId });
    if (seating) {
      if (seating.tables) {
        seating.tables.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
      if (seating.maleTables) {
        seating.maleTables.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
      if (seating.femaleTables) {
        seating.femaleTables.sort((a, b) => (a.order || 0) - (b.order || 0));
      }
    }
   
    if (!seating) {
      return res.json({
        tables: [],
        arrangement: {},
        maleTables: [],
        femaleTables: [],
        maleArrangement: {},
        femaleArrangement: {},
        isSeparatedSeating: event.isSeparatedSeating || false,
        preferences: {
          seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
          groupMixingRules: [],
          allowGroupMixing: false,
          preferredTableSize: 12,
          groupPolicies: {}
        },
        layoutSettings: {
          canvasScale: 1,
          canvasOffset: { x: 0, y: 0 }
        },
        syncSettings: {
          autoSyncEnabled: true,
          syncOnRsvpChange: true,
          syncOnAttendingCountChange: true,
          autoCreateTables: true,
          autoOptimizeTables: true,
          preferredTableSize: 12
        },
        generatedBy: 'manual',
        version: 1,
        updatedAt: new Date(),
        syncSummary: {
          autoSyncEnabled: true,
          pendingTriggers: 0,
          lastSyncTrigger: null,
          lastSyncProcessed: null,
          syncStats: {
            totalSyncs: 0,
            successfulSyncs: 0,
            failedSyncs: 0,
            lastSyncStatus: 'success'
          },
          recentTriggers: []
        }
      });
    }
   
    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });
   
    if (event.isSeparatedSeating && !seating.isSeparatedSeating) {
      seating.isSeparatedSeating = true;
      await seating.save();
    }
   
    const needsMigration = seating.isSeparatedSeating &&
        (!seating.maleTables || seating.maleTables.length === 0) &&
        (!seating.femaleTables || seating.femaleTables.length === 0) &&
        seating.tables && seating.tables.length > 0 &&
        seating.arrangement && Object.keys(seating.arrangement).length > 0;
   
    if (needsMigration) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);

      seating.maleTables = [];
      seating.femaleTables = [];
      seating.maleArrangement = {};
      seating.femaleArrangement = {};

      const existingArrangement = seating.arrangement || {};
     
      seating.tables.forEach((table, index) => {
        const tableObj = table.toObject ? table.toObject() : { ...table };
       
        const maleTable = {
          ...tableObj,
          id: `male_${table.id}`,
          name: `${table.name} - ${req.t('guests.male')}`
        };
        seating.maleTables.push(maleTable);

        const femaleTable = {
          ...tableObj,
          id: `female_${table.id}`,
          name: `${table.name} - ${req.t('guests.female')}`
        };
        seating.femaleTables.push(femaleTable);

        const guestsAtTable = existingArrangement[table.id] || [];
       
        guestsAtTable.forEach(guestId => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) return;

          if (guest.maleCount && guest.maleCount > 0) {
            if (!seating.maleArrangement[maleTable.id]) {
              seating.maleArrangement[maleTable.id] = [];
            }
            seating.maleArrangement[maleTable.id].push(guestId);
          }

          if (guest.femaleCount && guest.femaleCount > 0) {
            if (!seating.femaleArrangement[femaleTable.id]) {
              seating.femaleArrangement[femaleTable.id] = [];
            }
            seating.femaleArrangement[femaleTable.id].push(guestId);
          }
        });
      });

      seating.tables = [];
      seating.arrangement = {};

      seating = await Seating.findByIdAndUpdate(
        seating._id,
        {
          maleTables: seating.maleTables,
          femaleTables: seating.femaleTables,
          maleArrangement: seating.maleArrangement,
          femaleArrangement: seating.femaleArrangement,
          tables: seating.tables,
          arrangement: seating.arrangement,
          isSeparatedSeating: true,
          updatedAt: new Date()
        },
        { new: true }
      );
    }

    let cleanupResult = { hasChanges: false, cleanupSummary: null };

    const syncSummary = {
      autoSyncEnabled: seating.syncSettings?.autoSyncEnabled !== false,
      pendingTriggers: seating.syncTriggers?.filter(t => !t.processed).length || 0,
      lastSyncTrigger: seating.syncTriggers?.length > 0 ?
        seating.syncTriggers[seating.syncTriggers.length - 1].timestamp : null,
      lastSyncProcessed: seating.lastSyncProcessed || null,
      syncStats: seating.syncStats || {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncStatus: 'success'
      },
      recentTriggers: seating.syncTriggers?.slice(-5) || []
    };

    const responseData = {
      isSeparatedSeating: event.isSeparatedSeating || false,
      preferences: normalizeGroupPolicies(seating.preferences) || {
        seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
        groupMixingRules: [],
        allowGroupMixing: false,
        preferredTableSize: 12,
        groupPolicies: {}
      },
      layoutSettings: seating.layoutSettings || {
        canvasScale: 1,
        canvasOffset: { x: 0, y: 0 }
      },
      syncSettings: seating.syncSettings || {
        autoSyncEnabled: true,
        syncOnRsvpChange: true,
        syncOnAttendingCountChange: true,
        autoCreateTables: true,
        autoOptimizeTables: true,
        preferredTableSize: 12
      },
      generatedBy: seating.generatedBy || 'manual',
      version: seating.version || 1,
      updatedAt: seating.updatedAt || new Date(),
      syncSummary,
      cleanupSummary: cleanupResult.hasChanges ? cleanupResult.cleanupSummary : null
    };

    if (event.isSeparatedSeating) {
      responseData.maleTables = seating.maleTables || [];
      responseData.femaleTables = seating.femaleTables || [];
      responseData.maleArrangement = seating.maleArrangement || {};
      responseData.femaleArrangement = seating.femaleArrangement || {};
      responseData.tables = seating.tables || [];
      responseData.arrangement = seating.arrangement || {};
    } else {
      responseData.tables = seating.tables || [];
      responseData.arrangement = seating.arrangement || {};
      responseData.maleTables = [];
      responseData.femaleTables = [];
      responseData.maleArrangement = {};
      responseData.femaleArrangement = {};
    }

    responseData.canEdit = canEdit;

    res.json(responseData);
  } catch (err) {
    res.status(500).json({
      message: req.t('seating.errors.fetchFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const saveSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      tables,
      arrangement,
      maleTables,
      femaleTables,
      maleArrangement,
      femaleArrangement,
      isSeparatedSeating,
      preferences,
      layoutSettings,
      syncSettings
    } = req.body;
       
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    let canEdit = isOwner;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
     
      if (shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
     
      canEdit = true;
    }

    if (!canEdit) {
      return res.status(403).json({ message: req.t('events.accessDenied') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const errors = [];
    let updateData = {
     preferences: {
        seatingRules: preferences?.seatingRules || {
          mustSitTogether: [],
          cannotSitTogether: []
        },
        groupMixingRules: preferences?.groupMixingRules || [],
        allowGroupMixing: preferences?.allowGroupMixing !== undefined
          ? preferences.allowGroupMixing
          : false,
        preferredTableSize: preferences?.preferredTableSize || 12,
        groupPolicies: preferences?.groupPolicies || {}
      },
      layoutSettings: layoutSettings || {
        canvasScale: 1,
        canvasOffset: { x: 0, y: 0 }
      },
      syncSettings: syncSettings || {
        autoSyncEnabled: true,
        syncOnRsvpChange: true,
        syncOnAttendingCountChange: true,
        autoCreateTables: true,
        autoOptimizeTables: true,
        preferredTableSize: 12
      },
      isSeparatedSeating: isSeparatedSeating || false,
      generatedBy: 'manual',
      updatedAt: new Date()
    };

    if (isSeparatedSeating) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
     
      const cleanedMaleTables = [];
      const cleanedMaleArrangement = {};
      const maleArrangementObj = maleArrangement && typeof maleArrangement === 'object' ? maleArrangement : {};
     
      if (maleTables) {
        maleTables.forEach((table, index) => {
          const hasGuests = maleArrangementObj[table.id] &&
                          Array.isArray(maleArrangementObj[table.id]) &&
                          maleArrangementObj[table.id].length > 0;
          const isManualTable = !table.autoCreated && !table.createdForSync;
       
          if (hasGuests || isManualTable) {
            const tableWithOrder = {
              ...table,
              order: table.order !== undefined ? table.order : index
            };
            cleanedMaleTables.push(tableWithOrder);
            if (hasGuests) {
              cleanedMaleArrangement[table.id] = maleArrangementObj[table.id];
            }
          }
        });
      }
           
      const cleanedFemaleTables = [];
      const cleanedFemaleArrangement = {};
      const femaleArrangementObj = femaleArrangement && typeof femaleArrangement === 'object' ? femaleArrangement : {};
     
      if (femaleTables) {
        femaleTables.forEach((table, index) => {
          const hasGuests = femaleArrangementObj[table.id] &&
                          Array.isArray(femaleArrangementObj[table.id]) &&
                          femaleArrangementObj[table.id].length > 0;
          const isManualTable = !table.autoCreated && !table.createdForSync;
       
          if (hasGuests || isManualTable) {
            const tableWithOrder = {
              ...table,
              order: table.order !== undefined ? table.order : index
            };
            cleanedFemaleTables.push(tableWithOrder);
            if (hasGuests) {
              cleanedFemaleArrangement[table.id] = femaleArrangementObj[table.id];
            }
          }
        });
      }
     
      const cleanedNeutralTables = [];
      const cleanedNeutralArrangement = {};
      const arrangementObj = arrangement && typeof arrangement === 'object' ? arrangement : {};
     
      if (tables) {
        tables.forEach((table, index) => {
          const hasGuests = arrangementObj[table.id] &&
                          Array.isArray(arrangementObj[table.id]) &&
                          arrangementObj[table.id].length > 0;
          const isManualTable = !table.autoCreated && !table.createdForSync;
       
          if (hasGuests || isManualTable) {
            const tableWithOrder = {
              ...table,
              order: table.order !== undefined ? table.order : index
            };
            cleanedNeutralTables.push(tableWithOrder);
            if (hasGuests) {
              cleanedNeutralArrangement[table.id] = arrangementObj[table.id];
            }
          }
        });
      }
     
      for (const [tableId, guestIds] of Object.entries(cleanedMaleArrangement)) {
        if (!Array.isArray(guestIds)) continue;
       
        const table = cleanedMaleTables.find(t => t.id === tableId);
        if (!table) continue;

        const totalPeople = guestIds.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) {
            return sum;
          }
         
          const count = guest.maleCount || 0;
          return sum + count;
        }, 0);

        if (totalPeople > table.capacity) {
          const errorMsg = req.t('validation.tableOvercapacity', {
            tableName: table.name,
            occupancy: totalPeople,
            capacity: table.capacity
          });
          errors.push(errorMsg);
        }
      }
     
      for (const [tableId, guestIds] of Object.entries(cleanedFemaleArrangement)) {
        if (!Array.isArray(guestIds)) continue;
       
        const table = cleanedFemaleTables.find(t => t.id === tableId);
        if (!table) continue;

        const totalPeople = guestIds.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) {
            return sum;
          }
         
          const count = guest.femaleCount || 0;
          return sum + count;
        }, 0);

        if (totalPeople > table.capacity) {
          const errorMsg = req.t('validation.tableOvercapacity', {
            tableName: table.name,
            occupancy: totalPeople,
            capacity: table.capacity
          });
          errors.push(errorMsg);
        }
      }
     
      updateData.maleTables = updateTableNamesWithGroupsInSync(
        cleanedMaleTables,
        cleanedMaleArrangement,
        maleGuests,
        req
      );
      updateData.femaleTables = updateTableNamesWithGroupsInSync(
        cleanedFemaleTables,
        cleanedFemaleArrangement,
        femaleGuests,
        req
      );
      updateData.maleArrangement = cleanedMaleArrangement;
      updateData.femaleArrangement = cleanedFemaleArrangement;
      updateData.tables = updateTableNamesWithGroupsInSync(
        cleanedNeutralTables,
        cleanedNeutralArrangement,
        guests,
        req
      );
      updateData.arrangement = cleanedNeutralArrangement;
    } else {
      const arrangementObj = arrangement && typeof arrangement === 'object' ? arrangement : {};
      const cleanedTables = [];
      const cleanedArrangement = {};
     
      if (tables) {
        tables.forEach(table => {
          const hasGuests = arrangementObj[table.id] &&
                           Array.isArray(arrangementObj[table.id]) &&
                           arrangementObj[table.id].length > 0;
          const isManualTable = !table.autoCreated && !table.createdForSync;
         
          if (hasGuests || isManualTable) {
            cleanedTables.push(table);
            if (hasGuests) {
              cleanedArrangement[table.id] = arrangementObj[table.id];
            }
          }
        });
      }
     
      for (const [tableId, guestIds] of Object.entries(cleanedArrangement)) {
        if (!Array.isArray(guestIds)) continue;
       
        const table = cleanedTables.find(t => t.id === tableId);
        if (!table) continue;
       
        const totalPeople = guestIds.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) return sum;
          return sum + (guest.attendingCount || 1);
        }, 0);

        if (totalPeople > table.capacity && table.capacity === 10 && totalPeople <= 12) {
          table.capacity = 12;
          table.type = 'round';
        }

        if (totalPeople > table.capacity) {
          errors.push(req.t('validation.tableOvercapacity', {
            tableName: table.name,
            occupancy: totalPeople,
            capacity: table.capacity
          }));
        }
      }
     
      updateData.tables = updateTableNamesWithGroupsInSync(
        cleanedTables,
        cleanedArrangement,
        guests,
        req
      );
      updateData.arrangement = cleanedArrangement;
      updateData.maleTables = [];
      updateData.femaleTables = [];
      updateData.maleArrangement = {};
      updateData.femaleArrangement = {};
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: req.t('seating.errors.validationFailed'),
        errors
      });
    }

    const seating = await Seating.findOneAndUpdate(
      { event: eventId },
      {
        $set: updateData,
        $inc: { version: 1 }
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true
      }
    );

    const responseData = {
      message: req.t('seating.saveSuccess'),
      seating: {
        isSeparatedSeating: seating.isSeparatedSeating,
        preferences: normalizeGroupPolicies(seating.preferences),
        layoutSettings: seating.layoutSettings,
        syncSettings: seating.syncSettings,
        version: seating.version,
        updatedAt: seating.updatedAt,
        syncSummary: seating.getSyncSummary()
      }
    };

    if (seating.isSeparatedSeating) {
      responseData.seating.maleTables = seating.maleTables;
      responseData.seating.femaleTables = seating.femaleTables;
      responseData.seating.maleArrangement = seating.maleArrangement;
      responseData.seating.femaleArrangement = seating.femaleArrangement;
      responseData.seating.tables = seating.tables;
      responseData.seating.arrangement = seating.arrangement;
    } else {
      responseData.seating.tables = seating.tables;
      responseData.seating.arrangement = seating.arrangement;
    }

    res.json(responseData);
  } catch (err) {
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({
        message: req.t('seating.errors.validationError'),
        errors
      });
    }
   
    res.status(500).json({
      message: req.t('seating.errors.saveFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const syncLocks = new Map();

const processSeatingSync = async (req, res) => {

  const { eventId } = req.params;
  const lockKey = `sync_${eventId}_${req.userId}`;

  if (syncLocks.has(lockKey)) {
    return res.json({
      message: req.t('seating.sync.alreadyInProgress'),
      hasChanges: false,
      requiresUserDecision: false,
      syncSummary: {
        autoSyncEnabled: true,
        pendingTriggers: 0,
        lastSyncTrigger: null,
        lastSyncProcessed: null,
        syncStats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          lastSyncStatus: 'success'
        },
        recentTriggers: []
      }
    });
  }

  syncLocks.set(lockKey, true);
 
  try {
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
    }

    let seating;
    let retryCount = 0;
    const maxRetries = 5;
   
    while (retryCount < maxRetries) {
      try {
        seating = await Seating.findOne({ event: eventId });
        if (seating) {
          break;
        }
      } catch (error) {
        retryCount++;
        if (retryCount >= maxRetries) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 200 * retryCount));
      }
    }

    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const pendingTriggers = seating.pendingSyncTriggers;
    const isSeparated = seating.isSeparatedSeating || false;

    if (pendingTriggers.length === 0) {
      let cleanupResult;
     
      if (isSeparated) {
        const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
        const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
       
        const maleCleanup = await cleanupEmptyTables(
          { tables: seating.maleTables, arrangement: seating.maleArrangement },
          maleGuests,
          req
        );
       
        const femaleCleanup = await cleanupEmptyTables(
          { tables: seating.femaleTables, arrangement: seating.femaleArrangement },
          femaleGuests,
          req
        );
       
        if (maleCleanup.hasChanges) {
          seating.maleTables = maleCleanup.tables || seating.maleTables;
          seating.maleArrangement = maleCleanup.arrangement || seating.maleArrangement;
        }
       
        if (femaleCleanup.hasChanges) {
          seating.femaleTables = femaleCleanup.tables || seating.femaleTables;
          seating.femaleArrangement = femaleCleanup.arrangement || seating.femaleArrangement;
        }
       
        cleanupResult = {
          hasChanges: maleCleanup.hasChanges || femaleCleanup.hasChanges,
          actions: [...(maleCleanup.actions || []), ...(femaleCleanup.actions || [])]
        };
      } else {
        cleanupResult = await cleanupEmptyTables(seating, guests, req);
      }
     
      if (cleanupResult.hasChanges) {
        const saveResult = await saveSeatingWithRetryAndValidation(seating, guests, maxRetries);
        if (!saveResult.success) {
          throw new Error(`Failed to save after cleanup: ${saveResult.error}`);
        }
       
        const responseData = {
          message: req.t('seating.sync.arrangementOptimized'),
          hasChanges: true,
          requiresUserDecision: false,
          syncSummary: seating.getSyncSummary(),
          cleanupActions: cleanupResult.actions
        };

        if (isSeparated) {
          responseData.seating = {
            maleTables: seating.maleTables,
            femaleTables: seating.femaleTables,
            maleArrangement: seating.maleArrangement,
            femaleArrangement: seating.femaleArrangement,
            isSeparatedSeating: true,
            syncSummary: seating.getSyncSummary()
          };
          } else {
          responseData.seating = {
            tables: seating.tables,
            arrangement: seating.arrangement,
            isSeparatedSeating: false,
            syncSummary: seating.getSyncSummary()
          };
        }
       
        return res.json(responseData);
      }
     
      return res.json({
        message: req.t('seating.sync.noChangesToProcess'),
        hasChanges: false,
        requiresUserDecision: false,
        syncSummary: seating.getSyncSummary()
      });
    }

    const hasConflictingChanges = await checkForConflictingChanges(seating, pendingTriggers, guests);

    if (hasConflictingChanges) {
      const conservativeOption = await generateSyncOption(seating, pendingTriggers, guests, req, 'conservative');
      const affectedGuests = extractAffectedGuests(pendingTriggers, guests, seating);

      return res.json({
        message: req.t('seating.sync.userApprovalRequired'),
        hasChanges: true,
        requiresUserDecision: true,
        options: [conservativeOption],
        affectedGuests,
        pendingTriggers: pendingTriggers.map(trigger => ({
          id: trigger.timestamp.getTime(),
          changeType: trigger.changeType,
          changeData: trigger.changeData,
          timestamp: trigger.timestamp
        }))
      });
    }

    let syncResults = [];
    let hasChanges = false;
    let hasGuestRemovalOrUpdate = false;

    for (const trigger of pendingTriggers) {
      try {
        const result = await processSingleTrigger(seating, trigger, guests, req);
        seating.processSyncTrigger(trigger, result);
        syncResults.push(result);
       
        if (result.success && result.actions?.length > 0) {
          hasChanges = true;
         
          if (trigger.changeData?.type === 'status_no_longer_confirmed' ||
              trigger.changeData?.type === 'attending_count_increased') {
            hasGuestRemovalOrUpdate = true;
          }
        }
      } catch (error) {
        const errorResult = {
          success: false,
          actions: [],
          errorMessage: error.message
        };
        seating.processSyncTrigger(trigger, errorResult);
        syncResults.push(errorResult);
      }
    }

    if (hasGuestRemovalOrUpdate && seating.syncSettings?.autoOptimizeTables) {
      if (isSeparated) {
        const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
        const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
       
        const maleOptimized = seating.optimizeArrangement(maleGuests, 'male');
        const femaleOptimized = seating.optimizeArrangement(femaleGuests, 'female');
       
        if (maleOptimized || femaleOptimized) {
          hasChanges = true;
          syncResults.push({
            success: true,
            actions: [{
              action: 'arrangement_optimized',
              details: {
                message: req.t('seating.sync.arrangementOptimized'),
                gender: maleOptimized && femaleOptimized ? 'both' : (maleOptimized ? 'male' : 'female')
              }
            }]
          });
        }
      } else {
        const optimized = seating.optimizeArrangement(guests);
        if (optimized) {
          hasChanges = true;
          syncResults.push({
            success: true,
            actions: [{
              action: 'arrangement_optimized',
              details: { message: req.t('seating.sync.arrangementOptimized') }
            }]
          });
        }
      }
    }

    let cleanupResult;
   
    if (isSeparated) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
     
      const maleCleanup = await cleanupEmptyTables(
        { tables: seating.maleTables, arrangement: seating.maleArrangement },
        maleGuests,
        req
      );
     
      const femaleCleanup = await cleanupEmptyTables(
        { tables: seating.femaleTables, arrangement: seating.femaleArrangement },
        femaleGuests,
        req
      );
     
      if (maleCleanup.hasChanges) {
        seating.maleTables = maleCleanup.tables || seating.maleTables;
        seating.maleArrangement = maleCleanup.arrangement || seating.maleArrangement;
        hasChanges = true;
        syncResults.push({
          success: true,
          actions: maleCleanup.actions
        });
      }
     
      if (femaleCleanup.hasChanges) {
        seating.femaleTables = femaleCleanup.tables || seating.femaleTables;
        seating.femaleArrangement = femaleCleanup.arrangement || seating.femaleArrangement;
        hasChanges = true;
        syncResults.push({
          success: true,
          actions: femaleCleanup.actions
        });
      }
    } else {
      cleanupResult = await cleanupEmptyTables(seating, guests, req);
      if (cleanupResult.hasChanges) {
        hasChanges = true;
        syncResults.push({
          success: true,
          actions: cleanupResult.actions
        });
      }
    }

    const saveResult = await saveSeatingWithRetryAndValidation(seating, guests, maxRetries);
    if (!saveResult.success) {
      throw new Error(`Failed to save seating after sync: ${saveResult.error}`);
    }

    const savedSeating = saveResult.savedSeating || await Seating.findOne({ event: eventId });

    const totalActions = syncResults.reduce((sum, result) =>
      sum + (result.actions?.length || 0), 0
    );

    const responseData = {
      message: hasChanges
        ? req.t('seating.sync.changesProcessed', { count: totalActions })
        : req.t('seating.sync.noChangesNeeded'),
      syncResults,
      hasChanges,
      requiresUserDecision: false,
      seating: {
        isSeparatedSeating: savedSeating.isSeparatedSeating,
        syncSummary: savedSeating.getSyncSummary()
      }
    };

    if (savedSeating.isSeparatedSeating) {
      responseData.seating.maleTables = savedSeating.maleTables;
      responseData.seating.femaleTables = savedSeating.femaleTables;
      responseData.seating.maleArrangement = savedSeating.maleArrangement;
      responseData.seating.femaleArrangement = savedSeating.femaleArrangement;
    } else {
      responseData.seating.tables = savedSeating.tables;
      responseData.seating.arrangement = savedSeating.arrangement;
    }

    res.json(responseData);

  } catch (err) {
   
    if (err.name === 'VersionError') {
      try {
        const currentSeating = await Seating.findOne({ event: eventId });
        if (currentSeating) {
          const responseData = {
            message: req.t('seating.sync.versionConflictResolved'),
            hasChanges: false,
            requiresUserDecision: false,
            seating: {
              isSeparatedSeating: currentSeating.isSeparatedSeating,
              syncSummary: currentSeating.getSyncSummary()
            }
          };

          if (currentSeating.isSeparatedSeating) {
            responseData.seating.maleTables = currentSeating.maleTables;
            responseData.seating.femaleTables = currentSeating.femaleTables;
            responseData.seating.maleArrangement = currentSeating.maleArrangement;
            responseData.seating.femaleArrangement = currentSeating.femaleArrangement;
          } else {
            responseData.seating.tables = currentSeating.tables;
            responseData.seating.arrangement = currentSeating.arrangement;
          }

          return res.json(responseData);
        }
      } catch (retryError) {
      }
    }
   
    res.status(500).json({
      message: req.t('seating.sync.processingFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  } finally {
    syncLocks.delete(lockKey);
  }
};

const saveSeatingWithRetryAndValidation = async (seating, guests, maxRetries = 5) => {
  let retryCount = 0;
 
  while (retryCount < maxRetries) {
    try {
      const validationErrors = validateArrangementCapacity(seating.tables, seating.arrangement, guests, { t: (key) => key });
      if (validationErrors.length > 0) {
        return { success: false, error: `Validation failed: ${validationErrors.map(e => e.message || e).join(', ')}` };
      }
     
      seating.markModified('tables');
      seating.markModified('arrangement');
      seating.updatedAt = new Date();
     
      const savedSeating = await seating.save();
     
      const verificationSeating = await seating.constructor.findById(seating._id);
     
      const arrangementKeysOriginal = Object.keys(seating.arrangement || {}).sort();
      const arrangementKeysVerified = Object.keys(verificationSeating.arrangement || {}).sort();
     
      if (JSON.stringify(arrangementKeysOriginal) !== JSON.stringify(arrangementKeysVerified)) {
        return { success: false, error: 'Data corruption detected after save' };
      }
     
      let dataMismatch = false;
      for (const tableId of arrangementKeysOriginal) {
        const originalGuests = (seating.arrangement[tableId] || []).sort();
        const verifiedGuests = (verificationSeating.arrangement[tableId] || []).sort();
       
        if (JSON.stringify(originalGuests) !== JSON.stringify(verifiedGuests)) {
          dataMismatch = true;
        }
      }
     
      if (dataMismatch) {
        return { success: false, error: 'Guest arrangement corruption detected after save' };
      }
     
      return { success: true, savedSeating: verificationSeating };
     
    } catch (error) {
      retryCount++;
     
      if (error.name === 'VersionError' && retryCount < maxRetries) {
        try {
          const latestSeating = await seating.constructor.findById(seating._id);
          if (latestSeating) {
            latestSeating.tables = seating.tables;
            latestSeating.arrangement = seating.arrangement;
            latestSeating.syncTriggers = seating.syncTriggers;
            latestSeating.syncStats = seating.syncStats;
            latestSeating.lastSyncProcessed = seating.lastSyncProcessed;
            latestSeating.updatedAt = new Date();
           
            seating = latestSeating;
            continue;
          }
        } catch (refreshError) {
        }
      }
     
      if (retryCount >= maxRetries) {
        return { success: false, error: `Failed after ${maxRetries} attempts: ${error.message}` };
      }
     
      await new Promise(resolve => setTimeout(resolve, 300 * retryCount));
    }
  }
 
  return { success: false, error: 'Unexpected end of retry loop' };
};

const cleanupEmptyTables = async (seating, guests, req) => {
  const MAX_TABLE_CAPACITY = 24;
  const actions = [];
  const originalTablesCount = seating.tables.length;
  const originalArrangementKeys = Object.keys(seating.arrangement || {});

  const seatedGuestCounts = {};
  Object.values(seating.arrangement || {}).forEach(guestIds => {
    if (Array.isArray(guestIds)) {
      guestIds.forEach(guestId => {
        seatedGuestCounts[guestId] = (seatedGuestCounts[guestId] || 0) + 1;
      });
    }
  });
 
  const duplicateGuests = Object.keys(seatedGuestCounts).filter(guestId =>
    seatedGuestCounts[guestId] > 1
  );
 
  if (duplicateGuests.length > 0) {
    duplicateGuests.forEach(guestId => {
      let foundFirst = false;
      Object.keys(seating.arrangement).forEach(tableId => {
        const guestIndex = seating.arrangement[tableId].indexOf(guestId);
        if (guestIndex !== -1) {
          if (foundFirst) {
            seating.arrangement[tableId].splice(guestIndex, 1);
            if (seating.arrangement[tableId].length === 0) {
              delete seating.arrangement[tableId];
            }
          } else {
            foundFirst = true;
          }
        }
      });
    });
  }

  const validTableIds = new Set(seating.tables.map(t => t.id));
  const orphanedArrangements = Object.keys(seating.arrangement || {}).filter(tableId =>
    !validTableIds.has(tableId)
  );

  if (orphanedArrangements.length > 0) {
    for (const tableId of orphanedArrangements) {
      const orphanedGuests = seating.arrangement[tableId] || [];
     
      for (const guestId of orphanedGuests) {
        const guest = guests.find(g => g._id.toString() === guestId);
       
        if (!guest) {
          continue;
        }
       
        if (guest.rsvpStatus !== 'confirmed') {
          continue;
        }
       
        let alreadySeatedAt = null;
        validTableIds.forEach(validTableId => {
          if (validTableId !== tableId && seating.arrangement[validTableId] && seating.arrangement[validTableId].includes(guestId)) {
            alreadySeatedAt = validTableId;
          }
        });
       
        if (alreadySeatedAt) {
          continue;
        }
       
        const guestSize = guest.attendingCount || 1;
       
        const suitableTable = seating.tables.find(table => {
          const currentGuests = seating.arrangement[table.id] || [];
          const currentOccupancy = currentGuests.reduce((sum, gId) => {
            const g = guests.find(g => g._id.toString() === gId);
            return sum + (g?.attendingCount || 1);
          }, 0);
         
          const availableSpace = table.capacity - currentOccupancy;
          return availableSpace >= guestSize;
        });
       
        if (suitableTable) {
          if (!seating.arrangement[suitableTable.id]) {
            seating.arrangement[suitableTable.id] = [];
          }
         
          if (!seating.arrangement[suitableTable.id].includes(guestId)) {
            seating.arrangement[suitableTable.id].push(guestId);
           
            actions.push({
              action: 'guest_rescued_to_existing_table',
              details: {
                guestName: `${guest.firstName} ${guest.lastName}`,
                tableName: suitableTable.name,
                reason: req.t('seating.sync.guestRescuedToExistingTable')
              }
            });
          }
        } else {
          const tableNumber = seating.tables.length + 1;
          const optimalCapacity = Math.min(Math.max(12, Math.ceil(guestSize * 1.5)), MAX_TABLE_CAPACITY);
         
          const newTable = createTableSimulation(seating, optimalCapacity, tableNumber, req);
         
          if (!seating.arrangement[newTable.id]) {
            seating.arrangement[newTable.id] = [];
          }
          seating.arrangement[newTable.id].push(guestId);
         
          actions.push({
            action: 'table_created_for_rescue',
            details: {
              tableName: newTable.name,
              guestName: `${guest.firstName} ${guest.lastName}`,
              capacity: newTable.capacity,
              reason: req.t('seating.sync.tableCreatedForRescue')
            }
          });
        }
      }
     
      delete seating.arrangement[tableId];
     
      actions.push({
        action: 'orphaned_arrangement_removed',
        details: {
          tableId,
          guestsCount: orphanedGuests.length
        }
      });
    }
  }

  const emptyTables = seating.tables.filter(table => {
    const hasGuests = seating.arrangement[table.id] && seating.arrangement[table.id].length > 0;
    const isAutoCreated = table.autoCreated || table.createdForSync;
   
    if (!hasGuests && isAutoCreated) {
      return true;
    }
    return false;
  });

  emptyTables.forEach(table => {
    seating.tables = seating.tables.filter(t => t.id !== table.id);
   
    if (seating.arrangement[table.id]) {
      delete seating.arrangement[table.id];
    }
   
    actions.push({
      action: 'empty_table_removed',
      details: { tableName: table.name, tableId: table.id }
    });
  });

  return {
    hasChanges: actions.length > 0,
    actions,
    tables: seating.tables,
    arrangement: seating.arrangement
  };
};

const checkForConflictingChanges = async (seating, triggers, guests) => {
  const isSeparated = seating.isSeparatedSeating || false;
 
  for (const trigger of triggers) {
    const { changeType, changeData } = trigger;
   
    if (changeType === 'guest_deleted' ||
        (changeType === 'rsvp_updated' && changeData.type === 'status_no_longer_confirmed')) {
      return true;
    }
   
    if (changeType === 'rsvp_updated' && changeData.type === 'attending_count_increased') {
      const { guestId, newCount, oldCount } = changeData;
      const changeAmount = newCount - oldCount;
     
      if (changeAmount >= 2) {
        return true;
      }
     
      if (changeAmount >= 1) {
        let isGuestSeated = false;
        let guestTableId = null;
        let currentTable = null;
       
        if (isSeparated) {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (guest && guest.gender) {
            const arrangement = guest.gender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
            const tables = guest.gender === 'male' ? seating.maleTables : seating.femaleTables;
           
            isGuestSeated = Object.values(arrangement || {}).some(guestIds =>
              Array.isArray(guestIds) && guestIds.includes(guestId)
            );
           
            if (isGuestSeated) {
              Object.keys(arrangement).forEach(tableId => {
                if (arrangement[tableId] && arrangement[tableId].includes(guestId)) {
                  guestTableId = tableId;
                }
              });
             
              currentTable = tables.find(t => t.id === guestTableId);
            }
          }
        } else {
          isGuestSeated = Object.values(seating.arrangement || {}).some(guestIds =>
            Array.isArray(guestIds) && guestIds.includes(guestId)
          );
         
          if (isGuestSeated) {
            Object.keys(seating.arrangement).forEach(tableId => {
              if (seating.arrangement[tableId] && seating.arrangement[tableId].includes(guestId)) {
                guestTableId = tableId;
              }
            });
           
            currentTable = seating.tables.find(t => t.id === guestTableId);
          }
        }
       
        if (isGuestSeated && currentTable) {
          const arrangement = isSeparated
            ? (guests.find(g => g._id.toString() === guestId)?.gender === 'male' ? seating.maleArrangement : seating.femaleArrangement)
            : seating.arrangement;
           
          const tableGuests = arrangement[guestTableId] || [];
          const otherGuestsSize = tableGuests
            .filter(id => id !== guestId)
            .reduce((sum, gId) => {
              const guest = guests.find(g => g._id.toString() === gId);
              return sum + (guest?.attendingCount || 1);
            }, 0);
         
          const newTotalSize = otherGuestsSize + newCount;
         
          if (newTotalSize > currentTable.capacity) {
            return true;
          }
        } else {
          const tables = isSeparated
            ? (guests.find(g => g._id.toString() === guestId)?.gender === 'male' ? seating.maleTables : seating.femaleTables)
            : seating.tables;
          const arrangement = isSeparated
            ? (guests.find(g => g._id.toString() === guestId)?.gender === 'male' ? seating.maleArrangement : seating.femaleArrangement)
            : seating.arrangement;
           
          const hasAvailableSpace = tables.some(table => {
            const tableGuests = arrangement[table.id] || [];
            const currentOccupancy = tableGuests.reduce((sum, guestId) => {
              const guest = guests.find(g => g._id.toString() === guestId);
              return sum + (guest?.attendingCount || 1);
            }, 0);
           
            return (table.capacity - currentOccupancy) >= newCount;
          });
         
          if (!hasAvailableSpace) {
            return true;
          }
        }
      }
    }
   
    if ((changeType === 'rsvp_updated' && changeData.type === 'status_became_confirmed') ||
        changeType === 'guest_added') {
      const hasTables = isSeparated 
        ? ((seating.maleTables && seating.maleTables.length > 0) || (seating.femaleTables && seating.femaleTables.length > 0))
        : (seating.tables && seating.tables.length > 0);
      
      if (hasTables) {
        return true;
      }
    }
    
    if (changeType === 'rsvp_updated' && changeData.type === 'attending_count_increased') {
      const { guestId, oldCount, oldMaleCount, oldFemaleCount } = changeData;
      
      const currentGuest = guests.find(g => g._id.toString() === guestId);
      if (!currentGuest) {
        continue;
      }
      
      let stillIncreased = false;
      if (isSeparated) {
        const currentMale = currentGuest.maleCount || 0;
        const currentFemale = currentGuest.femaleCount || 0;
        const prevMale = oldMaleCount || 0;
        const prevFemale = oldFemaleCount || 0;
        stillIncreased = currentMale > prevMale || currentFemale > prevFemale;

      } else {
        const currentCount = currentGuest.attendingCount || 1;
        const prevCount = oldCount || 1;
        stillIncreased = currentCount > prevCount;
      }
      
      if (!stillIncreased) {
        continue;
      }
      
      let isGuestSeated = false;
      
      if (isSeparated) {
        isGuestSeated = Object.values(seating.maleArrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        ) || Object.values(seating.femaleArrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
      } else {
        isGuestSeated = Object.values(seating.arrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
      }
      
      if (isGuestSeated) {
        return true;
      }
    }
  }
 
  return false;
};

const processSingleTrigger = async (seating, trigger, guests, req) => {
  const { changeType, changeData } = trigger;
  const actions = [];
  let success = true;
  const isSeparated = seating.isSeparatedSeating || false;

  try {
    switch (changeType) {
      case 'guest_added':
      case 'rsvp_updated':
        if (changeData.type === 'status_became_confirmed') {
          if (isSeparated) {
            const guestGender = changeData.guest.gender;
            const result = await seatNewGuestSeparated(seating, changeData.guest, guests, req, guestGender);
            actions.push(...result.actions);
          } else {
            const result = await seatNewGuest(seating, changeData.guest, guests, req);
            actions.push(...result.actions);
          }
        } else if (changeData.type === 'status_no_longer_confirmed') {
          const result = await unseatGuest(seating, changeData.guestId, guests, req);
          actions.push(...result.actions);
        } else if (changeData.type === 'attending_count_increased') {
          const result = await handleAttendingCountChangeOnly(seating, changeData, guests, req);
          actions.push(...result.actions);
        }
        break;

      case 'guest_deleted':
        const deleteResult = await unseatGuest(seating, changeData.guestId, guests, req);
        actions.push(...deleteResult.actions);
        break;

      default:
        success = false;
    }

  } catch (error) {
    success = false;
    return {
      success: false,
      actions: [],
      errorMessage: error.message
    };
  }

  return {
    success,
    actions
  };
};

const handleAttendingCountChangeOnly = async (seating, changeData, allGuests, req) => {
  const actions = [];
  const { guestId, guest, oldCount, newCount } = changeData;
  const isSeparated = seating.isSeparatedSeating || false;
 
  if (isSeparated) {
    const guestGender = guest.gender;
    const currentTables = guestGender === 'male' ? seating.maleTables : seating.femaleTables;
    const currentArrangement = guestGender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
    const genderGuests = allGuests.filter(g => g.gender === guestGender);
   
    let guestTableId = null;
    Object.keys(currentArrangement || {}).forEach(tableId => {
      if (currentArrangement[tableId] && currentArrangement[tableId].includes(guestId)) {
        guestTableId = tableId;
      }
    });

    if (!guestTableId) {
      const result = await seatNewGuest(seating, guest, allGuests, req);
      return result;
    }

    const currentTable = currentTables.find(t => t.id === guestTableId);
    if (!currentTable) {
      return { actions: [] };
    }

    const tableGuests = currentArrangement[guestTableId] || [];
    const otherGuestsSize = tableGuests
      .filter(id => id !== guestId)
      .reduce((sum, gId) => {
        const g = genderGuests.find(guest => guest._id.toString() === gId);
        return sum + (g?.attendingCount || 1);
      }, 0);
   
    const newTotalSize = otherGuestsSize + newCount;
   
    if (newTotalSize <= currentTable.capacity) {
      actions.push({
        action: 'guest_updated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: currentTable.name,
          gender: guestGender,
          oldCount,
          newCount
        }
      });
    } else {
      const guestIndex = currentArrangement[guestTableId].indexOf(guestId);
      if (guestIndex !== -1) {
        currentArrangement[guestTableId].splice(guestIndex, 1);
        if (currentArrangement[guestTableId].length === 0) {
          delete currentArrangement[guestTableId];
        }
      }

      let newTable = seating.findAvailableTable(newCount, genderGuests, [], guestGender);
     
      if (!newTable) {
        const tableNumber = currentTables.length + 1;
        const optimalCapacity = Math.max(
          seating.syncSettings?.preferredTableSize || 12,
          Math.ceil(newCount * 1.5)
        );
       
        newTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
       
        if (guestGender === 'male') {
          seating.maleTables.push(newTable);
        } else {
          seating.femaleTables.push(newTable);
        }
       
        actions.push({
          action: 'table_created',
          details: {
            tableName: newTable.name,
            capacity: newTable.capacity,
            gender: guestGender
          }
        });
      }

      if (!currentArrangement[newTable.id]) {
        currentArrangement[newTable.id] = [];
      }
     
      if (!currentArrangement[newTable.id].includes(guestId)) {
        currentArrangement[newTable.id].push(guestId);
       
        const finalOccupancy = currentArrangement[newTable.id].reduce((sum, gId) => {
          const g = genderGuests.find(guest => guest._id.toString() === gId);
          return sum + (g?.attendingCount || 1);
        }, 0);
       
        actions.push({
          action: 'guest_moved',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            fromTable: currentTable.name,
            toTable: newTable.name,
            gender: guestGender,
            oldCount,
            newCount
          }
        });
      }
    }
  } else {
    let guestTableId = null;
    Object.keys(seating.arrangement || {}).forEach(tableId => {
      if (seating.arrangement[tableId] && seating.arrangement[tableId].includes(guestId)) {
        guestTableId = tableId;
      }
    });

    if (!guestTableId) {
      const result = await seatNewGuest(seating, guest, allGuests, req);
      return result;
    }

    const currentTable = seating.tables.find(t => t.id === guestTableId);
    if (!currentTable) {
      return { actions: [] };
    }

    const tableGuests = seating.arrangement[guestTableId] || [];
    const otherGuestsSize = tableGuests
      .filter(id => id !== guestId)
      .reduce((sum, gId) => {
        const g = allGuests.find(guest => guest._id.toString() === gId);
        return sum + (g?.attendingCount || 1);
      }, 0);
   
    const newTotalSize = otherGuestsSize + newCount;
   
    if (newTotalSize <= currentTable.capacity) {
      actions.push({
        action: 'guest_updated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: currentTable.name,
          oldCount,
          newCount
        }
      });
    } else {
      const guestIndex = seating.arrangement[guestTableId].indexOf(guestId);
      if (guestIndex !== -1) {
        seating.arrangement[guestTableId].splice(guestIndex, 1);
        if (seating.arrangement[guestTableId].length === 0) {
          delete seating.arrangement[guestTableId];
        }
      }

      let newTable = seating.findAvailableTable(newCount, allGuests);
     
      if (!newTable) {
        const tableNumber = seating.tables.length + 1;
        const optimalCapacity = Math.max(
          seating.syncSettings?.preferredTableSize || 12,
          Math.ceil(newCount * 1.5)
        );
       
        newTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
       
        actions.push({
          action: 'table_created',
          details: {
            tableName: newTable.name,
            capacity: newTable.capacity
          }
        });
      }

      if (!seating.arrangement[newTable.id]) {
        seating.arrangement[newTable.id] = [];
      }
     
      if (!seating.arrangement[newTable.id].includes(guestId)) {
        seating.arrangement[newTable.id].push(guestId);
       
        const finalOccupancy = seating.arrangement[newTable.id].reduce((sum, gId) => {
          const g = allGuests.find(guest => guest._id.toString() === gId);
          return sum + (g?.attendingCount || 1);
        }, 0);
     
        actions.push({
          action: 'guest_moved',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            fromTable: currentTable.name,
            toTable: newTable.name,
            oldCount,
            newCount
          }
        });
      }
    }
  }

  return { actions };
};

const seatNewGuest = async (seating, guest, allGuests, req) => {
  const actions = [];
  const guestSize = guest.attendingCount || 1;
  const isSeparated = seating.isSeparatedSeating || false;
 
  if (isSeparated) {
    const guestGender = guest.gender;
    const currentTables = guestGender === 'male' ? seating.maleTables : seating.femaleTables;
    const currentArrangement = guestGender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
    const genderGuests = allGuests.filter(g => g.gender === guestGender);
   
    let availableTable = seating.findAvailableTable(guestSize, genderGuests, [], guestGender);
   
    if (!availableTable) {
      const tableNumber = currentTables.length + 1;
      const optimalCapacity = Math.max(
        seating.syncSettings.preferredTableSize || 12,
        Math.ceil(guestSize * 1.5)
      );
     
      availableTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
     
      if (guestGender === 'male') {
        seating.maleTables.push(availableTable);
      } else {
        seating.femaleTables.push(availableTable);
      }
     
      actions.push({
        action: 'table_created',
        details: {
          tableName: availableTable.name,
          capacity: availableTable.capacity,
          gender: guestGender,
          reason: req.t('seating.sync.createdForGuest', {
            guestName: `${guest.firstName} ${guest.lastName}`
          })
        }
      });
    }
   
    if (!currentArrangement[availableTable.id]) {
      currentArrangement[availableTable.id] = [];
    }
   
    if (!currentArrangement[availableTable.id].includes(guest._id.toString())) {
      currentArrangement[availableTable.id].push(guest._id.toString());
     
      const finalOccupancy = currentArrangement[availableTable.id].reduce((sum, guestId) => {
        const g = genderGuests.find(guest => guest._id.toString() === guestId);
        return sum + (g?.attendingCount || 1);
      }, 0);
     
      actions.push({
        action: 'guest_seated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: availableTable.name,
          gender: guestGender,
          attendingCount: guestSize
        }
      });
    }
  } else {
    let availableTable = seating.findAvailableTable(guestSize, allGuests);
   
    if (!availableTable) {
      const tableNumber = seating.tables.length + 1;
      const optimalCapacity = Math.max(
        seating.syncSettings.preferredTableSize || 12,
        Math.ceil(guestSize * 1.5)
      );
     
      availableTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
     
      actions.push({
        action: 'table_created',
        details: {
          tableName: availableTable.name,
          capacity: availableTable.capacity,
          reason: req.t('seating.sync.createdForGuest', {
            guestName: `${guest.firstName} ${guest.lastName}`
          })
        }
      });
    }
   
    if (!seating.arrangement[availableTable.id]) {
      seating.arrangement[availableTable.id] = [];
    }
   
    if (!seating.arrangement[availableTable.id].includes(guest._id.toString())) {
      seating.arrangement[availableTable.id].push(guest._id.toString());
     
      const finalOccupancy = seating.arrangement[availableTable.id].reduce((sum, guestId) => {
        const g = allGuests.find(guest => guest._id.toString() === guestId);
        return sum + (g?.attendingCount || 1);
      }, 0);
     
      actions.push({
        action: 'guest_seated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: availableTable.name,
          attendingCount: guestSize
        }
      });
    }
  }
 
  return { actions };
};

const seatNewGuestSeparated = async (seating, guest, allGuests, req, gender) => {
  const actions = [];
  const guestSize = guest.attendingCount || 1;
  const guestGender = guest.gender;
 
  if (guestGender !== gender) {
    return {
      actions: [{
        action: 'guest_wrong_gender',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          expectedGender: gender,
          actualGender: guestGender,
          reason: req.t('seating.sync.genderMismatch')
        }
      }]
    };
  }
 
  const currentTables = gender === 'male' ? seating.maleTables : seating.femaleTables;
  const currentArrangement = gender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
  const genderGuests = allGuests.filter(g => g.gender === gender);
 
  let availableTable = seating.findAvailableTable(guestSize, genderGuests, [], gender);
 
  if (!availableTable) {
    const tableNumber = currentTables.length + 1;
    const optimalCapacity = Math.max(
      seating.syncSettings.preferredTableSize || 12,
      Math.ceil(guestSize * 1.5)
    );
   
    availableTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
   
    if (gender === 'male') {
      seating.maleTables.push(availableTable);
    } else {
      seating.femaleTables.push(availableTable);
    }
   
    actions.push({
      action: 'table_created',
      details: {
        tableName: availableTable.name,
        capacity: availableTable.capacity,
        gender: gender,
        reason: req.t('seating.sync.createdForGuest', {
          guestName: `${guest.firstName} ${guest.lastName}`
        })
      }
    });
  }
 
  if (!currentArrangement[availableTable.id]) {
    currentArrangement[availableTable.id] = [];
  }
 
  if (!currentArrangement[availableTable.id].includes(guest._id.toString())) {
    currentArrangement[availableTable.id].push(guest._id.toString());
   
    const finalOccupancy = currentArrangement[availableTable.id].reduce((sum, guestId) => {
      const g = genderGuests.find(guest => guest._id.toString() === guestId);
      return sum + (g?.attendingCount || 1);
    }, 0);
   
    actions.push({
      action: 'guest_seated',
      details: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        tableName: availableTable.name,
        gender: gender,
        attendingCount: guestSize
      }
    });
  }
 
  return { actions };
};

const unseatGuest = async (seating, guestId, allGuests, req) => {
  const actions = [];
  let guestName = req.t('seating.unknownGuest');
  const isSeparated = seating.isSeparatedSeating || false;
 
  const guest = allGuests.find(g => g._id.toString() === guestId) ||
               allGuests.find(g => g._id === guestId);
  if (guest) {
    guestName = `${guest.firstName} ${guest.lastName}`;
  }
 
  let wasSeated = false;
 
  if (isSeparated && guest) {
    const guestGender = guest.gender;
    const currentArrangement = guestGender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
    const currentTables = guestGender === 'male' ? seating.maleTables : seating.femaleTables;
   
    Object.keys(currentArrangement).forEach(tableId => {
      const guestIndex = currentArrangement[tableId].indexOf(guestId);
      if (guestIndex !== -1) {
        currentArrangement[tableId].splice(guestIndex, 1);
        if (currentArrangement[tableId].length === 0) {
          delete currentArrangement[tableId];
        }
       
        const table = currentTables.find(t => t.id === tableId);
        actions.push({
          action: 'guest_removed',
          details: {
            guestName,
            tableName: table?.name || req.t('seating.unknownTable'),
            gender: guestGender
          }
        });
        wasSeated = true;
      }
    });
  } else {
    Object.keys(seating.arrangement).forEach(tableId => {
      const guestIndex = seating.arrangement[tableId].indexOf(guestId);
      if (guestIndex !== -1) {
        seating.arrangement[tableId].splice(guestIndex, 1);
        if (seating.arrangement[tableId].length === 0) {
          delete seating.arrangement[tableId];
        }
       
        const table = seating.tables.find(t => t.id === tableId);
        actions.push({
          action: 'guest_removed',
          details: {
            guestName,
            tableName: table?.name || req.t('seating.unknownTable')
          }
        });
        wasSeated = true;
      }
    });
  }
 
  if (!wasSeated) {
    actions.push({
      action: 'guest_not_seated',
      details: {
        guestName,
        reason: req.t('seating.sync.guestNotSeated')
      }
    });
  }
 
  return { actions };
};

const updateSyncSettings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const syncSettings = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
    }

    const seating = await Seating.findOneAndUpdate(
      { event: eventId },
      {
        $set: {
          syncSettings: {
            autoSyncEnabled: syncSettings.autoSyncEnabled !== undefined
              ? syncSettings.autoSyncEnabled : true,
            syncOnRsvpChange: syncSettings.syncOnRsvpChange !== undefined
              ? syncSettings.syncOnRsvpChange : true,
            syncOnAttendingCountChange: syncSettings.syncOnAttendingCountChange !== undefined
              ? syncSettings.syncOnAttendingCountChange : true,
            autoCreateTables: syncSettings.autoCreateTables !== undefined
              ? syncSettings.autoCreateTables : true,
            autoOptimizeTables: syncSettings.autoOptimizeTables !== undefined
              ? syncSettings.autoOptimizeTables : true,
            preferredTableSize: syncSettings.preferredTableSize || 12
          }
        }
      },
      { new: true, upsert: true }
    );

    res.json({
      message: req.t('seating.sync.settingsUpdated'),
      syncSettings: seating.syncSettings,
      syncSummary: seating.getSyncSummary()
    });
  } catch (err) {
    res.status(500).json({
      message: req.t('seating.errors.updateSyncSettingsFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const getSyncStatus = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const seating = await Seating.findOne({ event: eventId });
   
    if (!seating) {
      return res.json({
        syncRequired: false,
        autoSyncEnabled: true,
        pendingTriggers: 0,
        lastSync: null,
        syncStats: {
          totalSyncs: 0,
          successfulSyncs: 0,
          failedSyncs: 0,
          lastSyncStatus: 'success'
        }
      });
    }

    const syncSummary = seating.getSyncSummary();
   
    res.json({
      syncRequired: syncSummary.pendingTriggers > 0,
      autoSyncEnabled: syncSummary.autoSyncEnabled,
      pendingTriggers: syncSummary.pendingTriggers,
      lastSync: syncSummary.lastSyncProcessed,
      syncStats: syncSummary.syncStats,
      recentTriggers: syncSummary.recentTriggers
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const proposeSyncOptions = async (req, res) => {

  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const seating = await Seating.findOne({ event: eventId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const pendingTriggers = seating.pendingSyncTriggers;
    if (pendingTriggers.length === 0) {
      return res.json({
        message: req.t('seating.sync.noChangesToProcess'),
        hasChanges: false,
        options: []
      });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const conservativeOption = await generateSyncOption(seating, pendingTriggers, guests, req, 'conservative');

    const affectedGuests = extractAffectedGuests(pendingTriggers, guests);

    res.json({
      message: req.t('seating.sync.optionsGenerated'),
      options: [conservativeOption],
      affectedGuests,
      pendingTriggers: pendingTriggers.map(trigger => ({
        id: trigger.timestamp.getTime(),
        changeType: trigger.changeType,
        changeData: trigger.changeData
      }))
    });

  } catch (err) {
    res.status(500).json({
      message: req.t('seating.sync.optionGenerationFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const generateSyncOption = async (seating, triggers, guests, req, strategy) => {

  const isSeparated = seating.isSeparatedSeating || false;

  let optionSeating;

  if (isSeparated) {
    optionSeating = {
      tables: [],
      maleTables: JSON.parse(JSON.stringify(seating.maleTables || [])),
      femaleTables: JSON.parse(JSON.stringify(seating.femaleTables || [])),
      maleArrangement: JSON.parse(JSON.stringify(seating.maleArrangement || {})),
      femaleArrangement: JSON.parse(JSON.stringify(seating.femaleArrangement || {})),
      isSeparatedSeating: true,
      preferences: normalizeGroupPolicies(seating.preferences) || {}
    };
  } else {
    optionSeating = {
      tables: JSON.parse(JSON.stringify(seating.tables)),
      arrangement: JSON.parse(JSON.stringify(seating.arrangement || {})),
      isSeparatedSeating: false,
      preferences: normalizeGroupPolicies(seating.preferences) || {}
    };
  }

  const actions = [];
  let description = '';

  try {
    if (strategy === 'conservative') {
      for (const trigger of triggers) {
        const result = await simulateSyncTrigger(optionSeating, trigger, guests, req, strategy);
        actions.push(...result.actions);
      }
     
    } else {
      const currentlySeatedGuests = new Set();
      Object.values(optionSeating.arrangement || {}).forEach(guestIds => {
        if (Array.isArray(guestIds)) {
          guestIds.forEach(id => currentlySeatedGuests.add(id));
        }
      });
     
      if (isSeparated) {
        Object.values(optionSeating.maleArrangement || {}).forEach(guestIds => {
          if (Array.isArray(guestIds)) {
            guestIds.forEach(id => currentlySeatedGuests.add(id));
          }
        });
        Object.values(optionSeating.femaleArrangement || {}).forEach(guestIds => {
          if (Array.isArray(guestIds)) {
            guestIds.forEach(id => currentlySeatedGuests.add(id));
          }
        });
      }
     
      const allGuestsToSeat = guests.filter(g => g.rsvpStatus === 'confirmed');

      allGuestsToSeat.forEach(guest => {
        if (guest.attendingCount === undefined || guest.attendingCount === null) {
          guest.attendingCount = 1;
        }
      });
     
      const preferences = seating.preferences || {};
      const userPreferences = {
        ...preferences,
        seatingRules: seating.preferences?.seatingRules || {
          mustSitTogether: [],
          cannotSitTogether: []
        },
        groupMixingRules: seating.preferences?.groupMixingRules || [],
        allowGroupMixing: seating.preferences?.allowGroupMixing || false,
        preferredTableSize: seating.preferences?.preferredTableSize || 12,
        groupPolicies: seating.preferences?.groupPolicies || {}
      };

      const mixableGroupPairs = new Set();
      if (userPreferences.groupMixingRules && userPreferences.groupMixingRules.length > 0) {
        userPreferences.groupMixingRules.forEach(rule => {
          mixableGroupPairs.add(`${rule.group1}|${rule.group2}`);
          mixableGroupPairs.add(`${rule.group2}|${rule.group1}`);
        });
      }

      const groupPolicies = userPreferences.groupPolicies || {};
      const mPolicyGroups = Object.keys(groupPolicies).filter(g => groupPolicies[g] === 'M');
      for (let i = 0; i < mPolicyGroups.length; i++) {
        for (let j = i + 1; j < mPolicyGroups.length; j++) {
          mixableGroupPairs.add(`${mPolicyGroups[i]}|${mPolicyGroups[j]}`);
          mixableGroupPairs.add(`${mPolicyGroups[j]}|${mPolicyGroups[i]}`);
        }
      }

      const canGroupsMix = (group1, group2) => {
        if (!group1 || !group2) return true;
        if (group1 === group2) return true;
       
        const allowGroupMixing = userPreferences.allowGroupMixing || false;
        
        if (!allowGroupMixing) return false;
       
        if (groupPolicies[group1] === 'S' || groupPolicies[group2] === 'S') {
          return false;
        }
       
        if (groupPolicies[group1] === 'M' && groupPolicies[group2] === 'M') {
          return true;
        }
       
        if (mixableGroupPairs.has(`${group1}|${group2}`)) {
          return true;
        }
       
        if (allowGroupMixing && mixableGroupPairs.size === 0 && Object.keys(groupPolicies).length === 0) {
          return true;
        }
       
        return false;
      };

      if (isSeparated) {
        const affectedGuestIds = new Set();
        const affectedByGender = { male: new Set(), female: new Set() };
       
        triggers.forEach(trigger => {
          const { changeType, changeData } = trigger;
          let guestId = null;
         
          if (changeData.guestId) {
            guestId = changeData.guestId;
          } else if (changeData.guest && changeData.guest._id) {
            guestId = changeData.guest._id.toString();
          }
         
          if (guestId) {
            affectedGuestIds.add(guestId);
           
            if (changeData.changedGenders && changeData.changedGenders.length > 0) {
              changeData.changedGenders.forEach(g => {
                if (g === 'male') affectedByGender.male.add(guestId);
                if (g === 'female') affectedByGender.female.add(guestId);
              });
            } else if (changeType === 'guest_added' || changeType === 'rsvp_updated') {
              const guest = guests.find(g => g._id.toString() === guestId);
              if (guest) {
                if (guest.maleCount > 0) affectedByGender.male.add(guestId);
                if (guest.femaleCount > 0) affectedByGender.female.add(guestId);
              }
            }
          }
        });

        affectedGuestIds.forEach(guestId => {
          Object.keys(optionSeating.maleArrangement || {}).forEach(tableId => {
            const guestIds = optionSeating.maleArrangement[tableId] || [];
            const filteredIds = guestIds.filter(id =>
              id.toString() !== guestId && id.toString() !== guestId.toString()
            );
            if (filteredIds.length !== guestIds.length) {
              optionSeating.maleArrangement[tableId] = filteredIds;
              if (filteredIds.length === 0) {
                delete optionSeating.maleArrangement[tableId];
              }
            }
          });
         
          Object.keys(optionSeating.femaleArrangement || {}).forEach(tableId => {
            const guestIds = optionSeating.femaleArrangement[tableId] || [];
            const filteredIds = guestIds.filter(id =>
              id.toString() !== guestId && id.toString() !== guestId.toString()
            );
            if (filteredIds.length !== guestIds.length) {
              optionSeating.femaleArrangement[tableId] = filteredIds;
              if (filteredIds.length === 0) {
                delete optionSeating.femaleArrangement[tableId];
              }
            }
          });
        });

        const findSuitableTable = (guest, tables, arrangement, guestGender) => {
          const guestSize = guestGender === 'male' ? guest.maleCount : guest.femaleCount;
          const guestGroup = guest.customGroup || guest.group;
          const policy = groupPolicies[guestGroup];
                  
          const sortedTables = [...tables].sort((a, b) => {
            const aGuestIds = arrangement[a.id] || [];
            const bGuestIds = arrangement[b.id] || [];
           
            const aHasSameGroup = aGuestIds.some(gId => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return g && (g.customGroup || g.group) === guestGroup;
            });
           
            const bHasSameGroup = bGuestIds.some(gId => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return g && (g.customGroup || g.group) === guestGroup;
            });
           
            if (aHasSameGroup && !bHasSameGroup) return -1;
            if (!aHasSameGroup && bHasSameGroup) return 1;
           
            const aOccupancy = aGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (guestGender === 'male' ? (g?.maleCount || 0) : (g?.femaleCount || 0));
            }, 0);
           
            const bOccupancy = bGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (guestGender === 'male' ? (g?.maleCount || 0) : (g?.femaleCount || 0));
            }, 0);
           
            return bOccupancy - aOccupancy;
          });
         
          for (const table of sortedTables) {
            const currentGuestIds = arrangement[table.id] || [];
            const currentOccupancy = currentGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (guestGender === 'male' ? (g?.maleCount || 0) : (g?.femaleCount || 0));
            }, 0);
           
            const availableSpace = table.capacity - currentOccupancy;
           
            if (availableSpace < guestSize) {
              continue;
            }
           
            if (currentGuestIds.length === 0) {
              return table;
            }
           
            const tableGuests = currentGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId.toString())
            ).filter(Boolean);
           
            const tableGroups = new Set(tableGuests.map(g => g.customGroup || g.group));
           
            if (tableGroups.size === 1 && tableGroups.has(guestGroup)) {
              return table;
            }
           
            let canSitHere = true;
            for (const tableGroup of tableGroups) {
              if (!canGroupsMix(guestGroup, tableGroup)) {
                canSitHere = false;
                break;
              }
            }
           
            if (canSitHere) {
              return table;
            }
          }
         
          return null;
        };

        const maleAffectedGuests = allGuestsToSeat.filter(g =>
          g.maleCount && g.maleCount > 0 && affectedByGender.male.has(g._id.toString())
        );
       
        const femaleAffectedGuests = allGuestsToSeat.filter(g =>
          g.femaleCount && g.femaleCount > 0 && affectedByGender.female.has(g._id.toString())
        );

        const groupMaleGuestsForMixing = (guestsToGroup) => {
          const grouped = new Map();
          const guestToCluster = new Map();
          let clusterId = 0;

          for (const guest of guestsToGroup) {
            const guestGroup = guest.customGroup || guest.group;
            const guestPolicy = groupPolicies[guestGroup];

            if (guestPolicy === 'S') {
              const newClusterId = `separate_${clusterId++}`;
              grouped.set(newClusterId, [guest]);
              guestToCluster.set(guest._id.toString(), newClusterId);
              continue;
            }

            let foundCluster = null;
            for (const [cId, clusterGuests] of grouped) {
              if (cId.startsWith('separate_')) continue;

              const clusterGroup = clusterGuests[0].customGroup || clusterGuests[0].group;
              if (canGroupsMix(guestGroup, clusterGroup)) {
                foundCluster = cId;
                break;
              }
            }

            if (foundCluster) {
              grouped.get(foundCluster).push(guest);
              guestToCluster.set(guest._id.toString(), foundCluster);
            } else {
              const newClusterId = `cluster_${clusterId++}`;
              grouped.set(newClusterId, [guest]);
              guestToCluster.set(guest._id.toString(), newClusterId);
            }
          }

          return grouped;
        };

        const maleGuestClusters = groupMaleGuestsForMixing(maleAffectedGuests);

        for (const [clusterId, clusterGuests] of maleGuestClusters) {
          
          const totalClusterSize = clusterGuests.reduce((sum, g) => sum + (g.maleCount || 0), 0);
          
          let targetTable = null;
          
          for (const table of optionSeating.maleTables) {
            const currentGuestIds = optionSeating.maleArrangement[table.id] || [];
            const currentOccupancy = currentGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (g?.maleCount || 0);
            }, 0);
            
            const availableSpace = table.capacity - currentOccupancy;
            if (availableSpace < totalClusterSize) continue;
            
            if (currentGuestIds.length === 0) {
              targetTable = table;
              break;
            }
            
            const tableGuests = currentGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId.toString())
            ).filter(Boolean);
            
            let allCanMix = true;
            for (const clusterGuest of clusterGuests) {
              const clusterGroup = clusterGuest.customGroup || clusterGuest.group;
              for (const tableGuest of tableGuests) {
                const tableGroup = tableGuest.customGroup || tableGuest.group;
                if (!canGroupsMix(clusterGroup, tableGroup)) {
                  allCanMix = false;
                  break;
                }
              }
              if (!allCanMix) break;
            }
            
            if (allCanMix) {
              targetTable = table;
              break;
            }
          }
          
          if (targetTable) {
            for (const guest of clusterGuests) {
              if (!optionSeating.maleArrangement[targetTable.id]) {
                optionSeating.maleArrangement[targetTable.id] = [];
              }
              optionSeating.maleArrangement[targetTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: targetTable.name,
                  attendingCount: guest.maleCount,
                  gender: 'male'
                }
              });
            }
          } else {
            const allTables = [...(optionSeating.maleTables || []), ...(optionSeating.femaleTables || [])];
            const highestTableNumber = allTables.reduce((max, table) => {
              const match = table.name.match(/\d+/);
              if (match) {
                const num = parseInt(match[0]);
                return num > max ? num : max;
              }
              return max;
            }, 0);
           
            const tableNumber = highestTableNumber + 1;
            const newCapacity = Math.max(10, Math.ceil(totalClusterSize / 10) * 10);
           
            const newPosition = calculateNextTablePosition(optionSeating.maleTables, 'male');
                 
            const newTable = {
              id: `male_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: `שולחן ${tableNumber}`,
              capacity: Math.min(newCapacity, 12),
              type: newCapacity > 12 ? 'rectangular' : 'round',
              position: newPosition,
              size: newCapacity > 12 ? { width: 160, height: 100 } : { width: 120, height: 120 },
              rotation: 0,
              gender: 'male',
              autoCreated: true,
              createdForSync: true
            };
           
            optionSeating.maleTables.push(newTable);
            optionSeating.maleArrangement[newTable.id] = [];
            
            for (const guest of clusterGuests) {
              optionSeating.maleArrangement[newTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: newTable.name,
                  attendingCount: guest.maleCount,
                  gender: 'male'
                }
              });
            }
           
            actions.push({
              action: 'table_created',
              details: {
                tableName: newTable.name,
                capacity: newTable.capacity,
                gender: 'male'
              }
            });
            
          }
        }

        const femaleGuestClusters = groupMaleGuestsForMixing(femaleAffectedGuests);

        for (const [clusterId, clusterGuests] of femaleGuestClusters) {
          
          const totalClusterSize = clusterGuests.reduce((sum, g) => sum + (g.femaleCount || 0), 0);
          
          let targetTable = null;
          
          for (const table of optionSeating.femaleTables) {
            const currentGuestIds = optionSeating.femaleArrangement[table.id] || [];
            const currentOccupancy = currentGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (g?.femaleCount || 0);
            }, 0);
            
            const availableSpace = table.capacity - currentOccupancy;
            if (availableSpace < totalClusterSize) continue;
            
            if (currentGuestIds.length === 0) {
              targetTable = table;
              break;
            }
            
            const tableGuests = currentGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId.toString())
            ).filter(Boolean);
            
            let allCanMix = true;
            for (const clusterGuest of clusterGuests) {
              const clusterGroup = clusterGuest.customGroup || clusterGuest.group;
              for (const tableGuest of tableGuests) {
                const tableGroup = tableGuest.customGroup || tableGuest.group;
                if (!canGroupsMix(clusterGroup, tableGroup)) {
                  allCanMix = false;
                  break;
                }
              }
              if (!allCanMix) break;
            }
            
            if (allCanMix) {
              targetTable = table;
              break;
            }
          }
          
          if (targetTable) {
            for (const guest of clusterGuests) {
              if (!optionSeating.femaleArrangement[targetTable.id]) {
                optionSeating.femaleArrangement[targetTable.id] = [];
              }
              optionSeating.femaleArrangement[targetTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: targetTable.name,
                  attendingCount: guest.femaleCount,
                  gender: 'female'
                }
              });
            }
          } else {
            const allTables = [...(optionSeating.maleTables || []), ...(optionSeating.femaleTables || [])];
            const highestTableNumber = allTables.reduce((max, table) => {
              const match = table.name.match(/\d+/);
              if (match) {
                const num = parseInt(match[0]);
                return num > max ? num : max;
              }
              return max;
            }, 0);
           
            const tableNumber = highestTableNumber + 1;
            const newCapacity = Math.max(10, Math.ceil(totalClusterSize / 10) * 10);
           
            const newPosition = calculateNextTablePosition(optionSeating.femaleTables, 'female');
            
            const newTable = {
              id: `female_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: `שולחן ${tableNumber}`,
              capacity: Math.min(newCapacity, 12),
              type: newCapacity > 12 ? 'rectangular' : 'round',
              position: newPosition,
              size: newCapacity > 12 ? { width: 160, height: 100 } : { width: 120, height: 120 },
              rotation: 0,
              gender: 'female',
              autoCreated: true,
              createdForSync: true
            };
           
            optionSeating.femaleTables.push(newTable);
            optionSeating.femaleArrangement[newTable.id] = [];
            
            for (const guest of clusterGuests) {
              optionSeating.femaleArrangement[newTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: newTable.name,
                  attendingCount: guest.femaleCount,
                  gender: 'female'
                }
              });
            }
           
            actions.push({
              action: 'table_created',
              details: {
                tableName: newTable.name,
                capacity: newTable.capacity,
                gender: 'female'
              }
            });
            
          }
        }

        const maleGuests = allGuestsToSeat.filter(g => g.maleCount && g.maleCount > 0);
        const femaleGuests = allGuestsToSeat.filter(g => g.femaleCount && g.femaleCount > 0);
       
        maleGuests.forEach(g => {
          g.attendingCount = g.maleCount;
        });
       
        femaleGuests.forEach(g => {
          g.attendingCount = g.femaleCount;
        });
       
        optionSeating.maleTables = updateTableNamesWithGroupsInSync(
          optionSeating.maleTables,
          optionSeating.maleArrangement,
          maleGuests,
          req
        );
       
        optionSeating.femaleTables = updateTableNamesWithGroupsInSync(
          optionSeating.femaleTables,
          optionSeating.femaleArrangement,
          femaleGuests,
          req
        );
             
      } else {
        const affectedGuestIds = new Set();
        triggers.forEach(trigger => {
          const { changeData } = trigger;
          let guestId = changeData.guestId || (changeData.guest && changeData.guest._id?.toString());
          if (guestId) affectedGuestIds.add(guestId);
        });

        affectedGuestIds.forEach(guestId => {
          Object.keys(optionSeating.arrangement || {}).forEach(tableId => {
            const guestIds = optionSeating.arrangement[tableId] || [];
            const filteredIds = guestIds.filter(id => id.toString() !== guestId);
            if (filteredIds.length !== guestIds.length) {
              optionSeating.arrangement[tableId] = filteredIds;
              if (filteredIds.length === 0) {
                delete optionSeating.arrangement[tableId];
              }
            }
          });
        });

        const affectedGuests = allGuestsToSeat.filter(g => affectedGuestIds.has(g._id.toString()));
        
        const groupGuestsForMixing = (guestsToGroup) => {
          const grouped = new Map();
          let clusterId = 0;

          for (const guest of guestsToGroup) {
            const guestGroup = guest.customGroup || guest.group;
            const guestPolicy = groupPolicies[guestGroup];

            if (guestPolicy === 'S') {
              const newClusterId = `separate_${clusterId++}`;
              grouped.set(newClusterId, [guest]);
              continue;
            }

            let foundCluster = null;
            for (const [cId, clusterGuests] of grouped) {
              if (cId.startsWith('separate_')) continue;

              const clusterGroup = clusterGuests[0].customGroup || clusterGuests[0].group;
              if (canGroupsMix(guestGroup, clusterGroup)) {
                foundCluster = cId;
                break;
              }
            }

            if (foundCluster) {
              grouped.get(foundCluster).push(guest);
            } else {
              const newClusterId = `cluster_${clusterId++}`;
              grouped.set(newClusterId, [guest]);
            }
          }

          return grouped;
        };

        const guestClusters = groupGuestsForMixing(affectedGuests);

        for (const [clusterId, clusterGuests] of guestClusters) {
          
          const totalClusterSize = clusterGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          
          let targetTable = null;
          
          const sortedTables = [...optionSeating.tables].sort((a, b) => {
            const aGuestIds = optionSeating.arrangement[a.id] || [];
            const bGuestIds = optionSeating.arrangement[b.id] || [];
            
            const firstGuestGroup = clusterGuests[0].customGroup || clusterGuests[0].group;
            
            const aHasSameGroup = aGuestIds.some(gId => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return g && (g.customGroup || g.group) === firstGuestGroup;
            });
            
            const bHasSameGroup = bGuestIds.some(gId => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return g && (g.customGroup || g.group) === firstGuestGroup;
            });
            
            if (aHasSameGroup && !bHasSameGroup) return -1;
            if (!aHasSameGroup && bHasSameGroup) return 1;
            
            const aOccupancy = aGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (g?.attendingCount || 1);
            }, 0);
            
            const bOccupancy = bGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (g?.attendingCount || 1);
            }, 0);
            
            return bOccupancy - aOccupancy;
          });
          
          for (const table of sortedTables) {
            const currentGuestIds = optionSeating.arrangement[table.id] || [];
            const currentOccupancy = currentGuestIds.reduce((sum, gId) => {
              const g = guests.find(guest => guest._id.toString() === gId.toString());
              return sum + (g?.attendingCount || 1);
            }, 0);
            
            const availableSpace = table.capacity - currentOccupancy;
            if (availableSpace < totalClusterSize) continue;
            
            if (currentGuestIds.length === 0) {
              targetTable = table;
              break;
            }
            
            const tableGuests = currentGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId.toString())
            ).filter(Boolean);
            
            let allCanMix = true;
            for (const clusterGuest of clusterGuests) {
              const clusterGroup = clusterGuest.customGroup || clusterGuest.group;
              for (const tableGuest of tableGuests) {
                const tableGroup = tableGuest.customGroup || tableGuest.group;
                if (!canGroupsMix(clusterGroup, tableGroup)) {
                  allCanMix = false;
                  break;
                }
              }
              if (!allCanMix) break;
            }
            
            if (allCanMix) {
              targetTable = table;
              break;
            }
          }
          
          if (targetTable) {
            for (const guest of clusterGuests) {
              if (!optionSeating.arrangement[targetTable.id]) {
                optionSeating.arrangement[targetTable.id] = [];
              }
              optionSeating.arrangement[targetTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: targetTable.name,
                  attendingCount: guest.attendingCount || 1
                }
              });
            }
          } else {
            const highestTableNumber = optionSeating.tables.reduce((max, table) => {
              const match = table.name.match(/\d+/);
              return match ? Math.max(max, parseInt(match[0])) : max;
            }, 0);
            
            const tableNumber = highestTableNumber + 1;
            const newCapacity = Math.max(10, Math.min(12, Math.ceil(totalClusterSize / 10) * 10));
            const newPosition = calculateNextTablePosition(optionSeating.tables, null);
                        
            const newTable = {
              id: `optimal_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: `שולחן ${tableNumber}`,
              capacity: newCapacity,
              type: newCapacity > 12 ? 'rectangular' : 'round',
              position: newPosition,
              size: newCapacity > 12 ? { width: 160, height: 100 } : { width: 120, height: 120 },
              rotation: 0,
              autoCreated: true,
              createdForSync: true
            };
            
            optionSeating.tables.push(newTable);
            optionSeating.arrangement[newTable.id] = [];
            
            for (const guest of clusterGuests) {
              optionSeating.arrangement[newTable.id].push(guest._id.toString());
              
              actions.push({
                action: 'guest_seated',
                details: {
                  guestName: `${guest.firstName} ${guest.lastName}`,
                  tableName: newTable.name,
                  attendingCount: guest.attendingCount || 1
                }
              });
            }
            
            actions.push({
              action: 'table_created',
              details: {
                tableName: newTable.name,
                capacity: newTable.capacity
              }
            });
            
          }
        }
        
        const optimized = optimizeArrangementSimulation(optionSeating, guests);
        if (optimized.wasOptimized) {
          actions.push(...optimized.actions);
        }
      }
     
      const rulesApplied = [];
      let hasExplicitRules = false;
     
      if (userPreferences.seatingRules?.mustSitTogether?.length > 0) {
        hasExplicitRules = true;
        rulesApplied.push(req.t('seating.sync.mustSitTogetherApplied', {
          count: userPreferences.seatingRules.mustSitTogether.length
        }));
      }
     
      if (userPreferences.seatingRules?.cannotSitTogether?.length > 0) {
        hasExplicitRules = true;
        rulesApplied.push(req.t('seating.sync.cannotSitTogetherApplied', {
          count: userPreferences.seatingRules.cannotSitTogether.length
        }));
      }
     
      if (userPreferences.allowGroupMixing === true) {
        hasExplicitRules = true;
        if (userPreferences.groupMixingRules?.length > 0 ||
            (userPreferences.groupPolicies && Object.keys(userPreferences.groupPolicies).length > 0)) {
          rulesApplied.push(req.t('seating.sync.groupMixingRulesApplied', {
            count: userPreferences.groupMixingRules?.length || 0
          }));
         
          const separateGroupsCount = Object.values(userPreferences.groupPolicies || {})
            .filter(policy => policy === 'S').length;
          if (separateGroupsCount > 0) {
            rulesApplied.push(req.t('seating.sync.separateGroupsApplied', {
              count: separateGroupsCount
            }));
          }
        } else {
          rulesApplied.push(req.t('seating.sync.groupMixingEnabled'));
        }
      } else if (userPreferences.allowGroupMixing === false) {
        hasExplicitRules = true;
        rulesApplied.push(req.t('seating.sync.noGroupMixingApplied'));
      }
    }

    if (isSeparated) {
      const affectedGenders = getAffectedGendersFromTriggers(triggers);
     
      if (affectedGenders.has('male')) {
        optionSeating.maleTables = updateTableNamesWithGroupsInSync(
          optionSeating.maleTables,
          optionSeating.maleArrangement,
          guests.filter(g => g.maleCount && g.maleCount > 0),
          req
        );
      }
     
      if (affectedGenders.has('female')) {
        optionSeating.femaleTables = updateTableNamesWithGroupsInSync(
          optionSeating.femaleTables,
          optionSeating.femaleArrangement,
          guests.filter(g => g.femaleCount && g.femaleCount > 0),
          req
        );
      }
    } else {
      optionSeating.tables = updateTableNamesWithGroupsInSync(
        optionSeating.tables,
        optionSeating.arrangement,
        guests,
        req
      );
    }

    description = generateOptionDescription(actions, strategy, req);

    const result = {
      id: `${strategy}_${Date.now()}`,
      strategy,
      description,
      actions,
      stats: isSeparated
        ? calculateArrangementStatsSeparated(optionSeating, guests)
        : calculateArrangementStats(optionSeating, guests)
    };

    if (isSeparated) {
      result.maleTables = optionSeating.maleTables;
      result.femaleTables = optionSeating.femaleTables;
      result.maleArrangement = optionSeating.maleArrangement;
      result.femaleArrangement = optionSeating.femaleArrangement;
      result.isSeparatedSeating = true;
    } else {
      result.tables = optionSeating.tables;
      result.arrangement = optionSeating.arrangement;
      result.isSeparatedSeating = false;
    }

    return result;

  } catch (error) {
    const errorResult = {
      id: `${strategy}_error`,
      strategy,
      description: req.t('seating.sync.optionGenerationError'),
      actions: [],
      error: error.message,
      isSeparatedSeating: isSeparated
    };

    if (isSeparated) {
      errorResult.maleTables = seating.maleTables;
      errorResult.femaleTables = seating.femaleTables;
      errorResult.maleArrangement = seating.maleArrangement;
      errorResult.femaleArrangement = seating.femaleArrangement;
    } else {
      errorResult.tables = seating.tables;
      errorResult.arrangement = seating.arrangement;
    }

    return errorResult;
  }
};

const getAffectedGendersFromTriggers = (triggers) => {
  const affectedGenders = new Set();
 
  for (const trigger of triggers) {
    const { changeType, changeData } = trigger;
   
    if (changeType === 'guest_added' || changeType === 'rsvp_updated') {
      if (changeData.changedGenders && changeData.changedGenders.length > 0) {
        changeData.changedGenders.forEach(gender => affectedGenders.add(gender));
      } else if (changeData.type === 'attending_count_increased') {
        const { oldMaleCount, newMaleCount, oldFemaleCount, newFemaleCount } = changeData;
        if (oldMaleCount !== newMaleCount) {
          affectedGenders.add('male');
        }
        if (oldFemaleCount !== newFemaleCount) {
          affectedGenders.add('female');
        }
      } else if (changeData.guest) {
        if (changeData.guest.maleCount > 0) affectedGenders.add('male');
        if (changeData.guest.femaleCount > 0) affectedGenders.add('female');
      }
    } else if (changeType === 'guest_deleted') {
      if (changeData.guest) {
        if (changeData.guest.maleCount > 0) affectedGenders.add('male');
        if (changeData.guest.femaleCount > 0) affectedGenders.add('female');
      }
    }
  }
 
  return affectedGenders;
};

const calculateArrangementStatsSeparated = (optionSeating, guests) => {
  const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
  const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
 
  const maleStats = {
    totalTables: optionSeating.maleTables.length,
    totalCapacity: optionSeating.maleTables.reduce((sum, table) => sum + table.capacity, 0),
    occupiedTables: 0,
    seatedPeople: 0,
    utilizationRate: 0
  };
 
  const femaleStats = {
    totalTables: optionSeating.femaleTables.length,
    totalCapacity: optionSeating.femaleTables.reduce((sum, table) => sum + table.capacity, 0),
    occupiedTables: 0,
    seatedPeople: 0,
    utilizationRate: 0
  };

  Object.keys(optionSeating.maleArrangement).forEach(tableId => {
    const guestIds = optionSeating.maleArrangement[tableId] || [];
    if (guestIds.length > 0) {
      maleStats.occupiedTables++;
      maleStats.seatedPeople += guestIds.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.maleCount || 0);
      }, 0);
    }
  });

  Object.keys(optionSeating.femaleArrangement).forEach(tableId => {
    const guestIds = optionSeating.femaleArrangement[tableId] || [];
    if (guestIds.length > 0) {
      femaleStats.occupiedTables++;
      femaleStats.seatedPeople += guestIds.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.femaleCount || 0);
      }, 0);
    }
  });

  if (maleStats.totalCapacity > 0) {
    maleStats.utilizationRate = Math.round((maleStats.seatedPeople / maleStats.totalCapacity) * 100);
  }

  if (femaleStats.totalCapacity > 0) {
    femaleStats.utilizationRate = Math.round((femaleStats.seatedPeople / femaleStats.totalCapacity) * 100);
  }

  return {
    totalTables: maleStats.totalTables + femaleStats.totalTables,
    totalCapacity: maleStats.totalCapacity + femaleStats.totalCapacity,
    occupiedTables: maleStats.occupiedTables + femaleStats.occupiedTables,
    seatedPeople: maleStats.seatedPeople + femaleStats.seatedPeople,
    utilizationRate: Math.round(((maleStats.seatedPeople + femaleStats.seatedPeople) / (maleStats.totalCapacity + femaleStats.totalCapacity)) * 100),
    maleStats,
    femaleStats
  };
};

const simulateSyncTrigger = async (optionSeating, trigger, guests, req, strategy) => {
  const { changeType, changeData } = trigger;
  const actions = [];
  let success = true;

  try {
    switch (changeType) {
      case 'guest_added':
      case 'rsvp_updated':
        if (changeData.type === 'status_became_confirmed') {
          const result = await simulateSeatNewGuest(optionSeating, changeData.guest, guests, req, strategy);
          actions.push(...result.actions);
        } else if (changeData.type === 'status_no_longer_confirmed') {
          const result = await simulateUnseatGuest(optionSeating, changeData.guestId, guests, req);
          actions.push(...result.actions);
        } else if (changeData.type === 'attending_count_increased') {
          const result = await simulateAttendingCountChange(optionSeating, changeData, guests, req, strategy);
          actions.push(...result.actions);
        }
        break;

      case 'guest_deleted':
        const deleteResult = await simulateUnseatGuest(optionSeating, changeData.guestId, guests, req);
        actions.push(...deleteResult.actions);
        break;

      default:
        success = false;
    }
  } catch (error) {
    success = false;
    return {
      success: false,
      actions: [],
      errorMessage: error.message
    };
  }

   return {
    success,
    actions
  };
};

const simulateSeatNewGuest = async (optionSeating, guest, allGuests, req, strategy) => {
  const actions = [];
  const isSeparated = optionSeating.isSeparatedSeating || false;

  if (isSeparated) {
    const hasMales = guest.maleCount && guest.maleCount > 0;
    const hasFemales = guest.femaleCount && guest.femaleCount > 0;
   
    if (!hasMales && !hasFemales) {
      return { actions: [] };
    }
   
    if (hasMales) {
      const maleGuestSize = guest.maleCount;
      const maleTables = optionSeating.maleTables;
      const maleArrangement = optionSeating.maleArrangement;
      const maleGuests = allGuests.filter(g => g.maleCount && g.maleCount > 0);

      let availableMaleTable = findAvailableTableSimulation(
        {
          tables: maleTables,
          arrangement: maleArrangement,
          preferences: optionSeating.preferences || {},
          isSeparatedSeating: true,
          maleTables: maleTables,
          femaleTables: [],
          maleArrangement: maleArrangement,
          femaleArrangement: {}
        },
        maleGuestSize,
        maleGuests,
        {...guest, gender: 'male'}
      );
     
      if (!availableMaleTable) {
        const tableSize = determineOptimalTableSize(maleTables, maleGuestSize, strategy);
        
        const allTables = [...(optionSeating.maleTables || []), ...(optionSeating.femaleTables || [])];
        const highestTableNumber = allTables.reduce((max, table) => {
          const match = table.name.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            return num > max ? num : max;
          }
          return max;
        }, 0);
       
        const tableNumber = highestTableNumber + 1;
        availableMaleTable = createTableSimulation(optionSeating, tableSize, tableNumber, req, 'male');
       
        optionSeating.maleTables.push(availableMaleTable);
       
        actions.push({
          action: 'table_created',
          details: {
            tableName: availableMaleTable.name,
            capacity: availableMaleTable.capacity,
            gender: 'male',
            reason: req.t('seating.sync.createdForGuest', {
              guestName: `${guest.firstName} ${guest.lastName}`
            })
          }
        });
      }
     
      if (!maleArrangement[availableMaleTable.id]) {
        maleArrangement[availableMaleTable.id] = [];
      }
     
      if (!maleArrangement[availableMaleTable.id].includes(guest._id.toString())) {
        maleArrangement[availableMaleTable.id].push(guest._id.toString());
       
        actions.push({
          action: 'guest_seated',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            tableName: availableMaleTable.name,
            gender: 'male',
            attendingCount: maleGuestSize
          }
        });
      }
     
      optionSeating.maleArrangement = maleArrangement;
    }
   
    if (hasFemales) {
      const femaleGuestSize = guest.femaleCount;
      const femaleTables = optionSeating.femaleTables;
      const femaleArrangement = optionSeating.femaleArrangement;
      const femaleGuests = allGuests.filter(g => g.femaleCount && g.femaleCount > 0);
     
      let availableFemaleTable = findAvailableTableSimulation(
        {
          tables: femaleTables,
          arrangement: femaleArrangement,
          preferences: optionSeating.preferences || {},
          isSeparatedSeating: true,
          maleTables: [],
          femaleTables: femaleTables,
          maleArrangement: {},
          femaleArrangement: femaleArrangement
        },
        femaleGuestSize,
        femaleGuests,
        {...guest, gender: 'female'}
      );
     
      if (!availableFemaleTable) {
        const tableSize = determineOptimalTableSize(femaleTables, femaleGuestSize, strategy);
        
        const allTables = [...(optionSeating.maleTables || []), ...(optionSeating.femaleTables || [])];
        const highestTableNumber = allTables.reduce((max, table) => {
          const match = table.name.match(/\d+/);
          if (match) {
            const num = parseInt(match[0]);
            return num > max ? num : max;
          }
          return max;
        }, 0);
       
        const tableNumber = highestTableNumber + 1;
        availableFemaleTable = createTableSimulation(optionSeating, tableSize, tableNumber, req, 'female');
       
        optionSeating.femaleTables.push(availableFemaleTable);
       
        actions.push({
          action: 'table_created',
          details: {
            tableName: availableFemaleTable.name,
            capacity: availableFemaleTable.capacity,
            gender: 'female',
            reason: req.t('seating.sync.createdForGuest', {
              guestName: `${guest.firstName} ${guest.lastName}`
            })
          }
        });
      }
     
      if (!femaleArrangement[availableFemaleTable.id]) {
        femaleArrangement[availableFemaleTable.id] = [];
      }
     
      if (!femaleArrangement[availableFemaleTable.id].includes(guest._id.toString())) {
        femaleArrangement[availableFemaleTable.id].push(guest._id.toString());
       
        actions.push({
          action: 'guest_seated',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            tableName: availableFemaleTable.name,
            gender: 'female',
            attendingCount: femaleGuestSize
          }
        });
      }
     
      optionSeating.femaleArrangement = femaleArrangement;
    }
   
  } else {
    const guestSize = guest.attendingCount || 1;
    let availableTable = findAvailableTableSimulation(optionSeating, guestSize, allGuests, guest);
   
    if (!availableTable) {
      const tableSize = determineOptimalTableSize(optionSeating.tables, guestSize, strategy);
      const tableNumber = optionSeating.tables.length + 1;
     
      availableTable = createTableSimulation(optionSeating, tableSize, tableNumber, req);
     
      actions.push({
        action: 'table_created',
        details: {
          tableName: availableTable.name,
          capacity: availableTable.capacity,
          reason: req.t('seating.sync.createdForGuest', {
            guestName: `${guest.firstName} ${guest.lastName}`
          })
        }
      });
    }
   
    if (!optionSeating.arrangement[availableTable.id]) {
      optionSeating.arrangement[availableTable.id] = [];
    }
   
    if (!optionSeating.arrangement[availableTable.id].includes(guest._id.toString())) {
      optionSeating.arrangement[availableTable.id].push(guest._id.toString());
     
      actions.push({
        action: 'guest_seated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: availableTable.name,
          attendingCount: guestSize
        }
      });
    }
  }
 
  return { actions };
};

const simulateUnseatGuest = async (optionSeating, guestId, allGuests, req) => {
  const actions = [];
  let guestName = req.t('seating.unknownGuest');
  const isSeparated = optionSeating.isSeparatedSeating || false;
 
  const guest = allGuests.find(g => g._id.toString() === guestId) ||
               allGuests.find(g => g._id === guestId);
  if (guest) {
    guestName = `${guest.firstName} ${guest.lastName}`;
  }
 
  let wasSeated = false;
 
  if (isSeparated && guest) {
    const guestGender = guest.gender;
    const currentArrangement = guestGender === 'male' ? optionSeating.maleArrangement : optionSeating.femaleArrangement;
    const currentTables = guestGender === 'male' ? optionSeating.maleTables : optionSeating.femaleTables;
   
    Object.keys(currentArrangement).forEach(tableId => {
      const guestIndex = currentArrangement[tableId].indexOf(guestId);
      if (guestIndex !== -1) {
        currentArrangement[tableId].splice(guestIndex, 1);
        if (currentArrangement[tableId].length === 0) {
          delete currentArrangement[tableId];
        }
       
        const table = currentTables.find(t => t.id === tableId);
        actions.push({
          action: 'guest_removed',
          details: {
            guestName,
            tableName: table?.name || req.t('seating.unknownTable'),
            gender: guestGender
          }
        });
        wasSeated = true;
      }
    });
   
    if (guestGender === 'male') {
      optionSeating.maleArrangement = currentArrangement;
    } else {
      optionSeating.femaleArrangement = currentArrangement;
    }
  } else {
    Object.keys(optionSeating.arrangement).forEach(tableId => {
      const guestIndex = optionSeating.arrangement[tableId].indexOf(guestId);
      if (guestIndex !== -1) {
        optionSeating.arrangement[tableId].splice(guestIndex, 1);
        if (optionSeating.arrangement[tableId].length === 0) {
          delete optionSeating.arrangement[tableId];
        }
       
        const table = optionSeating.tables.find(t => t.id === tableId);
        actions.push({
          action: 'guest_removed',
          details: {
            guestName,
            tableName: table?.name || req.t('seating.unknownTable')
          }
        });
        wasSeated = true;
      }
    });
  }
 
  return { actions };
};

const simulateAttendingCountChange = async (optionSeating, changeData, allGuests, req, strategy) => {
  const { guestId, guest, oldCount, newCount, oldMaleCount, newMaleCount, oldFemaleCount, newFemaleCount } = changeData;
  const actions = [];
  const isSeparated = optionSeating.isSeparatedSeating || false;
 
  if (!isSeparated) {
    let guestTableId = null;
    Object.keys(optionSeating.arrangement || {}).forEach(tableId => {
      if ((optionSeating.arrangement[tableId] || []).includes(guestId)) {
        guestTableId = tableId;
      }
    });

    if (!guestTableId) {
      return await simulateSeatNewGuest(optionSeating, guest, allGuests, req, strategy);
    }

    const currentTable = optionSeating.tables.find(t => t.id === guestTableId);
    if (!currentTable) {
      return { actions: [] };
    }

    const tableGuests = optionSeating.arrangement[guestTableId] || [];
    const otherGuestsSize = tableGuests
      .filter(id => id !== guestId)
      .reduce((sum, gId) => {
        const g = allGuests.find(guest => guest._id.toString() === gId);
        return sum + (g?.attendingCount || 1);
      }, 0);

    const newTotalSize = otherGuestsSize + newCount;

    if (newTotalSize <= currentTable.capacity) {
      actions.push({
        action: 'guest_updated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: currentTable.name,
          oldCount,
          newCount,
          reason: req.t('seating.sync.stayedAtTable')
        }
      });
    } else {
      const guestIndex = optionSeating.arrangement[guestTableId].indexOf(guestId);
      if (guestIndex !== -1) {
        optionSeating.arrangement[guestTableId].splice(guestIndex, 1);
        if (optionSeating.arrangement[guestTableId].length === 0) {
          delete optionSeating.arrangement[guestTableId];
        }
      }

      let newTable = findAvailableTableSimulation(optionSeating, newCount, allGuests, guest);

      if (!newTable) {
        const tableSize = determineOptimalTableSize(optionSeating.tables, newCount, strategy);
        const tableNumber = optionSeating.tables.length + 1;
       
        newTable = createTableSimulation(optionSeating, tableSize, tableNumber, req);
       
        actions.push({
          action: 'table_created',
          details: {
            tableName: newTable.name,
            capacity: newTable.capacity,
            reason: req.t('seating.sync.createdForResize')
          }
        });
      }

      if (!optionSeating.arrangement[newTable.id]) {
        optionSeating.arrangement[newTable.id] = [];
      }
      optionSeating.arrangement[newTable.id].push(guestId);

      actions.push({
        action: 'guest_moved',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          fromTable: currentTable.name,
          toTable: newTable.name,
          oldCount,
          newCount,
          reason: req.t('seating.sync.movedForResize')
        }
      });
    }

    return { actions };
  }

  const gendersToProcess = [];
  if (oldMaleCount !== newMaleCount) {
    gendersToProcess.push('male');
  }
  if (oldFemaleCount !== newFemaleCount) {
    gendersToProcess.push('female');
  }

  for (const genderToProcess of gendersToProcess) {
    const currentTables = genderToProcess === 'male' ? optionSeating.maleTables : optionSeating.femaleTables;
    const currentArrangement = genderToProcess === 'male' ? optionSeating.maleArrangement : optionSeating.femaleArrangement;
    const genderGuests = allGuests.filter(g => {
      if (genderToProcess === 'male') {
        return g.maleCount && g.maleCount > 0;
      } else {
        return g.femaleCount && g.femaleCount > 0;
      }
    });

    let guestTableId = null;
    Object.keys(currentArrangement || {}).forEach(tableId => {
      if ((currentArrangement[tableId] || []).includes(guestId)) {
        guestTableId = tableId;
      }
    });

    const oldCount = genderToProcess === 'male' ? oldMaleCount : oldFemaleCount;
    const newCount = genderToProcess === 'male' ? newMaleCount : newFemaleCount;

    if (!guestTableId) {
      if (newCount > 0) {
        const guestForSeating = {
          ...guest,
          gender: genderToProcess,
          attendingCount: newCount
        };
        const result = await simulateSeatNewGuest(
          { ...optionSeating, isSeparatedSeating: true },
          guestForSeating,
          genderGuests,
          req,
          strategy
        );
        actions.push(...result.actions);

        if (genderToProcess === 'male') {
          optionSeating.maleArrangement = result.maleArrangement || optionSeating.maleArrangement;
        } else {
          optionSeating.femaleArrangement = result.femaleArrangement || optionSeating.femaleArrangement;
        }
      }
      continue;
    }

    const currentTable = currentTables.find(t => t.id === guestTableId);
    if (!currentTable) {
      continue;
    }

    const tableGuests = currentArrangement[guestTableId] || [];
    const otherGuestsSize = tableGuests
      .filter(id => id !== guestId)
      .reduce((sum, gId) => {
        const g = genderGuests.find(guest => guest._id.toString() === gId);
        const genderCount = genderToProcess === 'male' ? (g?.maleCount || 0) : (g?.femaleCount || 0);
        return sum + genderCount;
      }, 0);

    const newTotalSize = otherGuestsSize + newCount;

    if (newTotalSize <= currentTable.capacity && newCount > 0) {
      actions.push({
        action: 'guest_updated',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: currentTable.name,
          gender: genderToProcess,
          oldCount,
          newCount,
          reason: req.t('seating.sync.stayedAtTable')
        }
      });
      continue;
    }

    const guestIndex = currentArrangement[guestTableId].indexOf(guestId);
    if (guestIndex !== -1) {
      currentArrangement[guestTableId].splice(guestIndex, 1);
      if (currentArrangement[guestTableId].length === 0) {
        delete currentArrangement[guestTableId];
      }
    }

    if (newCount === 0) {
      actions.push({
        action: 'guest_removed',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          tableName: currentTable.name,
          gender: genderToProcess,
          reason: req.t('seating.sync.countBecameZero')
        }
      });
      continue;
    }

    let newTable = findAvailableTableSimulation(
    {
      tables: currentTables,
      arrangement: currentArrangement,
      preferences: optionSeating.preferences || {},
      isSeparatedSeating: true,
      maleTables: genderToProcess === 'male' ? currentTables : [],
      femaleTables: genderToProcess === 'female' ? currentTables : [],
      maleArrangement: genderToProcess === 'male' ? currentArrangement : {},
      femaleArrangement: genderToProcess === 'female' ? currentArrangement : {}
    },
    newCount,
    genderGuests,
    { ...guest, gender: genderToProcess }
  );
   
    if (!newTable) {
      const optimalCapacity = determineOptimalTableSize(currentTables, newCount, strategy);
      
      const allTables = [...(optionSeating.maleTables || []), ...(optionSeating.femaleTables || [])];
      const highestTableNumber = allTables.reduce((max, table) => {
        const match = table.name.match(/\d+/);
        if (match) {
          const num = parseInt(match[0]);
          return num > max ? num : max;
        }
        return max;
      }, 0);
     
      const tableNumber = highestTableNumber + 1;
     
      newTable = createTableSimulation(optionSeating, optimalCapacity, tableNumber, req, genderToProcess);
     
      if (genderToProcess === 'male') {
        optionSeating.maleTables.push(newTable);
      } else {
        optionSeating.femaleTables.push(newTable);
      }
     
      actions.push({
        action: 'table_created',
        details: {
          tableName: newTable.name,
          capacity: newTable.capacity,
          gender: genderToProcess,
          reason: req.t('seating.sync.createdForResize')
        }
      });
    }

    if (!currentArrangement[newTable.id]) {
      currentArrangement[newTable.id] = [];
    }
   
    if (!currentArrangement[newTable.id].includes(guestId)) {
      currentArrangement[newTable.id].push(guestId);
     
      actions.push({
        action: 'guest_moved',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          fromTable: currentTable.name,
          toTable: newTable.name,
          gender: genderToProcess,
          oldCount,
          newCount,
          reason: req.t('seating.sync.movedForResize')
        }
      });
    }
  }
 
  if (gendersToProcess.includes('male')) {
    optionSeating.maleArrangement = optionSeating.maleArrangement;
  }
  if (gendersToProcess.includes('female')) {
    optionSeating.femaleArrangement = optionSeating.femaleArrangement;
  }

  return { actions };
};

const findAvailableTableSimulation = (optionSeating, guestSize, allGuests, guestToAdd) => {
  const isSeparated = optionSeating.isSeparatedSeating || false;
  const tables = isSeparated ? (optionSeating.tables || []) : (optionSeating.tables || []);
  const arrangement = isSeparated ? (optionSeating.arrangement || {}) : (optionSeating.arrangement || {});
  const preferences = optionSeating.preferences || {};

  const guestGroup = guestToAdd ? (guestToAdd.customGroup || guestToAdd.group) : null;
  const guestGender = guestToAdd?.gender;
 
  if (isSeparated && guestGender) {
    const genderTables = guestGender === 'male' ? (optionSeating.maleTables || []) : (optionSeating.femaleTables || []);
    const genderArrangement = guestGender === 'male' ? (optionSeating.maleArrangement || {}) : (optionSeating.femaleArrangement || {});
   
    const genderCount = guestGender === 'male' ? (guestToAdd.maleCount || 0) : (guestToAdd.femaleCount || 0);
   
    return genderTables.find(table => {
      const tableGuests = genderArrangement[table.id] || [];
     
      const currentOccupancy = tableGuests.reduce((sum, guestId) => {
        const g = allGuests.find(g => g._id && g._id.toString() === guestId);
        if (!g) return sum;
        const count = guestGender === 'male' ? (g.maleCount || 0) : (g.femaleCount || 0);
        return sum + count;
      }, 0);
     
      const remainingCapacity = table.capacity - currentOccupancy;
      if (remainingCapacity < genderCount) {
        return false;
      }
     
      if (tableGuests.length === 0) {
        return true;
      }

      if (guestGroup) {
        const canMixWithTable = tableGuests.every(guestId => {
          const g = allGuests.find(g => g._id && g._id.toString() === guestId);
          if (!g) {
            return true;
          }
          const tableGuestGroup = g.customGroup || g.group;

          if (tableGuestGroup === guestGroup) return true;

          const guestPolicy = preferences.groupPolicies?.[guestGroup];
          const tableGuestPolicy = preferences.groupPolicies?.[tableGuestGroup];

          if (guestPolicy === 'S' || tableGuestPolicy === 'S') {
            return false;
          }

          if (preferences.groupMixingRules && preferences.groupMixingRules.length > 0) {
            const hasAllowingRule = preferences.groupMixingRules.some(rule =>
              (rule.group1 === guestGroup && rule.group2 === tableGuestGroup && rule.allowMixing) ||
              (rule.group2 === guestGroup && rule.group1 === tableGuestGroup && rule.allowMixing)
            );
            if (hasAllowingRule) return true;
            return false;
          }

          if (guestPolicy === 'M' && tableGuestPolicy === 'M') {
            return true;
          }

          if (preferences.allowGroupMixing === false) {
            return false;
          }

          return true;
        });

        if (!canMixWithTable) {
          return false;
        }
      }

      return true;
    });
  }
 
  return tables.find(table => {
    const tableGuests = arrangement[table.id] || [];

    const currentOccupancy = tableGuests.reduce((sum, guestId) => {
      const g = allGuests.find(g => g._id && g._id.toString() === guestId);
      return sum + (g?.attendingCount || 1);
    }, 0);

    const remainingCapacity = table.capacity - currentOccupancy;
    if (remainingCapacity < guestSize) {
      return false;
    }

    if (tableGuests.length === 0) {
      return true;
    }

    if (guestGroup) {
      const canMixWithTable = tableGuests.every(guestId => {
        const g = allGuests.find(g => g._id && g._id.toString() === guestId);
        if (!g) {
          return true;
        }
        const tableGuestGroup = g.customGroup || g.group;

        if (tableGuestGroup === guestGroup) return true;

        const guestPolicy = preferences.groupPolicies?.[guestGroup];
        const tableGuestPolicy = preferences.groupPolicies?.[tableGuestGroup];

        if (guestPolicy === 'S' || tableGuestPolicy === 'S') {
          return false;
        }

        if (preferences.groupMixingRules && preferences.groupMixingRules.length > 0) {
          const hasAllowingRule = preferences.groupMixingRules.some(rule =>
            (rule.group1 === guestGroup && rule.group2 === tableGuestGroup && rule.allowMixing) ||
            (rule.group2 === guestGroup && rule.group1 === tableGuestGroup && rule.allowMixing)
          );
          if (hasAllowingRule) return true;
          return false;
        }

        if (guestPolicy === 'M' && tableGuestPolicy === 'M') {
          return true;
        }

        if (preferences.allowGroupMixing === false) {
          return false;
        }

        return true;
      });

      if (!canMixWithTable) {
        return false;
      }
    }

    return true;
  });
};

const determineOptimalTableSize = (existingTables, guestSize, strategy) => {
  const MAX_TABLE_CAPACITY = 24;

  if (existingTables.length === 0) {
    let size;
    if (guestSize <= 8) size = 8;
    else if (guestSize <= 10) size = 10;
    else if (guestSize <= 12) size = 12;
    else if (guestSize <= MAX_TABLE_CAPACITY) {
      size = Math.min(Math.ceil(guestSize / 12) * 12, MAX_TABLE_CAPACITY);
    } else {
      size = MAX_TABLE_CAPACITY;
    }
    return size;
  }

  const tableSizes = existingTables.map(t => t.capacity);
  const sizeCount = {};
  tableSizes.forEach(size => {
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });

  const mostCommonSize = parseInt(Object.keys(sizeCount)
    .reduce((a, b) => sizeCount[a] > sizeCount[b] ? a : b));

  if (strategy === 'conservative') {
    const sortedSizes = [...new Set(tableSizes)].sort((a, b) => a - b);
    const fitSize = sortedSizes.find(size => size >= guestSize);
    
    if (fitSize) {
      return fitSize;
    }
    
    const calculatedSize = Math.ceil(guestSize / 2) * 2;
    return Math.min(calculatedSize, MAX_TABLE_CAPACITY);
  } else {
    const sortedSizes = [...new Set(tableSizes)].sort((a, b) => a - b);
    const fitSize = sortedSizes.find(size => size >= guestSize);
    
    if (fitSize) {
      return fitSize;
    }
    
    let newSize;
    if (guestSize <= 8) newSize = 8;
    else if (guestSize <= 10) newSize = 10;
    else if (guestSize <= 12) newSize = 12;
    else newSize = Math.min(Math.ceil(guestSize / 2) * 2, MAX_TABLE_CAPACITY);
    
    return newSize;
  }
};

const createTableSimulation = (optionSeating, capacity, tableNumber, req, targetGender = null) => {
  if (!req || typeof req.t !== 'function') {
    throw new Error('Translation function (req.t) is required');
  }
 
  let tableName;
  try {
    tableName = req.t('seating.tableName', { number: tableNumber });
   
    if (!tableName || tableName === 'seating.tableName' || !tableName.includes(tableNumber.toString())) {
      const baseTableName = req.t('seating.tableName');
     
      if (baseTableName && baseTableName !== 'seating.tableName') {
        tableName = `${baseTableName} ${tableNumber}`;
      } else {
        tableName = `${req.t('seating.table')} ${tableNumber}`;
      }
    }
  } catch (error) {
    tableName = `${req.t('seating.table')} ${tableNumber}`;
  }
 
  let allExistingTables = [];
  const isSeparatedSeating = optionSeating.maleTables !== undefined && optionSeating.femaleTables !== undefined;
 
  if (isSeparatedSeating) {
    allExistingTables = [
      ...(optionSeating.tables || []),
      ...(optionSeating.maleTables || []),
      ...(optionSeating.femaleTables || [])
    ];
  } else if (optionSeating.tables) {
    allExistingTables = optionSeating.tables || [];
  } else {
    allExistingTables = [];
  }
 
  let tableType = 'round';
  let width = 120;
  let height = 120;
 
  if (allExistingTables.length > 0) {
    const typeCount = {};
    allExistingTables.forEach(table => {
      typeCount[table.type] = (typeCount[table.type] || 0) + 1;
    });
   
    const mostCommonType = Object.keys(typeCount)
      .reduce((a, b) => typeCount[a] > typeCount[b] ? a : b);
   
    if (mostCommonType === 'round' && capacity <= 12) {
      tableType = 'round';
      width = 120;
      height = 120;
    } else if (mostCommonType === 'rectangular') {
      tableType = 'rectangular';
      width = capacity > 12 ? 180 : 160;
      height = 100;
    } else {
      if (capacity <= 10) {
        tableType = 'round';
        width = 120;
        height = 120;
      } else {
        tableType = 'rectangular';
        width = capacity > 12 ? 180 : 160;
        height = 100;
      }
    }
  } else {
    if (capacity <= 10) {
      tableType = 'round';
      width = 120;
      height = 120;
    } else {
      tableType = 'rectangular';
      width = capacity > 12 ? 180 : 160;
      height = 100;
    }
  }

  let posX, posY;
 
  if (isSeparatedSeating && targetGender) {
    const relevantTables = targetGender === 'male'
      ? (optionSeating.maleTables || [])
      : (optionSeating.femaleTables || []);
    
    const newPosition = calculateNextTablePosition(relevantTables, targetGender);
    posX = newPosition.x;
    posY = newPosition.y;
    
  } else {
    
    const newPosition = calculateNextTablePosition(allExistingTables, null);
    posX = newPosition.x;
    posY = newPosition.y;
    
  }
 
  const newTable = {
    id: `sync_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: tableName,
    type: tableType,
    capacity: capacity,
    position: {
      x: posX,
      y: posY
    },
    rotation: 0,
    size: {
      width: width,
      height: height
    },
    autoCreated: true,
    createdForSync: true
  };

  if (!isSeparatedSeating && optionSeating.tables) {
    optionSeating.tables.push(newTable);
  }
 
  return newTable;
};

const updateTableNamesWithGroupsInSync = (tables, arrangement, guests, req) => {
  return tables.map(table => {
    const tableNamePattern = new RegExp(`^${req.t('seating.tableName')} \\d+`);
    if (!tableNamePattern.test(table.name)) {
      return table;
    }
   
    const tableNumber = parseInt(table.name.match(/\d+/)?.[0] || '1');
    const baseName = `${req.t('seating.tableName')} ${tableNumber}`;
   
    const seatedGuestIds = arrangement[table.id] || [];
    if (seatedGuestIds.length === 0) {
      return { ...table, name: baseName };
    }
   
    const tableGuests = seatedGuestIds.map(guestId =>
      guests.find(g => g._id.toString() === guestId)
    ).filter(Boolean);
   
    if (tableGuests.length === 0) {
      return { ...table, name: baseName };
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
      ? req.t(`guests.groups.${dominantGroup}`)
      : dominantGroup;
   
    const finalName = `${baseName} - ${groupName}`;
   
    return { ...table, name: finalName };
  });
};

const optimizeArrangementSimulation = (optionSeating, guests) => {
  let optimized = false;
  const actions = [];
  const tablesToRemove = [];
 
  const isSeparated = optionSeating.isSeparatedSeating || false;

  if (isSeparated) {
    const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
    const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
   
    optionSeating.maleTables.forEach(table => {
      const tableGuests = optionSeating.maleArrangement[table.id] || [];
      const tableOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = maleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);

      if (tableOccupancy === 0) {
        tablesToRemove.push({ id: table.id, gender: 'male' });
      } else {
        let optimalCapacity = table.capacity;
        let oldCapacity = table.capacity;
       
        if (table.capacity === 24) {
          if (tableOccupancy >= 21) {
            optimalCapacity = 24;
          } else if (tableOccupancy >= 11 && tableOccupancy <= 12) {
            optimalCapacity = 12;
          } else if (tableOccupancy <= 10) {
            optimalCapacity = 10;
          }
        } else if (table.capacity === 12) {
          if (tableOccupancy >= 11) {
            optimalCapacity = 12;
          } else {
            optimalCapacity = 10;
          }
        }
       
        if (optimalCapacity !== table.capacity) {
          table.capacity = optimalCapacity;
          optimized = true;
        }
      }
    });
   
    optionSeating.femaleTables.forEach(table => {
      const tableGuests = optionSeating.femaleArrangement[table.id] || [];
      const tableOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = femaleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);

      if (tableOccupancy === 0) {
        tablesToRemove.push({ id: table.id, gender: 'female' });
      } else {
        let optimalCapacity = table.capacity;
        let oldCapacity = table.capacity;
       
        if (table.capacity === 24) {
          if (tableOccupancy >= 21) {
            optimalCapacity = 24;
          } else if (tableOccupancy >= 11 && tableOccupancy <= 12) {
            optimalCapacity = 12;
          } else if (tableOccupancy <= 10) {
            optimalCapacity = 10;
          }
        } else if (table.capacity === 12) {
          if (tableOccupancy >= 11) {
            optimalCapacity = 12;
          } else {
            optimalCapacity = 10;
          }
        }
       
        if (optimalCapacity !== table.capacity) {
          table.capacity = optimalCapacity;
          optimized = true;
        }
      }
    });

    tablesToRemove.forEach(({ id, gender }) => {
      if (gender === 'male') {
        optionSeating.maleTables = optionSeating.maleTables.filter(t => t.id !== id);
        delete optionSeating.maleArrangement[id];
      } else {
        optionSeating.femaleTables = optionSeating.femaleTables.filter(t => t.id !== id);
        delete optionSeating.femaleArrangement[id];
      }
      optimized = true;
     
      actions.push({
        action: 'table_removed',
        details: {
          gender,
          reason: 'Empty table removed during optimization'
        }
      });
    });
   
    return {
      wasOptimized: optimized,
      actions,
      maleTables: optionSeating.maleTables,
      femaleTables: optionSeating.femaleTables,
      maleArrangement: optionSeating.maleArrangement,
      femaleArrangement: optionSeating.femaleArrangement
    };
  } else {
    optionSeating.tables.forEach(table => {
      const tableGuests = optionSeating.arrangement[table.id] || [];
      const tableOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);

      if (tableOccupancy === 0) {
        tablesToRemove.push(table.id);
      } else {
        let optimalCapacity = table.capacity;
        let oldCapacity = table.capacity;
       
        if (table.capacity === 24) {
          if (tableOccupancy >= 21) {
            optimalCapacity = 24;
          } else if (tableOccupancy >= 11 && tableOccupancy <= 12) {
            optimalCapacity = 12;
          } else if (tableOccupancy <= 10) {
            optimalCapacity = 10;
          }
        } else if (table.capacity === 12) {
          if (tableOccupancy >= 11) {
            optimalCapacity = 12;
          } else {
            optimalCapacity = 10;
          }
        }
       
        if (optimalCapacity !== table.capacity) {
          table.capacity = optimalCapacity;
          optimized = true;
        }
      }
    });

    tablesToRemove.forEach(tableId => {
      optionSeating.tables = optionSeating.tables.filter(t => t.id !== tableId);
      delete optionSeating.arrangement[tableId];
      optimized = true;
     
      actions.push({
        action: 'table_removed',
        details: {
          reason: 'Empty table removed during optimization'
        }
      });
    });

    return {
      wasOptimized: optimized,
      actions,
      tables: optionSeating.tables,
      arrangement: optionSeating.arrangement
    };
  }
};

const generateOptionDescription = (actions, strategy, req) => {
  const actionCounts = {
    guest_seated: 0,
    guest_removed: 0,
    guest_moved: 0,
    guest_updated: 0,
    table_created: 0,
    table_removed: 0
  };

  actions.forEach(action => {
    if (actionCounts.hasOwnProperty(action.action)) {
      actionCounts[action.action]++;
    }
  });

  let description = '';
 
  if (strategy === 'conservative') {
    description = req.t('seating.sync.conservativeOption');
  } else {
    description = req.t('seating.sync.optimalOption');
  }

  const changes = [];
  if (actionCounts.guest_seated > 0) {
    changes.push(req.t('seating.sync.guestsSeated', { count: actionCounts.guest_seated }));
  }
  if (actionCounts.guest_moved > 0) {
    changes.push(req.t('seating.sync.guestsMoved', { count: actionCounts.guest_moved }));
  }
  if (actionCounts.guest_removed > 0) {
    changes.push(req.t('seating.sync.guestsRemoved', { count: actionCounts.guest_removed }));
  }
  if (actionCounts.table_created > 0) {
    changes.push(req.t('seating.sync.tablesCreated', { count: actionCounts.table_created }));
  }

  if (changes.length > 0) {
    description += ` ${changes.join(', ')}.`;
  }

  return description;
};

const calculateArrangementStats = (optionSeating, guests) => {
  const stats = {
    totalTables: optionSeating.tables.length,
    totalCapacity: optionSeating.tables.reduce((sum, table) => sum + table.capacity, 0),
    occupiedTables: 0,
    seatedPeople: 0,
    utilizationRate: 0
  };

  Object.keys(optionSeating.arrangement).forEach(tableId => {
    const guestIds = optionSeating.arrangement[tableId] || [];
    if (guestIds.length > 0) {
      stats.occupiedTables++;
      stats.seatedPeople += guestIds.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);
    }
  });

  if (stats.totalCapacity > 0) {
    stats.utilizationRate = Math.round((stats.seatedPeople / stats.totalCapacity) * 100);
  }

  return stats;
};

const extractAffectedGuests = (triggers, guests, seating) => {
  const affectedGuestIds = new Set();
  const isSeparated = seating?.isSeparatedSeating || false;
 
  const guestGenderChanges = new Map();
 
  triggers.forEach(trigger => {
    const { changeData } = trigger;
    let guestId = null;
   
    if (changeData.guestId) {
      guestId = changeData.guestId;
      affectedGuestIds.add(guestId);
    }
    if (changeData.guest && changeData.guest._id) {
      guestId = changeData.guest._id.toString();
      affectedGuestIds.add(guestId);
    }
   
    if (isSeparated && guestId) {
      if (!guestGenderChanges.has(guestId)) {
        guestGenderChanges.set(guestId, new Set());
      }
      
      if (changeData.changedGenders && changeData.changedGenders.length > 0) {
        changeData.changedGenders.forEach(gender => {
          guestGenderChanges.get(guestId).add(gender);
        });
      } 
      else if (changeData.type === 'status_became_confirmed' && changeData.guest) {
        if (changeData.guest.maleCount > 0) {
          guestGenderChanges.get(guestId).add('male');
        }
        if (changeData.guest.femaleCount > 0) {
          guestGenderChanges.get(guestId).add('female');
        }
      }
      else if (changeData.guest?.gender) {
        guestGenderChanges.get(guestId).add(changeData.guest.gender);
      }
    }
  });

  return Array.from(affectedGuestIds).flatMap(guestId => {
    const guest = guests.find(g => g._id.toString() === guestId);
    if (!guest) return [];
   
    if (isSeparated) {
      const results = [];
      const changedGenders = guestGenderChanges.get(guestId) || new Set();
      
      if (changedGenders.size === 0) {
        if (guest.maleCount > 0) changedGenders.add('male');
        if (guest.femaleCount > 0) changedGenders.add('female');
      }
     
      if (changedGenders.has('male') && guest.maleCount > 0) {
        results.push({
          id: `${guest._id}_male`,
          odlId: guest._id,
          name: `${guest.firstName} ${guest.lastName}`,
          attendingCount: guest.maleCount,
          group: guest.customGroup || guest.group,
          gender: 'male',
          maleCount: guest.maleCount,
          femaleCount: 0
        });
      }
      
      if (changedGenders.has('female') && guest.femaleCount > 0) {
        results.push({
          id: `${guest._id}_female`,
          originalId: guest._id,
          name: `${guest.firstName} ${guest.lastName}`,
          attendingCount: guest.femaleCount,
          group: guest.customGroup || guest.group,
          gender: 'female',
          maleCount: 0,
          femaleCount: guest.femaleCount
        });
      }
      
      return results;
    }
   
    return [{
      id: guest._id,
      name: `${guest.firstName} ${guest.lastName}`,
      attendingCount: guest.attendingCount || 1,
      group: guest.customGroup || guest.group,
      gender: guest.gender,
      maleCount: guest.maleCount || 0,
      femaleCount: guest.femaleCount || 0
    }];
  });
};

const applySyncOption = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { optionId, customArrangement } = req.body;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
    }

    let seating = await Seating.findOne({ event: eventId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    await seating.populate();
    seating = await Seating.findById(seating._id);

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const isSeparated = seating.isSeparatedSeating || false;
    let appliedData;
    let actions = [];

    if (customArrangement) {
      appliedData = customArrangement;
      actions = customArrangement.actions || [];
    } else {
      const pendingTriggers = seating.pendingSyncTriggers;
      if (pendingTriggers.length === 0) {
        return res.status(400).json({ message: req.t('seating.sync.noChangesToProcess') });
      }
     
      const strategy = 'conservative';

      const option = await generateSyncOption(seating, pendingTriggers, guests, req, strategy);
      appliedData = option;
      actions = option.actions;
    }

    if (isSeparated) {
      if (!appliedData.maleTables || !appliedData.femaleTables ||
          !appliedData.maleArrangement || !appliedData.femaleArrangement) {
        return res.status(400).json({
          message: req.t('seating.sync.invalidOptionData'),
          details: 'Missing required separated seating data'
        });
      }
     
      const validMaleTableIds = new Set((appliedData.maleTables || []).map(t => t.id));
      const validFemaleTableIds = new Set((appliedData.femaleTables || []).map(t => t.id));
     
      const cleanedMaleArrangement = {};
      const cleanedFemaleArrangement = {};
     
      Object.keys(appliedData.maleArrangement).forEach(tableId => {
        if (validMaleTableIds.has(tableId)) {
          cleanedMaleArrangement[tableId] = appliedData.maleArrangement[tableId];
        }
      });
     
      Object.keys(appliedData.femaleArrangement).forEach(tableId => {
        if (validFemaleTableIds.has(tableId)) {
          cleanedFemaleArrangement[tableId] = appliedData.femaleArrangement[tableId];
        }
      });

      const maleValidationErrors = validateArrangementCapacity(appliedData.maleTables, cleanedMaleArrangement, guests, req, 'male');
      const femaleValidationErrors = validateArrangementCapacity(appliedData.femaleTables, cleanedFemaleArrangement, guests, req, 'female');
     
      if (maleValidationErrors.length > 0 || femaleValidationErrors.length > 0) {
        return res.status(400).json({
          message: req.t('seating.sync.validationFailed'),
          errors: [...maleValidationErrors, ...femaleValidationErrors]
        });
      }

      seating.maleTables = appliedData.maleTables;
      seating.femaleTables = appliedData.femaleTables;
      seating.maleArrangement = cleanedMaleArrangement;
      seating.femaleArrangement = cleanedFemaleArrangement;
      seating.isSeparatedSeating = true;
    } else {
      if (!appliedData.tables || !appliedData.arrangement) {
        return res.status(400).json({
          message: req.t('seating.sync.invalidOptionData'),
          details: 'Missing required seating data'
        });
      }
     
      const validTableIds = new Set((appliedData.tables || []).map(t => t.id));
      const cleanedArrangement = {};
     
      Object.keys(appliedData.arrangement).forEach(tableId => {
        if (validTableIds.has(tableId)) {
          cleanedArrangement[tableId] = appliedData.arrangement[tableId];
        }
      });

      const validationErrors = validateArrangementCapacity(appliedData.tables, cleanedArrangement, guests, req);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          message: req.t('seating.sync.validationFailed'),
          errors: validationErrors
        });
      }

      seating.tables = appliedData.tables;
      seating.arrangement = cleanedArrangement;
      seating.isSeparatedSeating = false;
    }

    seating.version += 1;
    seating.updatedAt = new Date();

    const processedTriggers = seating.pendingSyncTriggers;
   
    processedTriggers.forEach(trigger => {
      seating.processSyncTrigger(trigger, {
        success: true,
        actions: actions.filter(action =>
          action.details &&
          (action.details.guestName || action.details.tableName)
        )
      });
    });

    if (isSeparated) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
     
      const cleanupMaleResult = await cleanupEmptyTables(
        { tables: seating.maleTables, arrangement: seating.maleArrangement },
        maleGuests,
        req
      );
     
      const cleanupFemaleResult = await cleanupEmptyTables(
        { tables: seating.femaleTables, arrangement: seating.femaleArrangement },
        femaleGuests,
        req
      );
     
      if (cleanupMaleResult.hasChanges) {
        seating.maleTables = cleanupMaleResult.tables || seating.maleTables;
        seating.maleArrangement = cleanupMaleResult.arrangement || seating.maleArrangement;
        actions.push(...cleanupMaleResult.actions);
      }
     
      if (cleanupFemaleResult.hasChanges) {
        seating.femaleTables = cleanupFemaleResult.tables || seating.femaleTables;
        seating.femaleArrangement = cleanupFemaleResult.arrangement || seating.femaleArrangement;
        actions.push(...cleanupFemaleResult.actions);
      }
    } else {
      const cleanupResult = await cleanupEmptyTables(seating, guests, req);
      if (cleanupResult.hasChanges) {
        actions.push(...cleanupResult.actions);
      }
    }

    let saveSuccess = false;
    let retryCount = 0;
    const maxRetries = 3;
   
    while (!saveSuccess && retryCount < maxRetries) {
      try {
        await seating.save();
        saveSuccess = true;
      } catch (saveError) {
        retryCount++;
        if (saveError.name === 'VersionError' && retryCount < maxRetries) {
          seating = await Seating.findById(seating._id);
         
          if (isSeparated) {
            seating.maleTables = appliedData.maleTables;
            seating.femaleTables = appliedData.femaleTables;
            seating.maleArrangement = appliedData.maleArrangement;
            seating.femaleArrangement = appliedData.femaleArrangement;
          } else {
            seating.tables = appliedData.tables;
            seating.arrangement = appliedData.arrangement;
          }
         
          seating.version += 1;
          seating.updatedAt = new Date();
         
          await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
        } else {
          throw saveError;
        }
      }
    }
   
    if (!saveSuccess) {
      throw new Error('Failed to save after multiple retries');
    }

    const finalStats = isSeparated
      ? calculateArrangementStatsSeparated(seating, guests)
      : calculateArrangementStats({ tables: seating.tables, arrangement: seating.arrangement }, guests);

    const syncSummary = {
      autoSyncEnabled: seating.syncSettings?.autoSyncEnabled !== false,
      pendingTriggers: seating.syncTriggers?.filter(t => !t.processed).length || 0,
      lastSyncTrigger: seating.syncTriggers?.length > 0 ?
        seating.syncTriggers[seating.syncTriggers.length - 1].timestamp : null,
      lastSyncProcessed: seating.lastSyncProcessed || null,
      syncStats: seating.syncStats || {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncStatus: 'success'
      },
      recentTriggers: seating.syncTriggers?.slice(-5) || []
    };

    const responseData = {
      message: req.t('seating.sync.optionApplied'),
      seating: {
        version: seating.version,
        syncSummary,
        isSeparatedSeating: isSeparated
      },
      appliedActions: actions,
      stats: finalStats
    };

    if (isSeparated) {
      responseData.seating.maleTables = seating.maleTables;
      responseData.seating.femaleTables = seating.femaleTables;
      responseData.seating.maleArrangement = seating.maleArrangement;
      responseData.seating.femaleArrangement = seating.femaleArrangement;
    } else {
      responseData.seating.tables = seating.tables;
      responseData.seating.arrangement = seating.arrangement;
    }

    res.json(responseData);

  } catch (err) {
    res.status(500).json({
      message: req.t('seating.sync.applyOptionFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const validateArrangementCapacity = (tables, arrangement, guests, req, tableGender = null) => {
  const errors = [];
 
  const validTableIds = new Set(tables.map(t => t.id));
  const invalidTableIds = Object.keys(arrangement).filter(tableId => !validTableIds.has(tableId));
 
  if (invalidTableIds.length > 0) {
    invalidTableIds.forEach(tableId => {
      errors.push({
        type: 'table_not_found',
        message: req.t('seating.sync.validation.tableNotFound', { tableId: tableId })
      });
    });
    return errors;
  }
 
  Object.entries(arrangement).forEach(([tableId, guestIds]) => {
    if (!Array.isArray(guestIds)) {
      return;
    }
   
    const table = tables.find(t => t.id === tableId);
    if (!table) {
      return;
    }
   
    let totalPeople = 0;
   
    guestIds.forEach(guestId => {
      const guest = guests.find(g => g._id.toString() === guestId);
      if (!guest) {
        return;
      }
     
      let countUsed = 0;
     
      if (tableGender === 'male') {
        countUsed = guest.maleCount || 0;
      } else if (tableGender === 'female') {
        countUsed = guest.femaleCount || 0;
      } else {
        if (guest.maleCount !== undefined || guest.femaleCount !== undefined) {
          const isMaleTable = table.name.includes('גברים') || table.id.startsWith('male_');
          const isFemaleTable = table.name.includes('נשים') || table.id.startsWith('female_');
         
          if (isMaleTable) {
            countUsed = guest.maleCount || 0;
          } else if (isFemaleTable) {
            countUsed = guest.femaleCount || 0;
          } else {
            countUsed = guest.attendingCount || 1;
          }
        } else {
          countUsed = guest.attendingCount || 1;
        }
      }
     
      totalPeople += countUsed;
    });

    if (totalPeople > table.capacity) {
      errors.push({
        type: 'overcapacity',
        message: req.t('seating.sync.validation.tableOvercapacity', {
          tableName: table.name,
          occupancy: totalPeople,
          capacity: table.capacity
        })
      });
    }
  });

  return errors;
};

const moveAffectedGuestsToUnassigned = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { affectedGuestIds } = req.body;
   
    if (!affectedGuestIds || !Array.isArray(affectedGuestIds) || affectedGuestIds.length === 0) {
      return res.status(400).json({ message: req.t('seating.sync.noGuestsSpecified') });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
    }

    const seating = await Seating.findOne({ event: eventId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const isSeparated = seating.isSeparatedSeating || false;
    const movedGuests = [];
    const actions = [];

    affectedGuestIds.forEach(guestData => {
      let rawId = typeof guestData === 'string' ? guestData : guestData.id;
      let specifiedGender = typeof guestData === 'object' ? guestData.gender : null;
      
      let guestId = rawId;
      if (rawId.endsWith('_male')) {
        guestId = rawId.replace('_male', '');
        specifiedGender = specifiedGender || 'male';
      } else if (rawId.endsWith('_female')) {
        guestId = rawId.replace('_female', '');
        specifiedGender = specifiedGender || 'female';
      }
           
      const guest = guests.find(g => g._id.toString() === guestId);
      if (!guest) {
        return;
      }

      let wasMovedFromTable = null;
   
      if (isSeparated) {
        const guestGender = specifiedGender || guest.gender;
       
        const currentArrangement = guestGender === 'male' ? seating.maleArrangement : seating.femaleArrangement;
        const currentTables = guestGender === 'male' ? seating.maleTables : seating.femaleTables;
       
        Object.keys(currentArrangement).forEach(tableId => {
          const guestIndex = currentArrangement[tableId].indexOf(guestId);
          if (guestIndex !== -1) {
            currentArrangement[tableId].splice(guestIndex, 1);
            if (currentArrangement[tableId].length === 0) {
              delete currentArrangement[tableId];
            }
           
            const table = currentTables.find(t => t.id === tableId);
            wasMovedFromTable = table?.name || req.t('seating.unknownTable');
          }
        });
       
        if (guestGender === 'male') {
          seating.maleArrangement = currentArrangement;
        } else {
          seating.femaleArrangement = currentArrangement;
        }
      } else {
        Object.keys(seating.arrangement).forEach(tableId => {
          const guestIndex = seating.arrangement[tableId].indexOf(guestId);
          if (guestIndex !== -1) {
            seating.arrangement[tableId].splice(guestIndex, 1);
            if (seating.arrangement[tableId].length === 0) {
              delete seating.arrangement[tableId];
            }
           
            const table = seating.tables.find(t => t.id === tableId);
            wasMovedFromTable = table?.name || req.t('seating.unknownTable');
          }
        });
      }

      if (wasMovedFromTable) {
        movedGuests.push({
          id: guest._id,
          name: `${guest.firstName} ${guest.lastName}`,
          attendingCount: guest.attendingCount || 1,
          gender: guest.gender,
          fromTable: wasMovedFromTable
        });

        actions.push({
          action: 'guest_moved_to_unassigned',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            fromTable: wasMovedFromTable,
            gender: guest.gender,
            reason: req.t('seating.sync.movedByUserRequest')
          }
        });
      }
    });

    if (seating.syncSettings?.autoOptimizeTables) {
      if (isSeparated) {
        const maleEmptyTables = [];
        seating.maleTables.forEach(table => {
          const hasGuests = seating.maleArrangement[table.id] && seating.maleArrangement[table.id].length > 0;
          if (!hasGuests && (table.autoCreated || table.createdForSync)) {
            maleEmptyTables.push(table.id);
          }
        });

        maleEmptyTables.forEach(tableId => {
          seating.maleTables = seating.maleTables.filter(t => t.id !== tableId);
          delete seating.maleArrangement[tableId];
         
          actions.push({
            action: 'empty_table_removed',
            details: {
              gender: 'male',
              reason: req.t('seating.sync.emptyTableRemoved')
            }
          });
        });
       
        const femaleEmptyTables = [];
        seating.femaleTables.forEach(table => {
          const hasGuests = seating.femaleArrangement[table.id] && seating.femaleArrangement[table.id].length > 0;
          if (!hasGuests && (table.autoCreated || table.createdForSync)) {
            femaleEmptyTables.push(table.id);
          }
        });

        femaleEmptyTables.forEach(tableId => {
          seating.femaleTables = seating.femaleTables.filter(t => t.id !== tableId);
          delete seating.femaleArrangement[tableId];
         
          actions.push({
            action: 'empty_table_removed',
            details: {
              gender: 'female',
              reason: req.t('seating.sync.emptyTableRemoved')
            }
          });
        });
      } else {
        const emptyTables = [];
        seating.tables.forEach(table => {
          const hasGuests = seating.arrangement[table.id] && seating.arrangement[table.id].length > 0;
          if (!hasGuests && (table.autoCreated || table.createdForSync)) {
            emptyTables.push(table.id);
          }
        });

        emptyTables.forEach(tableId => {
          seating.tables = seating.tables.filter(t => t.id !== tableId);
          delete seating.arrangement[tableId];
         
          actions.push({
            action: 'empty_table_removed',
            details: {
              reason: req.t('seating.sync.emptyTableRemoved')
            }
          });
        });
      }
    }

    const processedGuestIds = affectedGuestIds.map(guestData => {
      let rawId = typeof guestData === 'string' ? guestData : guestData.id;
      if (rawId.endsWith('_male')) {
        rawId = rawId.replace('_male', '');
      } else if (rawId.endsWith('_female')) {
        rawId = rawId.replace('_female', '');
      }
      return rawId;
    });

    const pendingTriggers = seating.pendingSyncTriggers;
    pendingTriggers.forEach(trigger => {
      const triggerGuestId = trigger.changeData.guestId || 
        (trigger.changeData.guest && trigger.changeData.guest._id && 
         trigger.changeData.guest._id.toString());
      
      const isRelatedTrigger = processedGuestIds.includes(triggerGuestId);

      if (isRelatedTrigger) {
        seating.processSyncTrigger(trigger, {
          success: true,
          actions: [{
            action: 'manually_resolved',
            details: { reason: req.t('seating.sync.manuallyResolvedByUser') }
          }]
        });
      }
    });

    seating.version += 1;
    seating.updatedAt = new Date();
    await seating.save();

    const stats = isSeparated
      ? calculateArrangementStatsSeparated(seating, guests)
      : calculateArrangementStats({ tables: seating.tables, arrangement: seating.arrangement }, guests);

    const responseData = {
      message: req.t('seating.sync.guestsMovedToUnassigned', { count: movedGuests.length }),
      movedGuests,
      actions,
      seating: {
        version: seating.version,
        syncSummary: seating.getSyncSummary(),
        isSeparatedSeating: isSeparated
      },
      stats
    };

    if (isSeparated) {
      responseData.seating.maleTables = seating.maleTables;
      responseData.seating.femaleTables = seating.femaleTables;
      responseData.seating.maleArrangement = seating.maleArrangement;
      responseData.seating.femaleArrangement = seating.femaleArrangement;
    } else {
      responseData.seating.tables = seating.tables;
      responseData.seating.arrangement = seating.arrangement;
    }

    res.json(responseData);

  } catch (err) {
    res.status(500).json({
      message: req.t('seating.sync.moveGuestsFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const generateAISeating = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      tables,
      maleTables,
      femaleTables,
      preferences,
      guests: requestGuests,
      currentArrangement,
      currentMaleArrangement,
      currentFemaleArrangement,
      clearExisting,
      preserveExisting,
      allTables,
      allMaleTables,
      allFemaleTables,
      seatingRules,
      groupMixingRules,
      allowGroupMixing,
      preferredTableSize,
      isSeparatedSeating,
      useCustomTablesOnly,
      useMaleCustomTablesOnly,
      useFemaleCustomTablesOnly,
      useModifiedPresetTables,
      useMaleModifiedPresetTables,
      useFemaleModifiedPresetTables,
      useUserSelectedTables: useUserSelectedTablesFromBody,
      useMaleUserSelectedTables,
      useFemaleUserSelectedTables
    } = req.body;

    console.log('=== AI GENERATE SEATING - FLAGS RECEIVED ===');
    console.log('isSeparatedSeating:', isSeparatedSeating);
    console.log('useCustomTablesOnly:', useCustomTablesOnly);
    console.log('useModifiedPresetTables:', useModifiedPresetTables);
    console.log('useMaleCustomTablesOnly:', useMaleCustomTablesOnly);
    console.log('useMaleModifiedPresetTables:', useMaleModifiedPresetTables);
    console.log('useFemaleCustomTablesOnly:', useFemaleCustomTablesOnly);
    console.log('useFemaleModifiedPresetTables:', useFemaleModifiedPresetTables);
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;
    let canEdit = isOwner;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
     
      canEdit = true;
    }

    if (!canEdit) {
      return res.status(403).json({ message: req.t('events.accessDenied') });
    }
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    if (guests.length === 0) {
      return res.status(400).json({ message: req.t('seating.errors.noConfirmedGuests') });
    }

    const enhancedPreferences = {
      ...preferences,
      seatingRules: seatingRules || preferences?.seatingRules || { mustSitTogether: [], cannotSitTogether: [] },
      groupMixingRules: groupMixingRules || preferences?.groupMixingRules || [],
      allowGroupMixing: allowGroupMixing !== undefined ? allowGroupMixing : (preferences?.allowGroupMixing !== undefined ? preferences.allowGroupMixing : false),
      preferredTableSize: preferredTableSize || preferences?.preferredTableSize || 12,
      groupPolicies: preferences?.groupPolicies || {}
    };

    let seating = await Seating.findOne({ event: eventId });

    if (isSeparatedSeating) {
      const hasSplitCounts = guests.some(g => g.maleCount !== undefined || g.femaleCount !== undefined);
     
      let maleGuests, femaleGuests;
     
      if (hasSplitCounts) {
        maleGuests = guests
          .filter(g => g.maleCount && g.maleCount > 0)
          .map((g, idx) => {
            const guestObj = g.toObject ? g.toObject() : {...g};
            return {
              ...guestObj,
              _id: g._id,
              attendingCount: g.maleCount,
              gender: 'male'
            };
          });
         
        femaleGuests = guests
          .filter(g => g.femaleCount && g.femaleCount > 0)
          .map((g, idx) => {
            const guestObj = g.toObject ? g.toObject() : {...g};
            return {
              ...guestObj,
              _id: g._id,
              attendingCount: g.femaleCount,
              gender: 'female'
            };
          });
      } else {
        maleGuests = guests
          .filter(g => g.gender === 'male')
          .map(g => ({
            ...g,
            attendingCount: g.attendingCount || 1
          }));
         
        femaleGuests = guests
          .filter(g => g.gender === 'female')
          .map(g => ({
            ...g,
            attendingCount: g.attendingCount || 1
          }));
      }

      let maleTablesList = allMaleTables && allMaleTables.length > 0 ? allMaleTables : maleTables;
      let femaleTablesList = allFemaleTables && allFemaleTables.length > 0 ? allFemaleTables : femaleTables;

      const frontendSentMaleTables = allMaleTables && allMaleTables.length > 0;
      const frontendSentFemaleTables = allFemaleTables && allFemaleTables.length > 0;
     
      if (!maleTablesList || maleTablesList.length === 0) {
        const totalMalePeople = maleGuests.reduce((sum, guest) => sum + guest.attendingCount, 0);
        maleTablesList = createAdditionalTables(totalMalePeople, 0, req, enhancedPreferences.preferredTableSize);
      }

      if (!femaleTablesList || femaleTablesList.length === 0) {
        const totalFemalePeople = femaleGuests.reduce((sum, guest) => sum + guest.attendingCount, 0);
        femaleTablesList = createAdditionalTables(totalFemalePeople, 0, req, enhancedPreferences.preferredTableSize);
      }

      const maleDryRunResult = runDryGenerateOptimalSeating(maleGuests, maleTablesList, enhancedPreferences, 'male');
      
      const femaleDryRunResult = runDryGenerateOptimalSeating(femaleGuests, femaleTablesList, enhancedPreferences, 'female');

      let aiMaleArrangement, aiFemaleArrangement;

      if (preserveExisting && currentMaleArrangement && Object.keys(currentMaleArrangement).length > 0) {
        const seatedMaleGuestIds = new Set(Object.values(currentMaleArrangement).flat());
        const unassignedMaleGuests = maleGuests.filter(guest => !seatedMaleGuestIds.has(guest._id.toString()));
        
        const lockedMaleTableIds = new Set();
        maleTablesList.forEach(table => {
          const tableGuests = currentMaleArrangement[table.id] || [];
          if (tableGuests.length > 0) {
            lockedMaleTableIds.add(table.id);
            table.isLocked = true;
          }
        });
        
        const unassignedMalePeopleCount = unassignedMaleGuests.reduce((sum, guest) => sum + guest.attendingCount, 0);
        
        if (unassignedMalePeopleCount > 0) {
          const dryRunResult = runDryGenerateOptimalSeating(unassignedMaleGuests, [], enhancedPreferences, 'male');
          
          if (dryRunResult && dryRunResult.tables && dryRunResult.arrangement) {
            const lockedMaleTables = maleTablesList.filter(t => t.isLocked);
            maleTablesList = [...lockedMaleTables, ...dryRunResult.tables];
            aiMaleArrangement = { ...currentMaleArrangement, ...dryRunResult.arrangement };
          } else {
            aiMaleArrangement = currentMaleArrangement;
          }
        } else {
          aiMaleArrangement = currentMaleArrangement;
        }
        
      } else {
        const useMaleCustom = useMaleCustomTablesOnly || (preferences && preferences.useMaleCustomTablesOnly);
        
        if (useMaleCustom && allMaleTables && allMaleTables.length > 0) {
          const originalMaleTables = maleTablesList.map(t => ({
            id: t.id,
            capacity: t.capacity,
            type: t.type,
            position: t.position,
            size: t.size,
            rotation: t.rotation
          }));
          const originalMaleTableIds = new Set(originalMaleTables.map(t => t.id));
          
          const maleResult = generateOptimalSeating(maleGuests, maleTablesList, enhancedPreferences, 'male');

          maleTablesList = originalMaleTables.map(originalTable => {
            const resultTable = maleResult.tables.find(t => t.id === originalTable.id);
            if (resultTable) {
              return {
                ...resultTable,
                capacity: originalTable.capacity,
                type: originalTable.type
              };
            }
            return {
              id: originalTable.id,
              capacity: originalTable.capacity,
              type: originalTable.type,
              position: originalTable.position,
              size: originalTable.size,
              rotation: originalTable.rotation,
              assignedGuests: [],
              remainingCapacity: originalTable.capacity
            };
          });

          aiMaleArrangement = {};
          Object.entries(maleResult.arrangement).forEach(([tableId, guestIds]) => {
            if (originalMaleTableIds.has(tableId)) {
              const originalTable = originalMaleTables.find(t => t.id === tableId);
              if (originalTable) {
                let currentCapacity = 0;
                const filteredGuestIds = [];
                for (const guestId of guestIds) {
                  const guest = maleGuests.find(g => g._id.toString() === guestId);
                  const guestSize = guest ? (guest.attendingCount || 1) : 1;
                  if (currentCapacity + guestSize <= originalTable.capacity) {
                    filteredGuestIds.push(guestId);
                    currentCapacity += guestSize;
                  }
                }
                aiMaleArrangement[tableId] = filteredGuestIds;
              }
            }
          });

          const assignedMaleGuestIds = new Set(Object.values(aiMaleArrangement).flat());
          const unassignedMaleGuestsAfterCustom = maleGuests.filter(g => !assignedMaleGuestIds.has(g._id.toString()));

          if (unassignedMaleGuestsAfterCustom.length > 0) {
            const unassignedMalePeopleCount = unassignedMaleGuestsAfterCustom.reduce((sum, g) => sum + (g.attendingCount || 1), 0);

            const existing24MaleTables = maleTablesList.filter(t => t.capacity === 24).length;

            // Create emergency tables for unassigned male guests
            const emergencyMaleTables = createAdditionalTables(unassignedMalePeopleCount, maleTablesList.length, req, enhancedPreferences.preferredTableSize || 12, existing24MaleTables);

            // Run seating algorithm for unassigned male guests on emergency tables
            const emergencyMaleResult = generateOptimalSeating(unassignedMaleGuestsAfterCustom, emergencyMaleTables, enhancedPreferences, 'male');

            // Add emergency tables to the male tables list
            emergencyMaleTables.forEach((emergencyTable) => {
              emergencyTable.isEmergency = true;
              maleTablesList.push(emergencyTable);
            });

            Object.entries(emergencyMaleResult.arrangement).forEach(([tableId, guestIds]) => {
              if (guestIds && guestIds.length > 0) {
                aiMaleArrangement[tableId] = guestIds;
              }
            });
          }
        } else if (maleDryRunResult.tables && maleDryRunResult.tables.length > 0) {
          maleTablesList = maleDryRunResult.tables;
          aiMaleArrangement = maleDryRunResult.arrangement;
          
        } else {
          const maleResult = generateOptimalSeating(maleGuests, maleTablesList, enhancedPreferences, 'male');
          aiMaleArrangement = maleResult.arrangement;
          maleTablesList = maleResult.tables;
        }
      }

      if (preserveExisting && currentFemaleArrangement && Object.keys(currentFemaleArrangement).length > 0) {
        const seatedFemaleGuestIds = new Set(Object.values(currentFemaleArrangement).flat());
        const unassignedFemaleGuests = femaleGuests.filter(guest => !seatedFemaleGuestIds.has(guest._id.toString()));
        
        const lockedFemaleTableIds = new Set();
        femaleTablesList.forEach(table => {
          const tableGuests = currentFemaleArrangement[table.id] || [];
          if (tableGuests.length > 0) {
            lockedFemaleTableIds.add(table.id);
            table.isLocked = true;
          }
        });
        
        const unassignedFemalePeopleCount = unassignedFemaleGuests.reduce((sum, guest) => sum + guest.attendingCount, 0);
        
        if (unassignedFemalePeopleCount > 0) {
          const dryRunResult = runDryGenerateOptimalSeating(unassignedFemaleGuests, [], enhancedPreferences, 'female');
          
          if (dryRunResult && dryRunResult.tables && dryRunResult.arrangement) {
            const lockedFemaleTables = femaleTablesList.filter(t => t.isLocked);
            femaleTablesList = [...lockedFemaleTables, ...dryRunResult.tables];
            aiFemaleArrangement = { ...currentFemaleArrangement, ...dryRunResult.arrangement };
          } else {
            aiFemaleArrangement = currentFemaleArrangement;
          }
        } else {
          aiFemaleArrangement = currentFemaleArrangement;
        }
        
      } else {
        const useFemaleCustom = useFemaleCustomTablesOnly || (preferences && preferences.useFemaleCustomTablesOnly);
        
        if (useFemaleCustom && allFemaleTables && allFemaleTables.length > 0) {
          const originalFemaleTables = femaleTablesList.map(t => ({
            id: t.id,
            capacity: t.capacity,
            type: t.type,
            position: t.position,
            size: t.size,
            rotation: t.rotation
          }));
          const originalFemaleTableIds = new Set(originalFemaleTables.map(t => t.id));
          
          const femaleResult = generateOptimalSeating(femaleGuests, femaleTablesList, enhancedPreferences, 'female');

          femaleTablesList = originalFemaleTables.map(originalTable => {
            const resultTable = femaleResult.tables.find(t => t.id === originalTable.id);
            if (resultTable) {
              return {
                ...resultTable,
                capacity: originalTable.capacity,
                type: originalTable.type
              };
            }
            return {
              id: originalTable.id,
              capacity: originalTable.capacity,
              type: originalTable.type,
              position: originalTable.position,
              size: originalTable.size,
              rotation: originalTable.rotation,
              assignedGuests: [],
              remainingCapacity: originalTable.capacity
            };
          });

          aiFemaleArrangement = {};
          Object.entries(femaleResult.arrangement).forEach(([tableId, guestIds]) => {
            if (originalFemaleTableIds.has(tableId)) {
              const originalTable = originalFemaleTables.find(t => t.id === tableId);
              if (originalTable) {
                let currentCapacity = 0;
                const filteredGuestIds = [];
                for (const guestId of guestIds) {
                  const guest = femaleGuests.find(g => g._id.toString() === guestId);
                  const guestSize = guest ? (guest.attendingCount || 1) : 1;
                  if (currentCapacity + guestSize <= originalTable.capacity) {
                    filteredGuestIds.push(guestId);
                    currentCapacity += guestSize;
                  }
                }
                aiFemaleArrangement[tableId] = filteredGuestIds;
              }
            }
          });

          const assignedFemaleGuestIds = new Set(Object.values(aiFemaleArrangement).flat());
          const unassignedFemaleGuestsAfterCustom = femaleGuests.filter(g => !assignedFemaleGuestIds.has(g._id.toString()));

          if (unassignedFemaleGuestsAfterCustom.length > 0) {
            const unassignedFemalePeopleCount = unassignedFemaleGuestsAfterCustom.reduce((sum, g) => sum + (g.attendingCount || 1), 0);

            const existing24FemaleTables = femaleTablesList.filter(t => t.capacity === 24).length;

            // Create emergency tables for unassigned female guests
            const emergencyFemaleTables = createAdditionalTables(unassignedFemalePeopleCount, femaleTablesList.length, req, enhancedPreferences.preferredTableSize || 12, existing24FemaleTables);

            const emergencyFemaleResult = generateOptimalSeating(unassignedFemaleGuestsAfterCustom, emergencyFemaleTables, enhancedPreferences, 'female');

            emergencyFemaleTables.forEach((emergencyTable) => {
              emergencyTable.isEmergency = true;
              femaleTablesList.push(emergencyTable);
            });

            Object.entries(emergencyFemaleResult.arrangement).forEach(([tableId, guestIds]) => {
              if (guestIds && guestIds.length > 0) {
                aiFemaleArrangement[tableId] = guestIds;
              }
            });
          }
        } else if (femaleDryRunResult.tables && femaleDryRunResult.tables.length > 0) {
          femaleTablesList = femaleDryRunResult.tables;
          aiFemaleArrangement = femaleDryRunResult.arrangement;
          
        } else {
          const femaleResult = generateOptimalSeating(femaleGuests, femaleTablesList, enhancedPreferences, 'female');
          aiFemaleArrangement = femaleResult.arrangement;
          femaleTablesList = femaleResult.tables;
        }
      }

      const useMaleCustom = useMaleCustomTablesOnly || (preferences && preferences.useMaleCustomTablesOnly);
      const useMaleModifiedPreset = useMaleModifiedPresetTables || (preferences && preferences.useMaleModifiedPresetTables);
      const useMaleUserSelected = useMaleCustom || useMaleModifiedPreset;
      if (!useMaleUserSelected) {
        maleTablesList = maleTablesList.filter(table => {
          const tableGuests = aiMaleArrangement[table.id];
          const hasGuests = tableGuests && Array.isArray(tableGuests) && tableGuests.length > 0;
          return hasGuests;
        });
      }

      const useFemaleCustom = useFemaleCustomTablesOnly || (preferences && preferences.useFemaleCustomTablesOnly);
      const useFemaleModifiedPreset = useFemaleModifiedPresetTables || (preferences && preferences.useFemaleModifiedPresetTables);
      const useFemaleUserSelected = useFemaleCustom || useFemaleModifiedPreset;
      if (!useFemaleUserSelected) {
        femaleTablesList = femaleTablesList.filter(table => {
          const tableGuests = aiFemaleArrangement[table.id];
          const hasGuests = tableGuests && Array.isArray(tableGuests) && tableGuests.length > 0;
          return hasGuests;
        });
      }

      if (useMaleUserSelected) {
        maleTablesList.sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
      } else {
        const lockedMaleTables = maleTablesList.filter(t => t.isLocked);
        const newMaleTables = maleTablesList.filter(t => !t.isLocked);
        maleTablesList = [...lockedMaleTables, ...newMaleTables];
      }

      if (useFemaleUserSelected) {
        femaleTablesList.sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
      } else {
        const lockedFemaleTables = femaleTablesList.filter(t => t.isLocked);
        const newFemaleTables = femaleTablesList.filter(t => !t.isLocked);
        femaleTablesList = [...lockedFemaleTables, ...newFemaleTables];
      }
      
      const MALE_START_X = 300;
      const FEMALE_START_X = 1300;
      const START_Y = 250;
      const SPACING_X = 200;
      const SPACING_Y = 180;
      const COLS = 4;
      
      maleTablesList.forEach((table, index) => {
        table.name = `שולחן ${index + 1}`;
        table.order = index;
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        table.position = {
          x: MALE_START_X + col * SPACING_X,
          y: START_Y + row * SPACING_Y
        };
      });
      
      const maleTablesCount = maleTablesList.length;
      femaleTablesList.forEach((table, index) => {
        table.name = `שולחן ${maleTablesCount + index + 1}`;
        table.order = maleTablesCount + index;
        const row = Math.floor(index / COLS);
        const col = index % COLS;
        table.position = {
          x: FEMALE_START_X + col * SPACING_X,
          y: START_Y + row * SPACING_Y
        };
      });
      
      maleTablesList.forEach(table => {
        if (!table.isLocked && table.capacity === 12) {
          const guestIds = aiMaleArrangement[table.id] || [];
          const tableGuests = guestIds.map(gId => maleGuests.find(g => g._id.toString() === gId)).filter(Boolean);
          const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          
          if (totalPeople > 0 && totalPeople < 11) {
            table.capacity = 10;
          }
        }
      });
      
      femaleTablesList.forEach(table => {
        if (!table.isLocked && table.capacity === 12) {
          const guestIds = aiFemaleArrangement[table.id] || [];
          const tableGuests = guestIds.map(gId => femaleGuests.find(g => g._id.toString() === gId)).filter(Boolean);
          const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          
          if (totalPeople > 0 && totalPeople < 11) {
            table.capacity = 10;
          }
        }
      });
            
      if (seating) {
        seating.maleTables = maleTablesList;
        seating.femaleTables = femaleTablesList;
        seating.maleArrangement = aiMaleArrangement;
        seating.femaleArrangement = aiFemaleArrangement;
        seating.isSeparatedSeating = true;
        seating.preferences = enhancedPreferences;
        seating.generatedBy = 'ai';
        seating.version += 1;
        seating.updatedAt = new Date();
       
        seating.syncTriggers = [];
        seating.lastSyncProcessed = new Date();
      } else {
        seating = new Seating({
          event: eventId,
          maleTables: maleTablesList,
          femaleTables: femaleTablesList,
          maleArrangement: aiMaleArrangement,
          femaleArrangement: aiFemaleArrangement,
          isSeparatedSeating: true,
          preferences: enhancedPreferences,
          generatedBy: 'ai'
        });
      }

      await seating.save();

      res.json({
        message: req.t('seating.ai.generationSuccess'),
        maleArrangement: seating.maleArrangement,
        femaleArrangement: seating.femaleArrangement,
        maleTables: seating.maleTables,
        femaleTables: seating.femaleTables,
        statistics: seating.getStatistics(guests),
        syncSummary: seating.getSyncSummary()
      });

    } else {
      let tablesToUse = allTables && allTables.length > 0 ? allTables : tables;

      let aiArrangement;

      if (preserveExisting && currentArrangement && Object.keys(currentArrangement).length > 0) {
        const seatedGuestIds = new Set(Object.values(currentArrangement).flat());
        const unassignedGuests = guests.filter(guest => !seatedGuestIds.has(guest._id.toString()));
        
        const lockedTableIds = new Set();
        tablesToUse.forEach(table => {
          const tableGuests = currentArrangement[table.id] || [];
          if (tableGuests.length > 0) {
            lockedTableIds.add(table.id);
            table.isLocked = true;
          }
        });
        
        const newTablesForUnassigned = [];
        const unassignedPeopleCount = unassignedGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        
        if (unassignedPeopleCount > 0) {

          const dryRunResult = runDryGenerateOptimalSeating(unassignedGuests, [], enhancedPreferences, null);
          
          if (dryRunResult && dryRunResult.tables && dryRunResult.arrangement) {
            const lockedTablesCount = lockedTableIds.size;
            dryRunResult.tables.forEach((newTable, index) => {
              newTable.name = `שולחן ${lockedTablesCount + index + 1}`;
              newTable.order = lockedTablesCount + index;
            });
            
            const lockedTables = tablesToUse.filter(t => t.isLocked);
            tablesToUse = [...lockedTables, ...dryRunResult.tables];
            
            aiArrangement = { ...currentArrangement, ...dryRunResult.arrangement };
          } else {
            aiArrangement = currentArrangement;
          }
        } else {
          aiArrangement = currentArrangement;
        }
        
        const COLS_FIRST_SECTION = 5;
        const COLS_OTHER_SECTIONS = 4;
        const ROWS = 7;
        const TABLES_FIRST_SECTION = ROWS * COLS_FIRST_SECTION; 
        const TABLES_OTHER_SECTION = ROWS * COLS_OTHER_SECTIONS; 
        const START_X = 300;
        const START_Y = 250;
        const SPACING_X = 200;
        const SPACING_Y = 180;
        const SECTION_GAP = 200; 

        tablesToUse.forEach((table, index) => {
          table.order = index;
          table.name = `שולחן ${index + 1}`;

          let row, col, sectionOffset;
          if (index < TABLES_FIRST_SECTION) {
            row = Math.floor(index / COLS_FIRST_SECTION);
            col = index % COLS_FIRST_SECTION;
            sectionOffset = 0;
          } else {
            const indexAfterFirst = index - TABLES_FIRST_SECTION;
            const section = 1 + Math.floor(indexAfterFirst / TABLES_OTHER_SECTION);
            const indexInSection = indexAfterFirst % TABLES_OTHER_SECTION;
            row = Math.floor(indexInSection / COLS_OTHER_SECTIONS);
            col = indexInSection % COLS_OTHER_SECTIONS;
            sectionOffset = (COLS_FIRST_SECTION * SPACING_X + SECTION_GAP) + (section - 1) * (COLS_OTHER_SECTIONS * SPACING_X + SECTION_GAP);
          }

          table.position = {
            x: START_X + col * SPACING_X + sectionOffset,
            y: START_Y + row * SPACING_Y
          };
        });

      } else {

        const useCustom = useCustomTablesOnly || (preferences && preferences.useCustomTablesOnly);
        const useModifiedPreset = useModifiedPresetTables || (preferences && preferences.useModifiedPresetTables);
        const useUserSelectedFromBody = useUserSelectedTablesFromBody || (preferences && preferences.useUserSelectedTables);
        // Use user's selected tables if they chose custom tables, modified preset tables, or explicitly selected
        const useUserSelectedTables = useCustom || useModifiedPreset || useUserSelectedFromBody;

        console.log('=== DEBUG USER SELECTED TABLES (non-separated) ===');
        console.log('useCustomTablesOnly:', useCustomTablesOnly);
        console.log('useModifiedPresetTables:', useModifiedPresetTables);
        console.log('useUserSelectedTablesFromBody:', useUserSelectedTablesFromBody);
        console.log('preferences?.useCustomTablesOnly:', preferences?.useCustomTablesOnly);
        console.log('preferences?.useModifiedPresetTables:', preferences?.useModifiedPresetTables);
        console.log('preferences?.useUserSelectedTables:', preferences?.useUserSelectedTables);
        console.log('useCustom:', useCustom);
        console.log('useModifiedPreset:', useModifiedPreset);
        console.log('useUserSelectedFromBody:', useUserSelectedFromBody);
        console.log('useUserSelectedTables:', useUserSelectedTables);
        console.log('allTables?.length:', allTables?.length);
        console.log('tablesToUse?.length:', tablesToUse?.length);

        if (useUserSelectedTables && allTables && allTables.length > 0) {
          const originalTables = tablesToUse.map(t => ({
            id: t.id,
            capacity: t.capacity,
            type: t.type,
            position: t.position,
            size: t.size,
            rotation: t.rotation
          }));
          const originalTableIds = new Set(originalTables.map(t => t.id));
          
          const result = generateOptimalSeating(guests, tablesToUse, enhancedPreferences, null);

          tablesToUse = originalTables.map(originalTable => {
            const resultTable = result.tables.find(t => t.id === originalTable.id);
            if (resultTable) {
              return {
                ...resultTable,
                capacity: originalTable.capacity,
                type: originalTable.type
              };
            }
            return {
              id: originalTable.id,
              capacity: originalTable.capacity,
              type: originalTable.type,
              position: originalTable.position,
              size: originalTable.size,
              rotation: originalTable.rotation,
              assignedGuests: [],
              remainingCapacity: originalTable.capacity
            };
          });

          aiArrangement = {};
          Object.entries(result.arrangement).forEach(([tableId, guestIds]) => {
            if (originalTableIds.has(tableId)) {
              const originalTable = originalTables.find(t => t.id === tableId);
              if (originalTable) {
                let currentCapacity = 0;
                const filteredGuestIds = [];
                for (const guestId of guestIds) {
                  const guest = guests.find(g => g._id.toString() === guestId);
                  const guestSize = guest ? (guest.attendingCount || 1) : 1;
                  if (currentCapacity + guestSize <= originalTable.capacity) {
                    filteredGuestIds.push(guestId);
                    currentCapacity += guestSize;
                  }
                }
                aiArrangement[tableId] = filteredGuestIds;
              } else {
                aiArrangement[tableId] = guestIds;
              }
            }
          });

          const totalAssignedAfterFilter = Object.values(aiArrangement).flat().length;
          const totalPeopleAssigned = Object.values(aiArrangement).flat().reduce((sum, guestId) => {
            const guest = guests.find(g => g._id.toString() === guestId);
            return sum + (guest ? (guest.attendingCount || 1) : 1);
          }, 0);
          const totalGuests = guests.length;
          const totalPeople = guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          
          const assignedGuestIds = new Set(Object.values(aiArrangement).flat());
          const unassignedGuests = guests.filter(g => !assignedGuestIds.has(g._id.toString()));

          if (unassignedGuests.length > 0) {
            const tableCapacities = {};
            tablesToUse.forEach(table => {
              const assignedToTable = aiArrangement[table.id] || [];
              const usedCapacity = assignedToTable.reduce((sum, guestId) => {
                const guest = guests.find(g => g._id.toString() === guestId);
                return sum + (guest ? (guest.attendingCount || 1) : 1);
              }, 0);
              tableCapacities[table.id] = table.capacity - usedCapacity;
            });
            
            unassignedGuests.sort((a, b) => (b.attendingCount || 1) - (a.attendingCount || 1));
            
            for (const guest of unassignedGuests) {
              const guestGroup = guest.customGroup || guest.group;
              const guestCount = guest.attendingCount || 1;
              
              let bestTableSameGroup = null;
              let bestTableAnyGroup = null;
              let bestTableEmpty = null;
              
              for (const table of tablesToUse) {
                if (tableCapacities[table.id] >= guestCount) {
                  const tableGuestIds = aiArrangement[table.id] || [];
                  const tableGuests = tableGuestIds.map(gId => 
                    guests.find(g => g._id.toString() === gId)
                  ).filter(Boolean);
                  
                  const isEmptyTable = tableGuests.length === 0;
                  const hasSameGroup = tableGuests.some(g => 
                    (g.customGroup || g.group) === guestGroup
                  );
                  const hasOnlySameGroup = tableGuests.length > 0 && tableGuests.every(g => 
                    (g.customGroup || g.group) === guestGroup
                  );
                  
                  if (isEmptyTable) {
                    if (!bestTableEmpty || tableCapacities[table.id] < tableCapacities[bestTableEmpty.id]) {
                      bestTableEmpty = table;
                    }
                  }
                  else if (hasOnlySameGroup) {
                    if (!bestTableSameGroup || tableCapacities[table.id] > tableCapacities[bestTableSameGroup.id]) {
                      bestTableSameGroup = table;
                    }
                  }
                  
                  if (enhancedPreferences.allowGroupMixing) {
                    if (hasSameGroup || isEmptyTable) {
                      if (!bestTableAnyGroup || tableCapacities[table.id] > tableCapacities[bestTableAnyGroup.id]) {
                        bestTableAnyGroup = table;
                      }
                    }
                  }
                }
              }
              
              const targetTable = bestTableSameGroup || bestTableEmpty || bestTableAnyGroup;

              if (targetTable) {
                if (!aiArrangement[targetTable.id]) {
                  aiArrangement[targetTable.id] = [];
                }
                aiArrangement[targetTable.id].push(guest._id.toString());
                tableCapacities[targetTable.id] -= guestCount;
              }
            }
          }

          // Check for still unassigned guests and create emergency tables if needed
          const finalAssignedGuestIds = new Set(Object.values(aiArrangement).flat());
          const stillUnassignedGuests = guests.filter(g => !finalAssignedGuestIds.has(g._id.toString()));

          console.log('=== EMERGENCY TABLES CHECK ===');
          console.log('Total guests:', guests.length);
          console.log('Assigned guests:', finalAssignedGuestIds.size);
          console.log('Still unassigned:', stillUnassignedGuests.length);
          console.log('Tables before emergency:', tablesToUse.length);

          if (stillUnassignedGuests.length > 0) {
            const stillUnassignedPeopleCount = stillUnassignedGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
            console.log('Unassigned people count:', stillUnassignedPeopleCount);

            const existing24Tables = tablesToUse.filter(t => t.capacity === 24).length;

            const emergencyTables = createAdditionalTables(stillUnassignedPeopleCount, tablesToUse.length, req, enhancedPreferences.preferredTableSize || 12, existing24Tables);
            console.log('Emergency tables created:', emergencyTables.length);

            const emergencyResult = generateOptimalSeating(stillUnassignedGuests, emergencyTables, enhancedPreferences, null);
            console.log('Emergency result arrangement keys:', Object.keys(emergencyResult.arrangement || {}).length);

            emergencyTables.forEach((emergencyTable) => {
              emergencyTable.isEmergency = true;
              tablesToUse.push(emergencyTable);
            });

            Object.entries(emergencyResult.arrangement).forEach(([tableId, guestIds]) => {
              if (guestIds && guestIds.length > 0) {
                aiArrangement[tableId] = guestIds;
              }
            });

            console.log('Tables after emergency:', tablesToUse.length);
          } else {
            console.log('No unassigned guests - no emergency tables needed');
          }

          tablesToUse.sort((a, b) => (a.capacity || 0) - (b.capacity || 0));

        } else {
          const dryRunResult = runDryGenerateOptimalSeating(guests, tablesToUse, enhancedPreferences, null);
          if (!dryRunResult || !dryRunResult.arrangement || !dryRunResult.tables) {
            throw new Error('Failed to generate seating arrangement');
          }

          aiArrangement = dryRunResult.arrangement;
          tablesToUse = dryRunResult.tables;
        }
      }

      const COLS_FIRST_SECTION = 5;
      const COLS_OTHER_SECTIONS = 4;
      const ROWS = 7;
      const TABLES_FIRST_SECTION = ROWS * COLS_FIRST_SECTION; 
      const TABLES_OTHER_SECTION = ROWS * COLS_OTHER_SECTIONS; 
      const START_X = 300;
      const START_Y = 250;
      const SPACING_X = 200;
      const SPACING_Y = 180;
      const SECTION_GAP = 200; 

      tablesToUse.forEach((table, index) => {
        table.order = index;
        table.name = `שולחן ${index + 1}`;

        let row, col, sectionOffset;
        if (index < TABLES_FIRST_SECTION) {
          row = Math.floor(index / COLS_FIRST_SECTION);
          col = index % COLS_FIRST_SECTION;
          sectionOffset = 0;
        } else {
          const indexAfterFirst = index - TABLES_FIRST_SECTION;
          const section = 1 + Math.floor(indexAfterFirst / TABLES_OTHER_SECTION);
          const indexInSection = indexAfterFirst % TABLES_OTHER_SECTION;
          row = Math.floor(indexInSection / COLS_OTHER_SECTIONS);
          col = indexInSection % COLS_OTHER_SECTIONS;
          sectionOffset = (COLS_FIRST_SECTION * SPACING_X + SECTION_GAP) + (section - 1) * (COLS_OTHER_SECTIONS * SPACING_X + SECTION_GAP);
        }

        table.position = {
          x: START_X + col * SPACING_X + sectionOffset,
          y: START_Y + row * SPACING_Y
        };
      });
      if (seating) {
        seating.tables = tablesToUse;
        seating.arrangement = aiArrangement;
        seating.isSeparatedSeating = false;
        seating.preferences = enhancedPreferences;
        seating.generatedBy = 'ai';
        seating.version += 1;
        seating.updatedAt = new Date();
       
        seating.syncTriggers = [];
        seating.lastSyncProcessed = new Date();
      } else {
        seating = new Seating({
          event: eventId,
          tables: tablesToUse,
          arrangement: aiArrangement,
          isSeparatedSeating: false,
          preferences: enhancedPreferences,
          generatedBy: 'ai'
        });
      }

      await seating.save();

      res.json({
        message: req.t('seating.ai.generationSuccess'),
        arrangement: seating.arrangement,
        tables: seating.tables,
        statistics: seating.getStatistics(guests),
        syncSummary: seating.getSyncSummary()
      });
    }
  } catch (err) {
    res.status(500).json({
      message: req.t('seating.errors.aiGenerationFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

function getMaxTableNumber(tables) {
  let maxNumber = 0;
  tables.forEach(t => {
    const match = t.name.match(/שולחן (\d+)/);
    if (match) {
      const num = parseInt(match[1]);
      if (num > maxNumber) {
        maxNumber = num;
      }
    }
  });
  return maxNumber;
}

function buildMixingClusters(groupMixingRules) {
  if (!groupMixingRules || groupMixingRules.length === 0) {
    return new Map();
  }

  const parent = new Map();
  const rank = new Map();

  const find = (group) => {
    if (!parent.has(group)) {
      parent.set(group, group);
      rank.set(group, 0);
      return group;
    }
    if (parent.get(group) !== group) {
      parent.set(group, find(parent.get(group)));
    }
    return parent.get(group);
  };

  const union = (group1, group2) => {
    const root1 = find(group1);
    const root2 = find(group2);
   
    if (root1 === root2) return;

    if (rank.get(root1) < rank.get(root2)) {
      parent.set(root1, root2);
    } else if (rank.get(root1) > rank.get(root2)) {
      parent.set(root2, root1);
    } else {
      parent.set(root2, root1);
      rank.set(root1, rank.get(root1) + 1);
    }
  };

  groupMixingRules.forEach(rule => {
    union(rule.group1, rule.group2);
  });

  const groupToCluster = new Map();
  const clusterMap = new Map();
  let clusterIdCounter = 0;

  parent.forEach((_, group) => {
    const root = find(group);
    if (!clusterMap.has(root)) {
      clusterMap.set(root, clusterIdCounter++);
    }
    groupToCluster.set(group, clusterMap.get(root));
  });

  return groupToCluster;
}

function canGroupsMix(group1, group2, mixingMode, groupMixingRules, clusterMap, groupPolicies) {
  if (group1 === group2) return true;
 
  if (groupPolicies) {
    if (groupPolicies[group1] === 'S' || groupPolicies[group2] === 'S') {
      return false;
    }
  }

  if (!mixingMode || mixingMode === 'none') {
    return false;
  }

  if (mixingMode === 'free' || mixingMode === 'optimal') {
    return true;
  }

  if (mixingMode === 'rules') {
    if (!groupMixingRules || groupMixingRules.length === 0) {
      return false;
    }

    const policy1 = groupPolicies ? groupPolicies[group1] : null;
    const policy2 = groupPolicies ? groupPolicies[group2] : null;
   
    if (policy1 === 'M' && policy2 === 'M') {
      return true;
    }

    if (clusterMap && clusterMap.has(group1) && clusterMap.has(group2)) {
      return clusterMap.get(group1) === clusterMap.get(group2);
    }

    const hasDirectRule = groupMixingRules.some(rule =>
      (rule.group1 === group1 && rule.group2 === group2) ||
      (rule.group1 === group2 && rule.group2 === group1)
    );

    return hasDirectRule;
  }

  return false;
}

function groupGuestsByClusters(guests, mixingMode, clusterMap, alreadyAssigned, groupPolicies) {
  const clusterGuests = new Map();
  const noClusterGuests = [];
  const separateGroups = new Map();
  const allFlexibleGuests = [];

  guests.forEach(guest => {
    if (!guest || !guest._id) return;
    if (alreadyAssigned && alreadyAssigned.has(guest._id.toString())) {
      return;
    }

    const group = guest.customGroup || guest.group;
    const policy = groupPolicies ? groupPolicies[group] : null;
   
    if (policy === 'S') {
      if (!separateGroups.has(group)) {
        separateGroups.set(group, []);
      }
      separateGroups.get(group).push(guest);
      return;
    }

    if (mixingMode === 'free' || mixingMode === 'optimal') {
      allFlexibleGuests.push(guest);
      return;
    }

    if (mixingMode === 'rules' && clusterMap && clusterMap.has(group)) {
      const clusterId = clusterMap.get(group);
      if (!clusterGuests.has(clusterId)) {
        clusterGuests.set(clusterId, []);
      }
      clusterGuests.get(clusterId).push(guest);
    } else {
      noClusterGuests.push(guest);
    }
  });

  return { clusterGuests, noClusterGuests, separateGroups, allFlexibleGuests };
}

function assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, req) {
  const guestId = guest._id.toString();
 
  if (alreadyAssigned.has(guestId)) {
    return false;
  }

  const guestSize = guest.attendingCount || 1;
 
  for (const tableId in arrangement) {
    if (arrangement[tableId] && arrangement[tableId].includes(guestId)) {
      if (alreadyAssigned) {
        alreadyAssigned.add(guestId);
      }
      return false;
    }
  }
 
  const tableGuestsForCapacity = (arrangement[table.id] || []).map(gId =>
    guests.find(g => g._id.toString() === gId)
  ).filter(Boolean);
  const currentOccupancy = tableGuestsForCapacity.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
  const actualRemainingCapacity = table.capacity - currentOccupancy;
 
  if (actualRemainingCapacity < guestSize) {
    return false;
  }

  if (hasSeparationConflicts([guest], table, preferences, guests)) {
    return false;
  }

  if (table.gender && guest.gender) {
    const tableGender = String(table.gender);
    const guestGender = String(guest.gender);
   
    if (tableGender !== guestGender) {
      return false;
    }
  }

  const guestGroup = guest.customGroup || guest.group;
  const groupPolicies = preferences.groupPolicies || {};
  const guestPolicy = groupPolicies[guestGroup] || 'M';
 
  const mixingMode = determineMixingMode(preferences);

  const tableGuests = (arrangement[table.id] || []).map(gId =>
    guests.find(g => g._id.toString() === gId)
  ).filter(Boolean);

  const existingGroups = [...new Set(tableGuests.map(g => g.customGroup || g.group))];
 
  for (const existingGroup of existingGroups) {
    const existingGroupPolicy = groupPolicies[existingGroup] || 'M';
   
    if (existingGroupPolicy === 'S' && existingGroup !== guestGroup) {
      return false;
    }
  }

  if (guestPolicy === 'S' || mixingMode === 'none') {
    const hasOtherGroups = tableGuests.some(g => {
      const tGroup = g.customGroup || g.group;
      return tGroup !== guestGroup;
    });

    if (hasOtherGroups) {
      return false;
    }
  }
  else if (mixingMode === 'rules') {
    const groupMixingRules = preferences.groupMixingRules || [];
    const clusterMap = buildMixingClusters(groupMixingRules);
   
    for (const tableGuest of tableGuests) {
      const tableGuestGroup = tableGuest.customGroup || tableGuest.group;
     
      if (!canGroupsMix(guestGroup, tableGuestGroup, mixingMode, groupMixingRules, clusterMap, groupPolicies)) {
        return false;
      }
    }
  }

  if (!arrangement[table.id]) {
    arrangement[table.id] = [];
  }
 
  arrangement[table.id].push(guestId);
  table.assignedGuests.push(guestId);
  table.remainingCapacity = actualRemainingCapacity - guestSize;
 
  if (alreadyAssigned) {
    alreadyAssigned.add(guestId);
  }
 
  return true;
}



function determineMixingMode(preferences) {

  if (preferences.allowGroupMixing === false) {
    return 'none';
  }

  if (preferences.allowGroupMixing === true) {
    if (!preferences.groupMixingRules || preferences.groupMixingRules.length === 0) {
      return 'free';
    }
    return 'rules';
  }

  return 'none';
}

function canGuestBeAssignedToTable(guest, table, arrangement, allGuests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests, groupMixingRules) {
  const guestGroup = guest.customGroup || guest.group;
  const guestPolicy = groupPolicies[guestGroup];
 
  if (!arrangement[table.id] || arrangement[table.id].length === 0) {
    return true;
  }
 
  const tableGuestIds = arrangement[table.id] || [];
  const tableGuests = tableGuestIds.map(gId =>
    allGuests.find(g => g._id.toString() === gId)
  ).filter(Boolean);
 
  const tableGroups = new Set();
  tableGuests.forEach(g => {
    const tGroup = g.customGroup || g.group;
    tableGroups.add(tGroup);
  });
 
  if (tableGroups.size === 1 && tableGroups.has(guestGroup)) {
    return true;
  }
 
  if (guestPolicy === 'S') {
    return false;
  }
 
  const sGroupsInTable = tablesWithSGroupGuests.get(table.id);
  if (sGroupsInTable && sGroupsInTable.size > 0) {
    return sGroupsInTable.has(guestGroup);
  }
 
  for (const tGroup of tableGroups) {
    const tGroupPolicy = groupPolicies[tGroup];
   
    if (tGroupPolicy === 'S' && tGroup !== guestGroup) {
      return false;
    }
   
    if (!canGroupsMix(guestGroup, tGroup, mixingMode, groupMixingRules, clusterMap, groupPolicies)) {
      return false;
    }
  }
 
  return true;
}

function createAdditionalTables(neededCapacity, startingNumber, req, preferredSize = 12, existing24Tables = 0) {
  const CANVAS_HEIGHT = 1600;
  const BOUNDARY_PADDING = 150;
  const START_X = 300;
  const START_Y = 200;
  const SPACING_X = 200;
  const SPACING_Y = 180;
  const COLS = 4;
  const MAX_Y = CANVAS_HEIGHT - BOUNDARY_PADDING;
  const MAX_ROWS = Math.floor((MAX_Y - START_Y) / SPACING_Y);

  const tables = [];
  let currentNumber = startingNumber + 1;
  let remainingCapacity = neededCapacity;
  let rectangular24Created = existing24Tables; 
  const MAX_RECTANGULAR_24 = 2;

  while (remainingCapacity > 0) {
    let tableCapacity;
    let tableType;
    let width, height;

    if (remainingCapacity >= 20 && rectangular24Created < MAX_RECTANGULAR_24) {
      tableCapacity = 24;
      tableType = 'rectangular';
      width = 200;  
      height = 100;  
      rectangular24Created++;
    } else if (remainingCapacity >= preferredSize) {
      tableCapacity = preferredSize;
      tableType = preferredSize <= 12 ? 'round' : 'rectangular';
      width = preferredSize <= 12 ? 120 : 160;
      height = preferredSize <= 12 ? 120 : 100;
    } else if (remainingCapacity >= 10) {
      tableCapacity = 12;
      tableType = 'round';
      width = 120;
      height = 120;
    } else {
      tableCapacity = 10;
      tableType = 'round';
      width = 120;
      height = 120;
    }

    const tableName = req.t('seating.tableName', { number: currentNumber });

    const tableIndex = currentNumber - startingNumber - 1;
    const row = Math.floor(tableIndex / COLS);
    const col = tableIndex % COLS;
   
    const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
    const x = START_X + col * SPACING_X;

    const table = {
      id: `auto_table_${Date.now()}_${currentNumber}_${Math.random().toString(36).substr(2, 9)}`,
      name: tableName,
      type: tableType,
      capacity: tableCapacity,
      position: { x, y },
      size: {
        width: width,
        height: height
      },
      rotation: 0,
      autoCreated: true,
      createdForSync: false,
      order: currentNumber - 1
    };

    tables.push(table);
    remainingCapacity -= tableCapacity;
    currentNumber++;
  }

  tables.reverse();

  tables.forEach((table, index) => {
    table.order = index;
  });

  return tables;
}

const calculateTablesForGuests = (guestsList, availableCapacities, rectangular24Used = 0, isSeparatedSeating = false) => {

  let processedGuests = [...guestsList];
  const totalPeople = guestsList.reduce((sum, g) => sum + g.size, 0);
  const totalGuests = guestsList.length;
 
  let eventSize = 'small';
  if (totalPeople > 150 || totalGuests > 50) {
    eventSize = 'large';
  } else if (totalPeople > 50 || totalGuests > 20) {
    eventSize = 'medium';
  }
  
  const smallGuests = processedGuests.filter(g => g.size < 6);
  const mediumGuests = processedGuests.filter(g => g.size >= 6 && g.size <= 8);
  const largeGuests = processedGuests.filter(g => g.size > 8);
  const minGroupsToMerge = eventSize === 'small' ? 2 : eventSize === 'medium' ? 3 : 4;
  const maxSizeToMerge = eventSize === 'small' ? 6 : eventSize === 'medium' ? 5 : 4;
 
  if (smallGuests.length >= minGroupsToMerge) {
    const merged = [];
    const used = new Set();
   
    const candidatesForMerge = smallGuests.filter(g => g.size <= maxSizeToMerge);
    candidatesForMerge.sort((a, b) => b.size - a.size);
      
    for (let i = 0; i < candidatesForMerge.length; i++) {
      if (used.has(candidatesForMerge[i])) continue;
     
      const guest1 = candidatesForMerge[i];
      let bestMatch = null;
      let bestScore = -1;
     
      for (let j = i + 1; j < candidatesForMerge.length; j++) {
        if (used.has(candidatesForMerge[j])) continue;
       
        const guest2 = candidatesForMerge[j];
        const combined = guest1.size + guest2.size;
       
        if (combined >= 8 && combined <= 12) {
          const score = combined === 11 ? 100 : 
                       combined === 10 ? 95 :  
                       combined === 12 ? 90 : 
                       combined === 9 ? 85 :  
                       combined === 8 ? 75 :  
                       50;
         
          if (score > bestScore) {
            bestScore = score;
            bestMatch = candidatesForMerge[j];
          }
        }
      }
     
      if (bestMatch !== null) {
        used.add(guest1);
        used.add(bestMatch);

        merged.push({
          ...guest1,
          size: guest1.size + bestMatch.size,
          name: `${guest1.name} + ${bestMatch.name}`,
          _merged: true,
          _originalGuests: [guest1, bestMatch]
        });
      }
    }
   
    const unmatchedSmall = smallGuests.filter(g => !used.has(g));
    processedGuests = [...merged, ...unmatchedSmall, ...mediumGuests, ...largeGuests];
   
  } else {
  }

  const sortedGuests = [...processedGuests].sort((a, b) => b.size - a.size);
  let tables = [];
  let rect24Count = rectangular24Used;
  const placedGuests = new Set();
  const sortedCapacities = [...availableCapacities].sort((a, b) => b - a);
 
  function findOptimalCombo(targetCapacity, minUtilization = 0) {
    if (targetCapacity === 10 && minUtilization > 0.7) {
      minUtilization = 0.7;
    }
   
    const availableGuests = sortedGuests
      .filter((_, idx) => !placedGuests.has(idx));
   
    if (availableGuests.length === 0) return null;
   
    const result = findBestGuestCombination(availableGuests, targetCapacity);
   
    if (!result || result.totalSize === 0) return null;
   
    const utilization = result.totalSize / targetCapacity;
   
    if (utilization < minUtilization) return null;
   
    return {
      guests: result.guests,
      totalSize: result.totalSize,
      utilization: utilization
    };
  }

  const maxTables24 = 2;
  while (rect24Count < maxTables24 && sortedCapacities.includes(24)) {
    const totalPeople = sortedGuests
      .filter((_, idx) => !placedGuests.has(idx))
      .reduce((sum, g) => sum + g.size, 0);
   
    if (totalPeople < 23) break;
   
    const combo = findOptimalCombo(24, 0.95);  
   
    if (combo && (combo.totalSize === 23 || combo.totalSize === 24)) {
     
      tables.push({
        capacity: 24,
        remaining: 24 - combo.totalSize,
        guests: combo.guests
      });
     
      combo.guests.forEach(guest => {
        for (let i = 0; i < sortedGuests.length; i++) {
          if (sortedGuests[i] === guest && !placedGuests.has(i)) {
            placedGuests.add(i);
            break;
          }
        }
      });
     
      rect24Count++;
    } else {
      break;
    }
  }
 
  for (let i = 0; i < sortedGuests.length; i++) {
    if (placedGuests.has(i)) continue;
   
    const guest = sortedGuests[i];
   
    let placed = false;
    let bestTable = null;
    let smallestWaste = Infinity;
   
    for (const table of tables) {
      if (table.remaining >= guest.size) {
        const waste = table.remaining - guest.size;
        if (waste < smallestWaste) {
          smallestWaste = waste;
          bestTable = table;
        }
      }
    }
   
    if (bestTable) {
      bestTable.remaining -= guest.size;
      bestTable.guests.push(guest);
      placedGuests.add(i);
      placed = true;
    }
   
    if (!placed) {
      const remainingUnplaced = sortedGuests.filter((_, idx) => !placedGuests.has(idx));
      const remainingPeople = remainingUnplaced.reduce((sum, g) => sum + g.size, 0);
     
      if (remainingPeople >= 11 && remainingPeople <= 12) {
        tables.push({
          capacity: 12,
          remaining: 12 - remainingPeople,
          guests: [...remainingUnplaced]
        });
        remainingUnplaced.forEach(g => {
          for (let idx = 0; idx < sortedGuests.length; idx++) {
            if (sortedGuests[idx] === g && !placedGuests.has(idx)) {
              placedGuests.add(idx);
              break;
            }
          }
        });
        break;
      }
     
      if (remainingPeople >= 8 && remainingPeople <= 10) {
        tables.push({
          capacity: 10,
          remaining: 10 - remainingPeople,
          guests: [...remainingUnplaced]
        });
        remainingUnplaced.forEach(g => {
          for (let idx = 0; idx < sortedGuests.length; idx++) {
            if (sortedGuests[idx] === g && !placedGuests.has(idx)) {
              placedGuests.add(idx);
              break;
            }
          }
        });
        break;
      }
     
      const availableCaps = availableCapacities.filter(c => {
        if (c === 24 && rect24Count >= 2) return false;
        if (c === 24 && remainingPeople < 23) return false;
        return true;
      });
     
      let tableCapacity;
      if (availableCaps.length === 0) {
        tableCapacity = availableCapacities.filter(c => c !== 24)[0] || 12;
      } else {
        const remainingUnplaced = sortedGuests.filter((_, idx) => !placedGuests.has(idx));
       
        let bestOption = null;
        let bestScore = -1;
       
        if (availableCaps.includes(10)) {
          const combo10 = findOptimalCombo(10, 0.7);
          if (combo10 && combo10.totalSize >= 8 && combo10.totalSize <= 10) {
            const currentGuestInCombo = combo10.guests.includes(guest);
            const wouldBe100Percent = combo10.totalSize === 10;
           
            const otherUnplacedGuests = remainingUnplaced.filter(g =>
              !combo10.guests.includes(g) && g !== guest
            );
            const hasSmallGuestsRemaining = otherUnplacedGuests.some(g => g.size <= 2);
           
            if (wouldBe100Percent && !currentGuestInCombo && hasSmallGuestsRemaining && availableCaps.includes(12)) {
              const combo12 = findOptimalCombo(12, 0.7);
              if (combo12 && combo12.totalSize >= 11) {
                bestOption = { capacity: 12, combo: combo12 };
                bestScore = 999;
              } else {
                bestOption = { capacity: 10, combo: combo10 };
                bestScore = 999;
              }
            } else {
              bestOption = { capacity: 10, combo: combo10 };
              bestScore = 999;
            }
          }
        }
       
        if (!bestOption) {
          for (const cap of availableCaps) {
          const minUtilization = cap === 10 ? 0.5 : 0.75;
          const combo = findOptimalCombo(cap, minUtilization);
         
          if (combo) {
            if (cap === 12 && combo.totalSize < 11) {
              continue;
            }
            if (cap === 24 && combo.totalSize < 23) {
              continue;
            }
           
            if (combo.totalSize <= 10 && cap === 10 && combo.utilization >= 0.5) {
              bestScore = 999;
              bestOption = { capacity: cap, combo };
              break;
            }
           
            const wasteRatio = (cap - combo.totalSize) / cap;
            const utilization = combo.utilization;
           
            let score = utilization * 100;
           
            if (utilization >= 0.8) {
              score += 30; 
            }
           
            if (combo.totalSize === cap) {
              score += 50; 
            } else if (combo.totalSize >= cap - 1) {
              score += 25; 
            }
           
            const sizePreference = cap === 10 ? 1.3 : (cap === 12 ? 1.0 : 0.8);
            score *= sizePreference;
           
            if (score > bestScore) {
              bestScore = score;
              bestOption = { capacity: cap, combo };
            }
          }
        }
        }
       
        if (bestOption && bestOption.capacity === 12) {
          const totalInCombo = bestOption.combo.totalSize;
          if (totalInCombo <= 10 && availableCaps.includes(10)) {
            bestOption.capacity = 10;
            bestOption.combo.utilization = totalInCombo / 10;
          } else {
          }
        }
       
        const minAcceptableUtilization = bestOption?.capacity === 10 ? 0.7 : 0.75;
        if (bestOption && bestOption.combo.utilization >= minAcceptableUtilization) {
          tableCapacity = bestOption.capacity;
         
          const currentGuestInCombo = bestOption.combo.guests.includes(guest);
         
          let guestWasHandled = currentGuestInCombo;
         
          if (!currentGuestInCombo) {
            const wouldFitInCombo = bestOption.combo.totalSize + guest.size <= bestOption.capacity;
           
            if (wouldFitInCombo) {
              bestOption.combo.guests.push(guest);
              bestOption.combo.totalSize += guest.size;
              bestOption.combo.utilization = bestOption.combo.totalSize / bestOption.capacity;
              guestWasHandled = true;
            }
          }
         
          if (bestOption.capacity === 24) rect24Count++;
         
          tables.push({
            capacity: bestOption.capacity,
            remaining: bestOption.capacity - bestOption.combo.totalSize,
            guests: bestOption.combo.guests
          });
         
          bestOption.combo.guests.forEach(g => {
            for (let idx = 0; idx < sortedGuests.length; idx++) {
              if (sortedGuests[idx] === g && !placedGuests.has(idx)) {
                placedGuests.add(idx);
                break;
              }
            }
          });
         
          if (guestWasHandled) {
            continue;
          }
        }
             
        const fitOptions = availableCaps.filter(c => c >= guest.size);
        if (fitOptions.length > 0) {
          if (guest.size <= 10) {
            tableCapacity = 10;
          }
          else if (guest.size >= 11 && guest.size <= 12 && fitOptions.includes(12)) {
            tableCapacity = 12;
          }
          else if (guest.size >= 23 && fitOptions.includes(24)) {
            tableCapacity = 24;
          }
          else {
            let bestCapacity = null;
            let bestUtilization = 0;
           
            for (const cap of fitOptions) {     
              if (cap === 12 && guest.size < 11) {
                continue;
              }
              if (cap === 24 && guest.size < 23) continue;
             
              const utilization = guest.size / cap;
              if (utilization >= 0.6 && utilization > bestUtilization) {
                bestUtilization = utilization;
                bestCapacity = cap;
              }
            }
           
            tableCapacity = bestCapacity || Math.min(...fitOptions);
          }
        } else {
          tableCapacity = Math.max(...availableCaps);
        }
      }
     
      if (tableCapacity === 24 && guest.size < 23) {
        if (guest.size >= 11) {
          tableCapacity = 12;
        } else {
          tableCapacity = 10;
        }
      }

      if (tableCapacity === 24) rect24Count++;
     
      tables.push({
        capacity: tableCapacity,
        remaining: tableCapacity - guest.size,
        guests: [guest]
      });
      placedGuests.add(i);
    }
  }
 
  const tableSettings = {};
 
  const tablesByUtilization = tables.map((t, idx) => ({
    index: idx,
    table: t,
    used: t.guests.reduce((sum, g) => sum + g.size, 0),
    remaining: t.capacity - t.guests.reduce((sum, g) => sum + g.size, 0),
    utilization: t.guests.reduce((sum, g) => sum + g.size, 0) / t.capacity
  })).sort((a, b) => a.utilization - b.utilization);
 
  const tablesToRemove = new Set();
 
  const canMergeTables = (table1, table2) => {
    if (table1.guests.length === 0 || table2.guests.length === 0) {
      return true;
    }
   
    const groups1 = new Set(table1.guests.map(g => g.group).filter(Boolean));
    const groups2 = new Set(table2.guests.map(g => g.group).filter(Boolean));
   
    for (const guest of table1.guests) {
      if (guest.groupPolicy === 'S') {
        for (const guest2 of table2.guests) {
          if (guest2.group !== guest.group) {
            return false;
          }
        }
      }
    }
   
    for (const guest of table2.guests) {
      if (guest.groupPolicy === 'S') {
        for (const guest1 of table1.guests) {
          if (guest1.group !== guest.group) {
            return false;
          }
        }
      }
    }
   
    return true;
  };
 
  const mergeThreshold = eventSize === 'small' ? 0.75 : eventSize === 'medium' ? 0.70 : 0.65;
  const minUtilAfterMerge = eventSize === 'small' ? 0.60 : eventSize === 'medium' ? 0.65 : 0.70;
  
  for (const lowUtilTable of tablesByUtilization) {
    if (tablesToRemove.has(lowUtilTable.index)) continue;
   
    if (lowUtilTable.utilization >= mergeThreshold) break;
   
    let merged = false;
   
    let bestMerge = null;
    let bestScore = -1;
   
    for (const targetTable of tablesByUtilization) {
      if (targetTable.index === lowUtilTable.index || tablesToRemove.has(targetTable.index)) continue;
     
      if (!canMergeTables(lowUtilTable.table, targetTable.table)) continue;
     
      if (lowUtilTable.used <= targetTable.remaining) {
        const newUtilization = (targetTable.used + lowUtilTable.used) / targetTable.table.capacity;
        const score = newUtilization * 100; 
       
        if (score > bestScore) {
          bestScore = score;
          bestMerge = {
            type: 'fit',
            target: targetTable,
            newUtil: newUtilization
          };
        }
      }
     
      const combinedSize = targetTable.used + lowUtilTable.used;

      let allowedUpgrades = [10, 12, 24].filter(cap =>
        cap > targetTable.table.capacity && combinedSize <= cap
      );
     
      if (eventSize === 'small' && combinedSize <= 15) {
        allowedUpgrades = allowedUpgrades.filter(cap => cap <= 12);
      }
     
      if (allowedUpgrades.length > 0) {
        for (const newCapacity of allowedUpgrades) {
          const newUtilization = combinedSize / newCapacity;
         
          if (newCapacity === 24) {
            const maxTables24 = isSeparatedSeating ? 1 : 2;
            if (rect24Count >= maxTables24) {
              continue; 
            }
            if (combinedSize < 23) {
              continue;
            }
          }
         
          if ((newUtilization >= minUtilAfterMerge) || (combinedSize >= 11 && newCapacity === 12) || (combinedSize >= 23 && combinedSize <= 24 && newCapacity === 24)) {
            const score = newUtilization * 100 + (combinedSize === newCapacity ? 50 : 0); 
           
            if (score > bestScore) {
              bestScore = score;
              bestMerge = {
                type: 'upgrade',
                target: targetTable,
                newCapacity: newCapacity,
                newUtil: newUtilization
              };
            }
            break; 
          }
        }
      }
    }
   
    if (bestMerge) {
      if (bestMerge.type === 'fit') {
       
        bestMerge.target.table.guests.push(...lowUtilTable.table.guests);
        bestMerge.target.used += lowUtilTable.used;
        bestMerge.target.remaining -= lowUtilTable.used;
        bestMerge.target.utilization = bestMerge.newUtil;
       
        tablesToRemove.add(lowUtilTable.index);
        merged = true;
      } else if (bestMerge.type === 'upgrade') {
       
        bestMerge.target.table.capacity = bestMerge.newCapacity;
        if (bestMerge.newCapacity === 24 && bestMerge.target.table.capacity !== 24) {
          rect24Count++;
        }
        bestMerge.target.table.guests.push(...lowUtilTable.table.guests);
        bestMerge.target.used += lowUtilTable.used;
        bestMerge.target.remaining = bestMerge.newCapacity - (bestMerge.target.used + lowUtilTable.used);
        bestMerge.target.utilization = bestMerge.newUtil;
       
        tablesToRemove.add(lowUtilTable.index);
        merged = true;
      }
    }
  }
  
  if (tablesToRemove.size > 0) {
    tables = tables.filter((_, idx) => !tablesToRemove.has(idx));
  }
 
  tables.forEach((table, idx) => {
    const guestGroups = [...new Set(table.guests.map(g => g.group))];
    const hasSPolicy = table.guests.some(g => g.groupPolicy === 'S');
  });
 
  tables.forEach(table => {
    if (!tableSettings[table.capacity]) {
      tableSettings[table.capacity] = 0;
    }
    tableSettings[table.capacity]++;
  });
 
  return { tables, tableSettings, rectangular24Used: rect24Count };
};

function fillFullTablesForGroup(
  guestsPool,
  availableTables,
  arrangement,
  alreadyAssigned,
  preferredSize,
  preferences,
  allGuests,
  groupInfo = null,
  temporarilyReservedTables = []
) {
 
  const filledTables = [];
 
  guestsPool = guestsPool.filter(g =>
    g && g._id && !alreadyAssigned.has(g._id.toString())
  );
 
  const emptyTables = availableTables.filter(t => {
    const isReallyEmpty = !arrangement[t.id] || arrangement[t.id].length === 0;
    const hasNoAssignedGuests = !t.assignedGuests || t.assignedGuests.length === 0;
    return isReallyEmpty && hasNoAssignedGuests;
  });
 
  const totalPeople = guestsPool.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
 
  const largestGuest = guestsPool.reduce((max, g) => {
    const gSize = g.attendingCount || 1;
    const maxSize = max ? (max.attendingCount || 1) : 0;
    return gSize > maxSize ? g : max;
  }, null);
 
  const largestGuestSize = largestGuest ? (largestGuest.attendingCount || 1) : 0;
 
  let tablesToSort = emptyTables;
  if (totalPeople < 23) {
    tablesToSort = emptyTables.filter(t => t.capacity !== 24);
    if (tablesToSort.length < emptyTables.length) {
    }
  }

  tablesToSort.sort((a, b) => {
    const aCanFitLargest = a.capacity >= largestGuestSize;
    const bCanFitLargest = b.capacity >= largestGuestSize;
   
    if (aCanFitLargest && !bCanFitLargest) return -1;
    if (!aCanFitLargest && bCanFitLargest) return 1;
   
    const aCanFitAll = a.capacity >= totalPeople;
    const bCanFitAll = b.capacity >= totalPeople;
   
    if (aCanFitAll && bCanFitAll) {
      const aUtilization = totalPeople / a.capacity;
      const bUtilization = totalPeople / b.capacity;
      const aGoodUtil = aUtilization >= 0.7;
      const bGoodUtil = bUtilization >= 0.7;
     
      if (aGoodUtil && !bGoodUtil) return -1;
      if (!aGoodUtil && bGoodUtil) return 1;
     
      if (aGoodUtil && bGoodUtil) {
        const utilizationDiff = bUtilization - aUtilization;
        if (Math.abs(utilizationDiff) > 0.05) { 
          return utilizationDiff;  
        }
       
        const preferredSize = preferences?.preferredTableSize || 12;
        const aDiff = Math.abs(a.capacity - preferredSize);
        const bDiff = Math.abs(b.capacity - preferredSize);
        if (aDiff !== bDiff) {
          return aDiff - bDiff;  
        }
      }
     
      const capDiff = a.capacity - b.capacity;
      if (capDiff !== 0) return capDiff;
      return a.name.localeCompare(b.name);
    }
   
    if (aCanFitAll && !bCanFitAll) return -1;
    if (!aCanFitAll && bCanFitAll) return 1;
   
    const aMaxPeople = Math.min(totalPeople, a.capacity);
    const bMaxPeople = Math.min(totalPeople, b.capacity);
    const aMaxUtil = aMaxPeople / a.capacity;
    const bMaxUtil = bMaxPeople / b.capacity;
   
    if (Math.abs(aMaxUtil - bMaxUtil) > 0.05) {
      return bMaxUtil - aMaxUtil;  
    }
   
    const capDiff = a.capacity - b.capacity;
    if (capDiff !== 0) return capDiff;
    return a.name.localeCompare(b.name);
  });
 
  for (const table of tablesToSort) {
    if (guestsPool.length === 0) break;
     
    const bestCombination = findBestGuestCombination(guestsPool, table.capacity);
   
    if (bestCombination.guests.length === 0) {
      continue;
    }
   
    const utilizationRate = (bestCombination.totalSize / table.capacity) * 100;
   
    let shouldFillTable = false;
    const currentEmptyTableIndex = emptyTables.indexOf(table);
   
    const reservedTablesCount = (typeof temporarilyReservedTables !== 'undefined') ? temporarilyReservedTables.length : 0;
    const totalEmptyTablesIncludingReserved = emptyTables.length + reservedTablesCount;
    const isLastTable = (currentEmptyTableIndex === emptyTables.length - 1) && (reservedTablesCount === 0);
     
    const isPerfectFit = utilizationRate === 100;
    const isGoodUtilization = utilizationRate >= 70;
    const isReasonableUtilization = utilizationRate >= 60;
   
    const remainingPeopleAfter = totalPeople - bestCombination.totalSize;
   
    let hasUnmixableRemainder = false;
    if (groupInfo && remainingPeopleAfter > 0 && remainingPeopleAfter < table.capacity * 0.6) {
      const canMixWith = groupInfo.canMixWith || [];
      if (canMixWith.length === 0) {
        hasUnmixableRemainder = true;
       
        if (groupInfo.type === 'separate') {
          return {
            filledTables: [],
            remainingGuests: guestsPool
          };
        }
      }
    }
   
    if (isPerfectFit) {
      shouldFillTable = true;
    } else if (isGoodUtilization) {
      shouldFillTable = true;
    } else if (hasUnmixableRemainder && !isLastTable) {
      shouldFillTable = false;
    } else if (isLastTable && guestsPool.length > 0) {
      shouldFillTable = true;
    } else if (isReasonableUtilization && remainingPeopleAfter <= table.capacity * 0.7) {
      shouldFillTable = true;
    }
   
    if (shouldFillTable) {
    if (table.capacity === 24 && bestCombination.totalSize < 23) {
      shouldFillTable = false;
    }
  }

  if (shouldFillTable) {
  if (table.capacity === 12 && bestCombination.totalSize < 11) {
        table.capacity = 10;
        table.remainingCapacity = 10 - bestCombination.totalSize;
      } else if (table.capacity === 12) {
      }
     
      bestCombination.guests.forEach(guest => {
        const success = assignGuestToTableAdvanced(
          guest,
          table,
          arrangement,
          availableTables,
          preferences,
          allGuests,
          alreadyAssigned,
          { t: (key) => key }
        );

      });
     
      filledTables.push({
        tableId: table.id,
        tableName: table.name,
        guests: bestCombination.guests,
        utilization: utilizationRate
      });
     
      guestsPool = guestsPool.filter(g =>
        !bestCombination.guests.find(fg => fg._id.toString() === g._id.toString())
      );
     
    } else {
    }
  }
 
  return {
    filledTables,
    remainingGuests: guestsPool
  };
}

function findBestGuestCombination(guests, tableCapacity) {
  if (guests.length === 0) {
    return { guests: [], totalSize: 0 };
  }
 
  const n = guests.length;
 
  const dp = Array(n + 1).fill(null).map(() => Array(tableCapacity + 1).fill(0));
 
  for (let i = 1; i <= n; i++) {
    const guest = guests[i - 1];
    const guestSize = guest.attendingCount || 1;
   
    for (let w = 0; w <= tableCapacity; w++) {
      dp[i][w] = dp[i - 1][w];
     
      if (guestSize <= w) {
        const withGuest = dp[i - 1][w - guestSize] + guestSize;
        if (withGuest > dp[i][w]) {
          dp[i][w] = withGuest;
        }
      }
    }
  }
 
  const bestSize = dp[n][tableCapacity];
 
  const selectedGuests = [];
  let w = tableCapacity;
  for (let i = n; i > 0 && w > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      const guest = guests[i - 1];
      selectedGuests.push(guest);
      const guestSize = guest.attendingCount || 1;
      w -= guestSize;
    }
  }
 
  selectedGuests.reverse();
 
  return {
    guests: selectedGuests,
    totalSize: bestSize
  };
}

function calculateNextTablePositionForGender(existingTables) {
  const SPACING = 200;
  const COLS = 3;
 
  if (!existingTables || existingTables.length === 0) {
    return { x: 300, y: 250 };
  }
 
  let minX = Infinity;
  let minY = Infinity;
 
  existingTables.forEach(table => {
    if (table && table.position) {
      if (table.position.x < minX) minX = table.position.x;
      if (table.position.y < minY) minY = table.position.y;
    }
  });
 
  if (minX === Infinity || minY === Infinity) {
    return { x: 300, y: 250 };
  }
 
  const occupiedPositions = new Set();
  existingTables.forEach(table => {
    if (table && table.position) {
      const posKey = `${Math.round(table.position.x)},${Math.round(table.position.y)}`;
      occupiedPositions.add(posKey);
    }
  });
 
  let position = 0;
  while (position < 100) {
    const row = Math.floor(position / COLS);
    const col = position % COLS;
    const x = minX + col * SPACING;
    const y = minY + row * SPACING;
    const posKey = `${x},${y}`;
   
    if (!occupiedPositions.has(posKey)) {
      return { x, y };
    }
    position++;
  }
 
  const tableCounter = existingTables.length;
  return {
    x: minX + (tableCounter % COLS) * SPACING,
    y: minY + Math.floor(tableCounter / COLS) * SPACING
  };
}

function calculateNextTablePosition(existingTables, gender = null) {

  if (gender && typeof gender === 'object') {
    if (gender.value) gender = gender.value;
    else gender = String(gender);
  }

  const CANVAS_WIDTH = 2400;
  const CANVAS_HEIGHT = 1600;
  const BOUNDARY_PADDING = 150;
 
  const MALE_START_X = 300;
  const FEMALE_START_X = 1300;  
  const DEFAULT_START_Y = 280;
  const DEFAULT_SPACING_X = 200; 
  const DEFAULT_SPACING_Y = 180;  
  const COLS = 4;  
  const START_X = gender === 'female' ? FEMALE_START_X : MALE_START_X;
 
  if (!existingTables || existingTables.length === 0) {
    return { x: START_X, y: DEFAULT_START_Y };
  }
 
  let relevantTables = existingTables;
  if (gender) {
    const genderStr = String(gender);
    relevantTables = existingTables.filter(t => !t.gender || String(t.gender) === genderStr);
  }

  let minX = Infinity, minY = Infinity;
  const xPositions = new Set();
  const yPositions = new Set();
  
  relevantTables.forEach(table => {
    if (table && table.position) {
      const x = Math.round(table.position.x);
      const y = Math.round(table.position.y);
      xPositions.add(x);
      yPositions.add(y);
      if (x < minX) minX = x;
      if (y < minY) minY = y;
    }
  });

  if (minX === Infinity || minY === Infinity) {
    return { x: START_X, y: DEFAULT_START_Y };
  }

  const sortedX = [...xPositions].sort((a, b) => a - b);
  const sortedY = [...yPositions].sort((a, b) => a - b);
  
  let spacingX = DEFAULT_SPACING_X;
  let spacingY = DEFAULT_SPACING_Y;
  
  if (sortedX.length >= 2) {
    spacingX = sortedX[1] - sortedX[0];
  }
  if (sortedY.length >= 2) {
    spacingY = sortedY[1] - sortedY[0];
  }

  const occupiedPositions = new Set();
  relevantTables.forEach(table => {
    if (table && table.position) {
      const posKey = `${Math.round(table.position.x)},${Math.round(table.position.y)}`;
      occupiedPositions.add(posKey);
    }
  });

  const MAX_Y = CANVAS_HEIGHT - BOUNDARY_PADDING;
  const MAX_ROWS = Math.floor((MAX_Y - minY) / spacingY) + 1;
  const maxPositions = COLS * MAX_ROWS;
 
  let position = 0;
  while (position < maxPositions) {
    const row = Math.floor(position / COLS);
    const col = position % COLS;
    const x = minX + col * spacingX;
    const y = minY + row * spacingY;
    const posKey = `${x},${y}`;
    
    if (!occupiedPositions.has(posKey)) {
      return { x, y };
    }
    position++;
  }
 
  const maxExistingY = Math.max(...sortedY);
  const newY = maxExistingY + spacingY;
  
  return { x: minX, y: newY };
}

function generateOptimalSeating(guests, tables, preferences, gender = null) {
 
  if (gender && typeof gender === 'object') {
    gender = String(gender);
  }

  const originalTableNumbers = new Map();
  tables.forEach((table) => {
    const match = table.name.match(/\d+/);
    if (match) {
      originalTableNumbers.set(table.id, parseInt(match[0]));
    }
  });

  tables.sort((a, b) => {
    if (a.order !== undefined && b.order !== undefined) {
      return a.order - b.order;
    }
    if (a.capacity !== b.capacity) {
      return a.capacity - b.capacity;
    }
    const aNum = originalTableNumbers.get(a.id) || 0;
    const bNum = originalTableNumbers.get(b.id) || 0;
    return aNum - bNum;
  });

  tables.forEach(table => {
    if (table.capacity === 12 && table.assignedGuests && table.assignedGuests.length > 0) {
      const tableGuests = table.assignedGuests.map(gId =>
        guests.find(g => g._id.toString() === gId)
      ).filter(Boolean);
      const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    
      if (totalPeople < 11) {
        table.capacity = 10;
        table.remainingCapacity = 10 - totalPeople;
      }
    }
  });

  if (tables.length === 0 && guests.length > 0 && !preferences.noNewTables) {
    const totalPeople = guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    let tableNumber = 1;
    let remainingPeople = totalPeople;
   
    let tables24Count = 0;
    const MAX_TABLES_24 = gender ? 1 : 2;
   
    const largestGuestSize = guests.reduce((max, g) => {
      return Math.max(max, g.attendingCount || 1);
    }, 0);
   
    const possibleTables24 = Math.min(
      Math.floor(totalPeople / 23),  
      MAX_TABLES_24  
    );

    for (let i = 0; i < possibleTables24 && tables24Count < MAX_TABLES_24; i++) {
      if (remainingPeople >= 23) {
        const newTablePosition = calculateNextTablePosition(tables, gender);
        const peopleForThisTable = Math.min(24, remainingPeople);
              
        tables.push({
          id: `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`,
          name: `שולחן ${tableNumber}`,
          capacity: 24,
          type: 'rectangular',
          position: newTablePosition,
          rotation: 0,
          size: {
            width: 160,
            height: 100
          },
          assignedGuests: [],
          remainingCapacity: 24,
          gender: gender
        });
       
        remainingPeople -= peopleForThisTable;
        tables24Count++;
        tableNumber++;
      }
    }
   
    while (remainingPeople > 0) {
      let capacity = 12;
     
      const newTablePosition = calculateNextTablePosition(tables, gender);
      tables.push({
        id: `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`,
        name: `שולחן ${tableNumber}`,
        capacity: capacity,
        type: 'round',
        position: newTablePosition,
        rotation: 0,
        size: {
          width: 120,
          height: 120
        },
        assignedGuests: [],
        remainingCapacity: capacity,
        gender: gender
      });
     
      remainingPeople -= capacity;
      tableNumber++;
     
      if (tableNumber > 100) {
        break;
      }
    }
   
  }

  const mixingMode = determineMixingMode(preferences);
 
  const arrangement = {};
  const availableTables = tables.map(table => {
    const existingGuests = table.assignedGuests || [];
    const existingPeople = existingGuests.reduce((sum, gId) => {
      const guest = guests.find(g => g._id.toString() === gId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
   
    return {
      ...table,
      remainingCapacity: table.capacity - existingPeople,
      assignedGuests: [...existingGuests]
    };
  });

  const alreadyAssigned = new Set();

  availableTables.forEach(table => {
    if (table.assignedGuests && table.assignedGuests.length > 0) {
      arrangement[table.id] = [...table.assignedGuests];
      table.assignedGuests.forEach(gId => alreadyAssigned.add(gId));
    }
  });

  const clusterMap = mixingMode === 'rules' ? buildMixingClusters(preferences.groupMixingRules) : new Map();

  const groupPolicies = preferences.groupPolicies || {};
  const separateGroupsList = [];
  const separateGroupSizes = {};
 
  guests.forEach(guest => {
    if (!guest || !guest._id) return;
    const group = guest.customGroup || guest.group;
    const policy = groupPolicies[group];
    if (policy === 'S') {
      if (!separateGroupSizes[group]) {
        separateGroupSizes[group] = 0;
        separateGroupsList.push(group);
      }
      separateGroupSizes[group] += (guest.attendingCount || 1);
    }
  });

  const reservedTablesForSGroups = new Map();
  const reservedTableIds = new Set();
 
  separateGroupsList.forEach(groupName => {
  const groupSize = separateGroupSizes[groupName];
 
  const suitableTable = availableTables.find(table =>
    !reservedTableIds.has(table.id) &&
    table.assignedGuests.length === 0 &&
    table.capacity >= groupSize
  );
 
  if (suitableTable) {
    reservedTablesForSGroups.set(groupName, suitableTable.id);
    reservedTableIds.add(suitableTable.id);
  } else {
  }
});

  if (preferences.seatingRules && preferences.seatingRules.mustSitTogether) {
    preferences.seatingRules.mustSitTogether.forEach(rule => {
      const guest1 = guests.find(g => g._id.toString() === rule.guest1Id);
      const guest2 = guests.find(g => g._id.toString() === rule.guest2Id);
     
      if (guest1 && guest2 && !alreadyAssigned.has(guest1._id.toString()) && !alreadyAssigned.has(guest2._id.toString())) {
        const totalSize = (guest1.attendingCount || 1) + (guest2.attendingCount || 1);
       
        const suitableTable = availableTables.find(table =>
          !reservedTableIds.has(table.id) &&
          table.remainingCapacity >= totalSize &&
          !hasSeparationConflicts([guest1, guest2], table, preferences, guests)
        );
       
        if (suitableTable) {
          assignGuestToTableAdvanced(guest1, suitableTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
          assignGuestToTableAdvanced(guest2, suitableTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        }
      }
    });
  }

  const unreservedTables = availableTables.filter(t => !reservedTableIds.has(t.id));
  unreservedTables.sort((a, b) => {
    if (a.capacity === preferences.preferredTableSize && b.capacity !== preferences.preferredTableSize) return -1;
    if (b.capacity === preferences.preferredTableSize && a.capacity !== preferences.preferredTableSize) return 1;
    return Math.abs(preferences.preferredTableSize - a.capacity) - Math.abs(preferences.preferredTableSize - b.capacity);
  });

  const groupedGuests = {};
  guests.forEach(guest => {
    if (!guest || !guest._id) return;
    if (alreadyAssigned.has(guest._id.toString())) return;
    const group = guest.customGroup || guest.group;
    if (!groupedGuests[group]) groupedGuests[group] = [];
    groupedGuests[group].push(guest);
  });

  Object.entries(groupedGuests).forEach(([groupName, guestList]) => {
    const totalPeople = guestList.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const policy = (preferences.groupPolicies || {})[groupName] || 'none';
  });

  const sortedGroups = Object.entries(groupedGuests).sort((a, b) => {
    const aTotal = a[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const bTotal = b[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    return bTotal - aTotal;
  });

  sortedGroups.forEach(([, guestList]) => {
    guestList.sort((a, b) => (b.attendingCount || 1) - (a.attendingCount || 1));
  });

  sortedGroups.sort((a, b) => {
    const [groupNameA] = a;
    const [groupNameB] = b;
    return groupNameA.localeCompare(groupNameB);
  });

  const globalUsedTableIds = new Set();

  const hasMixingRules = preferences.groupMixingRules && preferences.groupMixingRules.length > 0;
 
  if (preferences.allowGroupMixing && hasMixingRules) {

    preferences.groupMixingRules.forEach(rule => {
    });
   
    const mixableGroupPairs = new Set();
    preferences.groupMixingRules.forEach(rule => {
      mixableGroupPairs.add(`${rule.group1}|${rule.group2}`);
      mixableGroupPairs.add(`${rule.group2}|${rule.group1}`);
    });
   
    const groupsInMixingRules = new Set();
    preferences.groupMixingRules.forEach(rule => {
      const policy1 = groupPolicies[rule.group1];
      const policy2 = groupPolicies[rule.group2];
     
      if (policy1 !== 'S') {
        groupsInMixingRules.add(rule.group1);
      }
      if (policy2 !== 'S') {
        groupsInMixingRules.add(rule.group2);
      }
    });
     
    const mixableGuestsByGroup = new Map();
    const nonMixableGroups = new Map();
    const separateGroups = new Map();
   
    sortedGroups.forEach(([groupName, groupGuests]) => {
    const groupPolicy = groupPolicies[groupName];
    const unassigned = groupGuests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
     
    if (groupPolicy === 'S') {
      separateGroups.set(groupName, unassigned);
    } else if (groupsInMixingRules.has(groupName)) {
      mixableGuestsByGroup.set(groupName, unassigned);
    } else if (groupPolicy === 'M') {
      mixableGuestsByGroup.set(groupName, unassigned);
    } else {
      nonMixableGroups.set(groupName, unassigned);
    }
  });

    const mPolicyGroups = [];
    sortedGroups.forEach(([groupName]) => {
      const groupPolicy = groupPolicies[groupName];
      if (groupPolicy === 'M' && !groupsInMixingRules.has(groupName)) {
        mPolicyGroups.push(groupName);
      }
    });
   
    for (let i = 0; i < mPolicyGroups.length; i++) {
      for (let j =
i + 1; j < mPolicyGroups.length; j++) {
        mixableGroupPairs.add(`${mPolicyGroups[i]}|${mPolicyGroups[j]}`);
        mixableGroupPairs.add(`${mPolicyGroups[j]}|${mPolicyGroups[i]}`);
      }
    }
   
    const allGroupsSorted = [];
   
    separateGroups.forEach((groupGuests, groupName) => {
    const totalPeople = groupGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    allGroupsSorted.push({
      name: groupName,
      guests: groupGuests,
      totalPeople,
      type: 'separate',
      canMixWith: []
    });
  });

  nonMixableGroups.forEach((groupGuests, groupName) => {
    const totalPeople = groupGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    allGroupsSorted.push({
      name: groupName,
      guests: groupGuests,
      totalPeople,
      type: 'non-mixable',
      canMixWith: []
    });
  });

  mixableGuestsByGroup.forEach((groupGuests, groupName) => {
    const totalPeople = groupGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
   
    const canMixWith = [];
    mixableGuestsByGroup.forEach((_, otherGroupName) => {
      if (otherGroupName !== groupName &&
          mixableGroupPairs.has(`${groupName}|${otherGroupName}`)) {
        canMixWith.push(otherGroupName);
      }
    });
   
    allGroupsSorted.push({
      name: groupName,
      guests: groupGuests,
      totalPeople,
      type: 'mixable',
      canMixWith
    });
  });
   
    allGroupsSorted.sort((a, b) => {
      const sizeDiff = b.totalPeople - a.totalPeople;
      if (sizeDiff !== 0) return sizeDiff;
      return a.name.localeCompare(b.name);
    });
     
    allGroupsSorted.forEach((group, index) => {
    });

    const preferredTableSize = preferences.preferredTableSize || 12;
    const totalAvailableTables = availableTables.length;
    const totalPeopleToSeat = allGroupsSorted.reduce((sum, g) => sum + g.totalPeople, 0);

    const groupTableRequirements = new Map();
    allGroupsSorted.forEach(group => {
      const minTablesNeeded = Math.ceil(group.totalPeople / preferredTableSize);
      groupTableRequirements.set(group.name, {
        minTables: minTablesNeeded,
        totalPeople: group.totalPeople,
        type: group.type
      });
    });
   
    const reservedTablesForGroups = new Map();
    let tablesReservedCount = 0;
   
    const clusterGroupsForReservation = new Map();
    const groupToClusterForReservation = new Map();
   
    if (mixingMode === 'rules' && clusterMap.size > 0) {
      clusterMap.forEach((clusterId, groupName) => {
        if (!clusterGroupsForReservation.has(clusterId)) {
          clusterGroupsForReservation.set(clusterId, []);
        }
        clusterGroupsForReservation.get(clusterId).push(groupName);
        groupToClusterForReservation.set(groupName, clusterId);
      });
    } else {
      allGroupsSorted.forEach(group => {
        const clusterId = `cluster_${group.name}`;
        clusterGroupsForReservation.set(clusterId, [group.name]);
        groupToClusterForReservation.set(group.name, clusterId);
      });
    }
   
    const clustersNeedingReservation = new Set();
    clusterGroupsForReservation.forEach((groupNames, clusterId) => {
      let clusterTotalPeople = 0;
      let clusterHasRemainders = false;
     
      groupNames.forEach(groupName => {
        const group = allGroupsSorted.find(g => g.name === groupName);
        if (!group) return;
       
        const requirements = groupTableRequirements.get(groupName);
        const canFillPerfectly = (group.totalPeople % preferredTableSize === 0);
       
        clusterTotalPeople += group.totalPeople;
       
        if (!canFillPerfectly && requirements.minTables > 0) {
          const fullTablesCapacity = Math.floor(group.totalPeople / preferredTableSize) * preferredTableSize;
          const remainingPeople = group.totalPeople - fullTablesCapacity;
         
          if (remainingPeople > 0 && remainingPeople < preferredTableSize * 0.7) {
            clusterHasRemainders = true;
          }
        }
      });
     
      if (clusterHasRemainders && !clustersNeedingReservation.has(clusterId)) {
        clustersNeedingReservation.add(clusterId);
        tablesReservedCount += 1;
      }
    });
   
    const temporarilyReservedTables = [];
    if (tablesReservedCount > 0) {
      for (let i = 0; i < tablesReservedCount && i < availableTables.length; i++) {
        const table = availableTables[availableTables.length - 1 - i];
        temporarilyReservedTables.push(table);
      }
     
      temporarilyReservedTables.forEach(table => {
        const index = availableTables.findIndex(t => t.id === table.id);
        if (index !== -1) {
          availableTables.splice(index, 1);
        }
      });
     
    }
   
    const remainingGuestsByGroup = new Map();

    allGroupsSorted.forEach(group => {
      group.totalPeople = group.guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    });
   
    allGroupsSorted.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    allGroupsSorted.forEach(groupInfo => {
  const hasCustomMixingRules = preferences.groupMixingRules && preferences.groupMixingRules.length > 0;
 
  if (hasCustomMixingRules && groupInfo.type === 'mixable') {
    remainingGuestsByGroup.set(groupInfo.name, {
      guests: groupInfo.guests.filter(g => !alreadyAssigned.has(g._id.toString())),
      type: groupInfo.type,
      canMixWith: groupInfo.canMixWith
    });
  } else {
    const result = fillFullTablesForGroup(
      groupInfo.guests,
      availableTables,
      arrangement,
      alreadyAssigned,
      preferences.preferredTableSize || 12,
      preferences,
      guests,
      groupInfo,
      temporarilyReservedTables
    );

    if (result.remainingGuests.length > 0) {
      remainingGuestsByGroup.set(groupInfo.name, {
        guests: result.remainingGuests,
        type: groupInfo.type,
        canMixWith: groupInfo.canMixWith
      });
    }
  }
});
   
    if (temporarilyReservedTables.length > 0) {
      temporarilyReservedTables.forEach(table => {
        availableTables.push(table);
      });
    }
     
    const mixableRemainingGuests = [];
    remainingGuestsByGroup.forEach((groupInfo, groupName) => {
      if (groupInfo.type === 'mixable') {
        groupInfo.guests.forEach(guest => {
          mixableRemainingGuests.push({ guest, groupName, canMixWith: groupInfo.canMixWith });
        });
      }
    });
     
    if (mixableRemainingGuests.length > 0) {
      mixableRemainingGuests.sort((a, b) => {
        const sizeDiff = (b.guest.attendingCount || 1) - (a.guest.attendingCount || 1);
        if (sizeDiff !== 0) return sizeDiff;
        const nameA = `${a.guest.firstName} ${a.guest.lastName}`;
        const nameB = `${b.guest.firstName} ${b.guest.lastName}`;
        return nameA.localeCompare(nameB);
      });
     
      const emptyTables = availableTables.filter(t =>
        (!arrangement[t.id] || arrangement[t.id].length === 0) &&
        (!t.assignedGuests || t.assignedGuests.length === 0)
      );
     
      const totalMixablePeople = mixableRemainingGuests.reduce((sum, item) => sum + (item.guest.attendingCount || 1), 0);
     
      const existing24Tables = availableTables.filter(t => t.capacity === 24).length;
      const maxTables24 = gender ? 1 : 2; 
          
      if (totalMixablePeople >= 23 && existing24Tables < maxTables24) {
       
        const newTablePosition = calculateNextTablePosition(availableTables, gender);
        const tableNumber = availableTables.length + 1;
       
        const newTable24 = {
          id: `temp_mix_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`,
          name: `שולחן ${tableNumber}`,
          capacity: 24,
          type: 'rectangular',
          position: newTablePosition,
          rotation: 0,
          size: {
            width: 160,
            height: 100
          },
          assignedGuests: [],
          remainingCapacity: 24,
          gender: gender || null  
        };
       
        availableTables.push(newTable24);
        emptyTables.push(newTable24);
       
      }

      emptyTables.sort((a, b) => {
        const remainingPeopleNow = mixableRemainingGuests.filter(item => !alreadyAssigned.has(item.guest._id.toString()))
          .reduce((sum, item) => sum + (item.guest.attendingCount || 1), 0);
       
        if (remainingPeopleNow >= 23) {
          if (a.capacity === 24 && b.capacity !== 24) {
            return -1; 
          }
          if (b.capacity === 24 && a.capacity !== 24) {
            return 1; 
          }
        }
       
        const aDiff = Math.abs(a.capacity - (preferences.preferredTableSize || 12));
        const bDiff = Math.abs(b.capacity - (preferences.preferredTableSize || 12));
        const diffDiff = aDiff - bDiff;
        if (diffDiff !== 0) return diffDiff;
        return a.name.localeCompare(b.name);
      });
     
      for (const table of emptyTables) {
      const stillRemaining = mixableRemainingGuests.filter(item =>
        !alreadyAssigned.has(item.guest._id.toString())
      );

      if (stillRemaining.length === 0) break;

      if (table.capacity === 24) {
        const totalRemainingPeople = stillRemaining.reduce((sum, item) => sum + (item.guest.attendingCount || 1), 0);
        if (totalRemainingPeople < 23) {
          continue; 
        }
      }

      let currentCapacity = 0;

      for (const item of stillRemaining) {
          const guestSize = item.guest.attendingCount || 1;
          const guestGroup = item.guest.customGroup || item.guest.group;

          if (currentCapacity + guestSize <= table.capacity) {
            const tableGuestIds = arrangement[table.id] || [];
            const canMixWithTable = tableGuestIds.every(existingGuestId => {
              const existingGuest = guests.find(g => g._id.toString() === existingGuestId);
              if (!existingGuest) return true;

              const existingGroup = existingGuest.customGroup || existingGuest.group;
              if (existingGroup === guestGroup) return true;

              return mixableGroupPairs.has(`${guestGroup}|$
{existingGroup}`)
;
            });

            if (canMixWithTable) {
              if (!arrangement[table.id]) {
                arrangement[table.id] = [];
              }
              arrangement[table.id].push(item.guest._id.toString());
              table.assignedGuests.push(item.guest._id.toString());
              table.remainingCapacity -= guestSize;
              alreadyAssigned.add(item.guest._id.toString());

              currentCapacity += guestSize;
            }
          }

          if (table.capacity === 24) {
            if (currentCapacity >= 23) {
              break; 
            }
          } else if (currentCapacity >= table.capacity * 0.95) {
            break; 
          }
        }
       
        if (table.capacity === 24 && currentCapacity < 23) {
         
          const assignedGuestIds = arrangement[table.id] || [];
          assignedGuestIds.forEach(guestId => {
            alreadyAssigned.delete(guestId);
          });
         
          arrangement[table.id] = [];
          table.assignedGuests = [];
          table.remainingCapacity = 24;
        }
      }
       
      const stillUnassignedMixable = mixableRemainingGuests.filter(item =>
        !alreadyAssigned.has(item.guest._id.toString())
      );
     
      stillUnassignedMixable.forEach(item => {
        const guest = item.guest;
        const guestSize = guest.attendingCount || 1;
        const guestGroup = guest.customGroup || guest.group;
       
        const sortedTables = [...availableTables].sort((a, b) => {
          const aHasCompatibleGroup = a.assignedGuests.some(gId => {
            const g = guests.find(guest => guest._id.toString() === gId);
            if (!g) return false;
            const otherGroup = g.customGroup || g.group;
            return otherGroup === guestGroup || mixableGroupPairs.has(`${guestGroup}|${otherGroup}`);
          });
         
          const bHasCompatibleGroup = b.assignedGuests.some(gId => {
            const g = guests.find(guest => guest._id.toString() === gId);
            if (!g) return false;
            const otherGroup = g.customGroup || g.group;
            return otherGroup === guestGroup || mixableGroupPairs.has(`${guestGroup}|${otherGroup}`);
          });
         
          if (aHasCompatibleGroup && !bHasCompatibleGroup) return -1;
          if (!aHasCompatibleGroup && bHasCompatibleGroup) return 1;
         
          const wasteA = Math.abs(a.remainingCapacity - guestSize);
          const wasteB = Math.abs(b.remainingCapacity - guestSize);
          return wasteA - wasteB;
        });
       
        for (const table of sortedTables) {
          const tableGuestsForCapacity = (arrangement[table.id] || []).map(gId =>
            guests.find(g => g._id.toString() === gId)
          ).filter(Boolean);
          const currentOccupancy = tableGuestsForCapacity.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          const actualRemainingCapacity = table.capacity - currentOccupancy;

          if (actualRemainingCapacity >= guestSize) {
            const tableGuestIds = arrangement[table.id] || [];
            const tableGuests = tableGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId)
            ).filter(Boolean);
           
            let canMix = true;
            for (const tableGuest of tableGuests) {
              const tableGroup = tableGuest.customGroup || tableGuest.group;
              if (tableGroup === guestGroup) continue;
             
              if (!mixableGroupPairs.has(`${guestGroup}|${tableGroup}`)) {
                canMix = false;
                break;
              }
            }
           
            if (canMix) {
              const assignResult = assignGuestToTableAdvanced(
                guest,
                table,
                arrangement,
                availableTables,
                preferences,
                guests,
                alreadyAssigned,
                { t: (key) => key }
              );
                         
              if (assignResult) {
                break;
              }
            }
          }
        }
      });
    }
   
      const isMixable = (groupName) => {
        const policy = groupPolicies[groupName];
        if (policy === 'S') return false;
        if (policy === 'M') return true;
        return groupsInMixingRules.has(groupName);
      };

      const canMix = (group1, group2) => {
        if (group1 === group2) return true;
        return mixableGroupPairs.has(`${group1}|${group2}`);
      };

      const MIN_UTILIZATION_FOR_MERGE = 0.6;

      const tablesWithGuests = availableTables.filter(t => {
        const guestIds = arrangement[t.id] || [];
        return guestIds.length > 0;
      });

      tablesWithGuests.sort((a, b) => {
        const aGuestIds = arrangement[a.id] || [];
        const aGuests = aGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const aPeople = aGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const aUtil = aPeople / a.capacity;

        const bGuestIds = arrangement[b.id] || [];
        const bGuests = bGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const bPeople = bGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const bUtil = bPeople / b.capacity;

        return aUtil - bUtil;
      });


      for (let i = 0; i < tablesWithGuests.length; i++) {
        const table1 = tablesWithGuests[i];
        const table1GuestIds = arrangement[table1.id] || [];
        const table1Guests = table1GuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const table1People = table1Guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const table1Utilization = table1People / table1.capacity;

        if (table1Utilization > MIN_UTILIZATION_FOR_MERGE) {
          continue;
        }

        const table1Groups = [...new Set(table1Guests.map(g => g.customGroup || g.group))];
        const allMixable = table1Groups.every(g => isMixable(g));

        if (!allMixable) {
          continue;
        }

        for (let j = i + 1; j < tablesWithGuests.length; j++) {
          const table2 = tablesWithGuests[j];
         
          if (table2.capacity !== table1.capacity) {
            continue;
          }
         
          const table2GuestIds = arrangement[table2.id] || [];
          const table2Guests = table2GuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
          const table2People = table2Guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
          const totalPeople = table1People + table2People;
         
          if (totalPeople > table1.capacity) continue;
       
          const table2Groups = [...new Set(table2Guests.map(g => g.customGroup || g.group))];
          const allTable2Mixable = table2Groups.every(g => isMixable(g));
       
          if (!allTable2Mixable) continue;
       
          let canMergeGroups = true;
          for (const g1 of table1Groups) {
            for (const g2 of table2Groups) {
              if (g1 !== g2 && !canMix(g1, g2)) {
                canMergeGroups = false;
                break;
              }
            }
            if (!canMergeGroups) break;
          }
       
          if (!canMergeGroups) continue;
       
          arrangement[table1.id].push(...table2GuestIds);
          delete arrangement[table2.id];
       
          table1.remainingCapacity -= table2People;
          table2.remainingCapacity = table2.capacity;
       
          const existingGuestIds = new Set(table1.assignedGuests);
          const newGuests = table2.assignedGuests.filter(gId => !existingGuestIds.has(gId));
          table1.assignedGuests.push(...newGuests);
          table2.assignedGuests = [];
       
          const table2Index = availableTables.findIndex(t => t.id === table2.id);
          if (table2Index !== -1) {
            availableTables.splice(table2Index, 1);
          }

          const table2IndexInTables = tables.findIndex(t => t.id === table2.id);
          if (table2IndexInTables !== -1) {
            tables.splice(table2IndexInTables, 1);
          }

          const table2IndexInList = tablesWithGuests.findIndex(t => t.id === table2.id);
          if (table2IndexInList !== -1) {
            tablesWithGuests.splice(table2IndexInList, 1);
          }
       
          j--;
          break;
        }
      }
   
    const largeTables = availableTables.filter(t => {
      const guestIds = arrangement[t.id] || [];
      if (guestIds.length === 0) return false;
     
      if (t.capacity < 20) return false;
     
      const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
      const tablePeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
      const utilization = tablePeople / t.capacity;
     
      return utilization < 0.95;
    });
     
    for (const largeTable of largeTables) {
      const largeTableGuestIds = arrangement[largeTable.id] || [];
      const largeTableGuests = largeTableGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
      let largeTablePeople = largeTableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
      const largeTableGroups = [...new Set(largeTableGuests.map(g => g.customGroup || g.group))];
      let largeTableUtilization = largeTablePeople / largeTable.capacity;

      const candidateSmallTables = availableTables.filter(t => {
        if (t.id === largeTable.id) return false;
        if (t.capacity >= 20) return false;
       
        const guestIds = arrangement[t.id] || [];
        if (guestIds.length === 0) return false;
       
        const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const tablePeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const tableUtilization = tablePeople / t.capacity;
       
        if (tableUtilization < 0.8) return false;
       
        if (largeTablePeople + tablePeople > largeTable.capacity) return false;
       
        const tableGroups = [...new Set(tableGuests.map(g => g.customGroup || g.group))];
        let canMergeAll = true;
        for (const smallGroup of tableGroups) {
          for (const largeGroup of largeTableGroups) {
            if (smallGroup !== largeGroup && !canMix(smallGroup, largeGroup)) {
              canMergeAll = false;
              break;
            }
          }
          if (!canMergeAll) break;
        }
       
        return canMergeAll;
      });
     
      candidateSmallTables.sort((a, b) => {
        const aGuestIds = arrangement[a.id] || [];
        const aGuests = aGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const aPeople = aGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const aUtil = aPeople / a.capacity;
       
        const bGuestIds = arrangement[b.id] || [];
        const bGuests = bGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const bPeople = bGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const bUtil = bPeople / b.capacity;
       
        return bUtil - aUtil;
      });
         
      for (const smallTable of candidateSmallTables) {
        const smallTableGuestIds = arrangement[smallTable.id] || [];
        const smallTableGuests = smallTableGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const smallTablePeople = smallTableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
        const combinedPeople = largeTablePeople + smallTablePeople;
        const combinedUtilization = combinedPeople / largeTable.capacity;
       
        if (combinedUtilization < 0.95) {
          continue;
        }
 
        arrangement[largeTable.id] = [...largeTableGuestIds, ...smallTableGuestIds];
       
        arrangement[smallTable.id] = [];
       
        largeTable.remainingCapacity = largeTable.capacity - combinedPeople;
        const existingGuestIds = new Set(largeTable.assignedGuests);
        const newGuests = smallTable.assignedGuests.filter(gId => !existingGuestIds.has(gId));
        largeTable.assignedGuests.push(...newGuests);
       
        smallTable.remainingCapacity = smallTable.capacity;
        smallTable.assignedGuests = [];
             
        largeTablePeople = combinedPeople;
        largeTable
Utilization = combinedUtilization;
       
        largeTableGuestIds.length = 0;
        largeTableGuestIds.push(...arrangement[largeTable.id]);
       
        if (combinedUtilization >= 0.95) {
          break;
        }
      }
    }
   
    const stillUnassignedAfterStep2 = mixableRemainingGuests.filter(item =>
      !alreadyAssigned.has(item.guest._id.toString())
    );
   
    if (stillUnassignedAfterStep2.length > 0) {
     
      const totalPeopleRemaining = stillUnassignedAfterStep2.reduce((sum, item) =>
        sum + (item.guest.attendingCount || 1), 0
      );
               
      let remainingToAssignAfterUpgrade = [...stillUnassignedAfterStep2];
     
      for (const item of stillUnassignedAfterStep2) {
        if (alreadyAssigned.has(item.guest._id.toString())) continue;
       
        const guestGroup = item.guest.customGroup || item.guest.group;
        const guestSize = item.guest.attendingCount || 1;
             
        const upgradeableTables = availableTables.filter(t => {
          if (t.capacity !== 10) return false;
         
          const tableGuestIds = arrangement[t.id] || [];
          if (tableGuestIds.length === 0) return false;
         
          const tableGuests = tableGuestIds.map(gId =>
            guests.find(g => g._id.toString() === gId)
          ).filter(Boolean);
         
          const tablePeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
         
          if (tablePeople + guestSize > 12) return false;
         
          const tableGroups = [...new Set(tableGuests.map(g => g.customGroup || g.group))];
         
          for (const tGroup of tableGroups) {
            if (tGroup === guestGroup) continue;
           
            if (!mixableGroupPairs.has(`${guestGroup}|${tGroup}`) &&
                !mixableGroupPairs.has(`${tGroup}|${guestGroup}`)) {
              return false;
            }
          }
         
          return true;
        });
       
        upgradeableTables.sort((a, b) => {
          const aGuestIds = arrangement[a.id] || [];
          const aGuests = aGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
          const aPeople = aGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
         
          const bGuestIds = arrangement[b.id] || [];
          const bGuests = bGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
          const bPeople = bGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
         
          const aWillExceed = (aPeople + guestSize) > 10;
          const bWillExceed = (bPeople + guestSize) > 10;
         
          if (aWillExceed && !bWillExceed) return -1;
          if (!aWillExceed && bWillExceed) return 1;
         
          return bPeople - aPeople;
        });
       
        if (upgradeableTables.length > 0) {
          const tableToUpgrade = upgradeableTables[0];
          const tableGuestIds = arrangement[tableToUpgrade.id] || [];
          const tableGuests = tableGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
          const tablePeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
          const tableGroups = [...new Set(tableGuests.map(g => g.customGroup || g.group))];
         
          const tableInMainArray = tables.find(t => t.id === tableToUpgrade.id);
          if (tableInMainArray) {
            tableInMainArray.capacity = 12;
            tableInMainArray.remainingCapacity = 12 - tablePeople;
          }
         
          tableToUpgrade.capacity = 12;
          tableToUpgrade.remainingCapacity = 12 - tablePeople;
         
          const assignResult = assignGuestToTableAdvanced(
            item.guest,
            tableToUpgrade,
            arrangement,
            availableTables,
            preferences,
            guests,
            alreadyAssigned,
            { t: (key) => key }
          );
         
          if (assignResult) {
            remainingToAssignAfterUpgrade = remainingToAssignAfterUpgrade.fi
lter(i =>
              i.guest._id.toString() !== item.guest._id.toString()
            );
          }
        }
      }
     
      const stillUnassignedAfterUpgrades = remainingToAssignAfterUpgrade.filter(item =>
        !alreadyAssigned.has(item.guest._id.toString())
      );
         
      const emptyAvailableTables = availableTables.filter(t => {
        const guestIds = arrangement[t.id] || [];
        return guestIds.length === 0 && !t.autoCreated;
      });
         
      if (emptyAvailableTables.length > 0 && stillUnassignedAfterUpgrades.length > 0) {
       
        emptyAvailableTables.sort((a, b) => b.capacity - a.capacity);
       
        let remainingToAssign = [...stillUnassignedAfterUpgrades];
       
        for (const table of emptyAvailableTables) {
          if (remainingToAssign.length === 0) break;
         
          if (!arrangement[table.id]) {
            arrangement[table.id] = [];
          }
         
          let currentOccupancy = 0;
         
          const guestsForThisTable = [];
         
          for (const item of remainingToAssign) {
            const guestSize = item.guest.attendingCount || 1;
           
            if (currentOccupancy + guestSize <= table.capacity) {
              guestsForThisTable.push(item);
              currentOccupancy += guestSize;
            }
          }
         
          for (const item of guestsForThisTable) {
            const guestSize = item.guest.attendingCount || 1;
            arrangement[table.id].push(item.guest._id.toString());
            table.assignedGuests.push(item.guest._id.toString());
            table.remainingCapacity -= guestSize;
            alreadyAssigned.add(item.guest._id.toString());
                     
            remainingToAssign = remainingToAssign.filter(i => i.guest._id.toString() !== item.guest._id.toString());
          }
        }
       
        const stillUnassignedAfterUsingEmpty = remainingToAssign;
       
        if (stillUnassignedAfterUsingEmpty.length > 0) {

          const preferredTableSize = preferences.preferredTableSize || 12;
          const tablesNeeded = Math.ceil(stillUnassignedAfterUsingEmpty.reduce((sum, item) =>
            sum + (item.guest.attendingCount || 1), 0) / preferredTableSize);
                 
          for (let i = 0; i < tablesNeeded; i++) {
            const tableNumber = getMaxTableNumber(tables) + 1;
            const tableId = `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`;
           
            let tableType = 'round';
            let capacity = preferredTableSize;
           
            const maxGuestSize = Math.max(...stillUnassignedAfterUsingEmpty.map(item => item.guest.attendingCount || 1));
            if (maxGuestSize > preferredTableSize) {
              capacity = Math.max(maxGuestSize, preferredTableSize);
              if (capacity > 12) {
                tableType = 'rectangular';
              }
            }
           
            const newTable = {
              id: tableId,
              name: `שולחן ${tableNumber}`,
              capacity: capacity,
              type: tableType,
              position: calculateNextTablePosition(tables, gender),
              rotation: 0,
              assignedGuests: [],
              remainingCapacity: capacity,
              autoCreated: true,
              createdForSync: true
            };
                     
            tables.push(newTable);
            availableTables.push(newTable);
           
            if (!arrangement[newTable.id]) {
              arrangement[newTable.id] = [];
            }
           
            let currentOccupancy = 0;
           
            for (const item of stillUnassignedAfterUsingEmpty) {
              if (alreadyAssigned.has(item.guest._id.toString())) continue;
             
              const guestSize = item.guest.attendingCount || 1;
             
              if (currentOccupancy + guestSize <= capacity) {
                arrangement[newTable.id].push(item.guest._id.toString());
                newTable.assignedGuests.push(item.guest._id.toString());
                newTable.remainingCapacity -= guestSize;
                alreadyAssigned.add(item.guest._id.toString());
                currentOccupancy += guestSize;
                             
                if (currentOccupancy >= capacity) break;
              }
            }
          }
        }
       
      } else {
        if (stillUnassignedAfterUpgrades.length > 0) {
         
          const preferredTableSize = preferences.preferredTableSize || 12;
          const totalPeopleRemaining = stillUnassignedAfterUpgrades.reduce((sum, item) =>
            sum + (item.guest.attendingCount || 1), 0);
          const tablesNeeded = Math.ceil(totalPeopleRemaining / preferredTableSize);
                 
          for (let i = 0; i < tablesNeeded; i++) {
            const tableNumber = getMaxTableNumber(tables) + 1;
            const tableId = `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`;
           
            let tableType = 'round';
            let capacity = preferredTableSize;
           
            const maxGuestSize = Math.max(...stillUnassignedAfterUpgrades.map(item => item.guest.attendingCount || 1));
            if (maxGuestSize > preferredTableSize) {
              capacity = Math.max(maxGuestSize, preferredTableSize);
              if (capacity > 12) {
                tableType = 'rectangular';
              }
            }
           
            const newTable = {
              id: tableId,
              name: `שולחן ${tableNumber}`,
              capacity: capacity,
              type: tableType,
              position: calculateNextTablePosition(tables, gender),
              rotation: 0,
              type: capacity >= 24 ? 'rectangular' : 'round',
              size: capacity >= 24 
                ? { width: 160, height: 100 }
                : { width: 120, height: 120 },
              assignedGuests: [],
              remainingCapacity: capacity,
              autoCreated: true,
              createdForSync: true
            };
                     
            tables.push(newTable);
            availableTables.push(newTable);
           
            if (!arrangement[newTable.id]) {
              arrangement[newTable.id] = [];
            }
           
            let currentOccupancy = 0;
            const remainingToAssign = stillUnassignedAfterUpgrades.filter(item =>
              !alreadyAssigned.has(item.guest._id.toString())
            );
           
            for (const item of remainingToAssign) {
              const guestSize = item.guest.attendingCount || 1;
             
              if (currentOccupancy + guestSize <= capacity) {
                arrangement[newTable.id].push(item.guest._id.toString());
                newTable.assignedGuests.push(item.guest._id.toString());
                newTable.remainingCapacity -= guestSize;
                alreadyAssigned.add(item.guest._id.toString());
                currentOccupancy += guestSize;
                             
                if (currentOccupancy >= capacity) break;
              }
            }
          }
        }
      }
     
    }

    const originalNumbers = new Map();
    tables.forEach((table) => {
      const match = table.name.match(/\d+/);
      if (match) {
        originalNumbers.set(table.id, parseInt(match[0]));
      }
    });

    tables.sort((a, b) => {
      const aNum = originalNumbers.get(a.id) || 0;
      const bNum = originalNumbers.get(b.id) || 0;
      if (aNum !== bNum) {
        return aNum - bNum;
      }
      return a.id.localeCompare(b.id);
    });
   
    availableTables.forEach(availTable => {
      const mainTable = tables.find(t => t.id === availTable.id);
      if (mainTable) {
        availTable.name = mainTable.name;
        availTable.capacity = mainTable.capacity;
      }
    });
     
    const nonMixableRemaining = [];
    remainingGuestsByGroup.forEach((groupInfo, groupName) => {
      if (groupInfo.type === 'non-mixable' || groupInfo.type === 'separate') {
        groupInfo.guests.forEach(guest => {
          nonMixableRemaining.push({ guest, groupName, type: groupInfo.type });
        });
      }
    });
   
    nonMixableRemaining.forEach(item => {
      if (alreadyAssigned.has(item.guest._id.toString())) return;
     
      const guest = item.guest;
      const guestSize = guest.attendingCount || 1;
      const groupName = item.groupName;
     
      let foundTable = null;
      let bestEmptyTable = null;
     
      for (const table of availableTables) {
        if (table.remainingCapacity >= guestSize) {
          const tableGuestIds = arrangement[table.id] || [];
         
          if (tableGuestIds.length > 0) {
            const tableGuests = tableGuestIds.map(gId =>
              guests.find(g => g._id.toString() === gId)
            ).filter(Boolean);
           
            const allSameGroup = tableGuests.every(g =>
              (g.customGroup || g.group) === groupName
            );
           
            if (allSameGroup) {
              foundTable = table;
              break;
            }
          }
        }
      }
     
      if (!foundTable) {
        const emptyTables = availableTables
        .filter(t => {
          const tableGuestIds = arrangement[t.id] || [];
          const isEmpty = tableGuestIds.length === 0 && t.remainingCapacity >= guestSize;
         
          if (isEmpty && t.capacity === 24 && guestSize < 23) {
            return false;
          }
         
          return isEmpty;
        })
          .map(t => ({
            table: t,
            utilization: guestSize / t.capacity,
            capacity: t.capacity
          }))
          .sort((a, b) => {
            const aGoodUtil = a.utilization >= 0.7;
            const bGoodUtil = b.utilization >= 0.7;
           
            if (aGoodUtil && !bGoodUtil) return -1;
            if (!aGoodUtil && bGoodUtil) return 1;
           
            const capDiff = a.capacity - b.capacity;
            if (capDiff !== 0) return capDiff;
           
            return a.table.name.localeCompare(b.table.name);
          });
       
        if (emptyTables.length > 0) {
          foundTable = emptyTables[0].table;
        }
      }
     
      if (foundTable) {
        assignGuestToTableAdvanced(
          guest,
          foundTable,
          arrangement,
          availableTables,
          preferences,
          guests,
          alreadyAssigned,
          { t: (key) => key }
        );
      }
    });
   
  } else if (preferences.allowGroupMixing && !hasMixingRules) {
   
    const separateGroups = [];
    const allUnassignedGuests = [];
   
    sortedGroups.forEach(([groupName, groupGuests]) => {
      const groupPolicy = groupPolicies[groupName];
      const unassigned = groupGuests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
     
      if (groupPolicy === 'S') {
        separateGroups.push({ groupName, guests: unassigned });
      } else {
        allUnassignedGuests.push(...unassigned);
      }
    });
   
    separateGroups.forEach(({ groupName, guests: groupGuests }) => {
      const unassigned = groupGuests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
      if (unassigned.length === 0) return;
         
      const reservedTableId = reservedTablesForSGroups.get(groupName);
      let targetTable = null;
     
      if (reservedTableId) {
        targetTable = availableTables.find(t => t.id === reservedTableId);
      }
     
      if (!targetTable) {
        targetTable = availableTables.find(t =>
          !reservedTableIds.has(t.id) &&
          t.assignedGuests.length === 0
        );
      }
     
      if (targetTable) {
        unassigned.forEach(guest => {
          assignGuestToTableAdvanced(guest, targetTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        });
      }
    });
     
    if (allUnassignedGuests.length > 0) {
      allUnassignedGuests.sort((a, b) => (b.attendingCount || 1) - (a.attendingCount || 1));
     
      const result = fillFullTablesForGroup(
        allUnassignedGuests,
        availableTables,
        arrangement,
        alreadyAssigned,
        preferences.preferredTableSize || 12,
        preferences,
        guests
      );
     
    }
   
  } else {
   
    sortedGroups.forEach(([groupName, groupGuests]) => {
      const groupPolicy = groupPolicies[groupName];
      if (groupPolicy === 'S') {
        return;
      }
     
      const unassigned = groupGuests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
      if (unassigned.length === 0) return;
     
      const totalPeople = unassigned.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
     
      const guestsForCalculation = unassigned.map(g => ({
        name: `${g.firstName} ${g.lastName}`,
        size: g.attendingCount || 1,
        _id: g._id,
        originalGuest: g,
        group: g.customGroup || g.group,
        groupPolicy: groupPolicies[g.customGroup || g.group]
      }));
     
      let capacities = [...new Set(unreservedTables.map(t => t.capacity))];
      if (capacities.length === 0) {
        capacities = [10, 12, 24];
      }
      [10, 12, 24].forEach(cap => {
        if (!capacities.includes(cap)) {
          capacities.push(cap);
        }
      });
      capacities.sort((a, b) => a - b);

      const already24Allocated = availableTables.filter(t =>
        t.capacity === 24 &&
        t.assignedGuests &&
        t.assignedGuests.length > 0
      ).length;

      const result = calculateTablesForGuests(guestsForCalculation, capacities, already24Allocated, false);

      const tablesWithGroupGuests = unreservedTables.filter(t => {
        if (t.assignedGuests.length === 0) return false;
        if (globalUsedTableIds.has(t.id)) return false;
       
        const hasGroupGuest = t.assignedGuests.some(guestId => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) return false;
          const guestGroup = guest.customGroup || guest.group;
          return guestGroup === groupName;
        });
       
        if (!hasGroupGuest) return false;
       
        const currentOccupancy = t.assignedGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);
        const freeCapacity = t.capacity - currentOccupancy;
       
        return freeCapacity > 0;
      });
         
      const emptyTables = unreservedTables.filter(t =>
        t.assignedGuests.length === 0 &&
        !globalUsedTableIds.has(t.id)
      );
     
      const assignedTablesForGroup = [];
     
      const requiredTablesCount = result.tables.length;
      const availableEmptyTablesCount = emptyTables.length;
      const missingTablesCount = requiredTablesCount - availableEmptyTablesCount;

      if (missingTablesCount > 0) {
       
        for (let i = 0; i < missingTablesCount; i++) {
          const tableArrangement = result.tables[availableEmptyTablesCount + i];
          if (!tableArrangement) {
            continue;
          }
         
          const requiredCapacity = tableArrangement.capacity;
          const tableNumber = getMaxTableNumber(tables) + 1;
          const tableId = `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`;
         
          let tableType = 'round';
          if (requiredCapacity >= 24) {
            tableType = 'rectangular';
          }
         
          const newTable = {
            id: tableId,
            name: `שולחן ${tableNumber}`,
            capacity: requiredCapacity,
            type: tableType,
            position: calculateNextTablePosition(tables, gender),
            rotation: 0,
            type: requiredCapacity >= 24 ? 'rectangular' : 'round',
            size: requiredCapacity >= 24 
              ? { width: 160, height: 100 }
              : { width: 120, height: 120 },
            assignedGuests: [],
            remainingCapacity: requiredCapacity,
            autoCreated: true,
            createdForSync: true
          };
                 
          tables.push(newTable);
          availableTables.push(newTable);
          unreservedTables.push(newTable);
          emptyTables.push(newTable);
        }
       
      }
         
      for (const table of tablesWithGroupGuests) {
        if (unassigned.length === 0) break;
       
        let currentOccupancy = table.assignedGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);
        let freeCapacity = table.capacity - currentOccupancy;
             
        const sortedUnassigned = [...unassigned].sort((a, b) =>
          (a.attendingCount || 1) - (b.attendingCount || 1)
        );
       
        for (const guest of sortedUnassigned) {
          const guestSize = guest.attendingCount || 1;
         
          if (guestSize <= freeCapacity) {
           
            const assignResult = assignGuestToTableAdvanced(
              guest,
              table,
              arrangement,
              availableTables,
              preferences,
              guests,
              alreadyAssigned,
              { t: (key) => key }
            );
           
            if (assignResult.success) {
              const index = unassigned.findIndex(g => g._id.toString() === guest._id.toString());
              if (index > -1) {
                unassigned.splice(index, 1);
              }
             
              currentOccupancy += guestSize;
              freeCapacity = table.capacity - currentOccupancy;
             
              if (freeCapacity <= 0) break;
            }
          }
        }
       
        if (!assignedTablesForGroup.some(t => t.id === table.id)) {
          assignedTablesForGroup.push(table);
          globalUsedTableIds.add(table.id);
        }
      }
     
      const stillUnassigned = unassigned.filter(g => !alreadyAssigned.has(g._id.toString()));
     
      if (stillUnassigned.length === 0) {
        return;
      }
     
      const filteredTables = result.tables.map(tableArrangement => {
        const unassignedGuests = tableArrangement.guests.filter(guestInfo =>
          !alreadyAssigned.has(guestInfo.originalGuest._id.toString())
        );
        return {
          ...tableArrangement,
          guests: unassignedGuests
        };
      }).filter(tableArrangement => tableArrangement.guests.length > 0);
         
      for (const tableArrangement of filteredTables) {
        const requiredCapacity = tableArrangement.capacity;
        const guestsForThisTable = tableArrangement.guests;
             
        let foundTable = emptyTables.find(t =>
          t.capacity === requiredCapacity &&
          !assignedTablesForGroup.some(at => at.id === t.id)
        );
       
        if (!foundTable) {
          const neededCapacity = tableArrangement.guests.reduce((sum, g) => sum + g.size, 0);
                  
          const suitableTables = emptyTables.filter(t =>
            t.capacity >= neededCapacity &&
            !assignedTablesForGroup.some(at => at.id === t.id)
          );
         
          if (suitableTables.length > 0) {
            suitableTables.sort((a, b) => {
              const aUtil = neededCapacity / a.capacity;
              const bUtil = neededCapacity / b.capacity;
              return bUtil - aUtil;
            });
           
            foundTable = suitableTables[0];
          }
        }
       
        if (!foundTable) {
         
          const tableNumber = getMaxTableNumber(tables) + 1;
          const tableId = `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`;
         
          let tableType = 'round';
          let newCapacity = requiredCapacity;
         
          if (newCapacity > 12) {
            tableType = 'rectangular';
          }
         
          foundTable = {
            id: tableId,
            name: `שולחן ${tableNumber}`,
            capacity: newCapacity,
            type: tableType,
            position: calculateNextTablePosition(tables, gender),
            rotation: 0,
            type: requiredCapacity >= 24 ? 'rectangular' : 'round',
            size: requiredCapacity >= 24 
              ? { width: 160, height: 100 }
              : { width: 120, height: 120 },
            assignedGuests: [],
            remainingCapacity: newCapacity,
            autoCreated: true,
            createdForSync: true
          };
                 
          tables.push(foundTable);
          availableTables.push(foundTable);
          unreservedTables.push(foundTable);
          emptyTables.push(foundTable);
        }
       
        assignedTablesForGroup.push(foundTable);
        globalUsedTableIds.add(foundTable.id);
             
        guestsForThisTable.forEach(guestInfo => {
          const originalGuest = guestInfo.originalGuest;
         
          if (alreadyAssigned.has(originalGuest._id.toString())) {
            return;
          }
         
          const assignResult = assignGuestToTableAdvanced(
            originalGuest,
            foundTable,
            arrangement,
            availableTables,
            preferences,
            guests,
            alreadyAssigned,
            { t: (key) => key }
          );
        });
      }
    });
  }

  const { separateGroups } = groupGuestsByClusters(
    guests,
    mixingMode,
    clusterMap,
    alreadyAssigned,
    preferences.groupPolicies
  );

  separateGroups.forEach((guestsInGroup, group) => {
    const unassigned = guestsInGroup.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;

    const existingTableForGroup = availableTables.find(table => {
      const tableGuestIds = arrangement[table.id] || [];
      if (tableGuestIds.length === 0) return false;
     
      const tableGuests = tableGuestIds.map(gId =>
        guests.find(g => g._id.toString() === gId)
      ).filter(Boolean);
     
      const allFromSameGroup = tableGuests.every(g => {
        const gGroup = g.customGroup || g.group;
        return gGroup === group && groupPolicies[gGroup] === 'S';
      });
     
      return allFromSameGroup && table.remainingCapacity > 0;
    });
   
    if (existingTableForGroup) {
      unassigned.forEach(guest => {
        assignGuestToTableAdvanced(guest, existingTableForGroup, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
      });
      return;
    }

    const reservedTableId = reservedTablesForSGroups.get(group);
    let targetTable = null;
   
    if (reservedTableId) {
      targetTable = availableTables.find(t => t.id === reservedTableId);
    }
   
    if (!targetTable) {
      targetTable = availableTables.find(t =>
        !reservedTableIds.has(t.id) &&
        t.assignedGuests.length === 0
      );
    }
   
    if (targetTable) {
      unassigned.forEach(guest => {
        assignGuestToTableAdvanced(guest, targetTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
      });
    }
  });
   
  const stillUnassigned = guests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));

  if (stillUnassigned.length > 0) {
   
    const remainingUnassigned = [];

    stillUnassigned.forEach(guest => {
      const guestSize = guest.attendingCount || 1;
      let assigned = false;

      for (const table of availableTables) {
        const tableGuestIds = arrangement[table.id] || [];
        const tableGuests = tableGuestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const currentOccupancy = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
        const actualRemainingCapacity = table.capacity - currentOccupancy;
             
        if (actualRemainingCapacity >= guestSize) {
          if (canGuestBeAssignedToTable(guest, table, arrangement, guests, groupPolicies, clusterMap, mixingMode, new Map())) {
            const assignResult = assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
            if (assignResult) {
              assigned = true;
              break;
            }
          }
        }
      }

      if (!assigned) {
        remainingUnassigned.push(guest);
      }
    });

    if (remainingUnassigned.length > 0) {

      const totalPeopleRemaining = remainingUnassigned.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
     
      let existing24Tables = tables.filter(t => t.capacity === 24).length;
      const MAX_24_TABLES = 2;

      const groupedByPolicy = {};
      remainingUnassigned.forEach(guest => {
        const guestGroup = guest.customGroup || guest.group;
        if (!groupedByPolicy[guestGroup]) {
          groupedByPolicy[guestGroup] = [];
        }
        groupedByPolicy[guestGroup].push(guest);
      });

      Object.keys(groupedByPolicy).forEach(groupName => {
        const groupGuests = groupedByPolicy[groupName];
        const groupPolicy = groupPolicies[groupName] || 'M';
       
        let currentEmergencyTable = null;

        groupGuests.forEach(guest => {
          const guestSize = guest.attendingCount || 1;

          if (!currentEmergencyTable || currentEmergencyTable.remainingCapacity < guestSize) {
            let maxTableNumber = 0;
            tables.forEach(t => {
              const match = t.name.match(/שולחן (\d+)/);
              if (match) {
                const num = parseInt(match[1]);
                if (num > maxTableNumber) {
                  maxTableNumber = num;
                }
              }
            });
            const tableNumber = maxTableNumber + 1;
            const tableId = `temp_${tableNumber}_${Math.random().toString(36).substr(2, 9)}`;

            const remainingGuestsInGroup = groupGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
            const remainingPeople = remainingGuestsInGroup.reduce((sum, g) => sum + (g.attendingCount || 1), 0);

            let tableType = 'round';
            let newCapacity;

            if (remainingPeople <= 12) {
              newCapacity = 12;
              tableType = 'round';
            } else if (remainingPeople >= 23 && existing24Tables < MAX_24_TABLES) {
              newCapacity = 24;
              tableType = 'rectangular';
              existing24Tables++; 
            } else if (remainingPeople <= 20) {
              newCapacity = 10;
              tableType = 'round';
            } else {
              newCapacity = 12;
              tableType = 'round';
            }

            currentEmergencyTable = {
              id: tableId,
              name: `שולחן ${tableNumber}`,
              capacity: newCapacity,
              type: tableType,
              position: calculateNextTablePosition(tables, gender),
              rotation: 0,
              type: newCapacity >= 24 ? 'rectangular' : 'round',
              size: newCapacity >= 24
                ? { width: 160, height: 100 }
                : { width: 120, height: 120 },
              assignedGuests: [],
              remainingCapacity: newCapacity,
              autoCreated: true,
              createdForSync: true,
              gender: gender
            };

            tables.push(currentEmergencyTable);
            availableTables.push(currentEmergencyTable);
            arrangement[currentEmergencyTable.id] = [];
           
          }

          currentEmergencyTable.assignedGuests.push(guest._id.toString());
          currentEmergencyTable.remainingCapacity -= guestSize;
          arrangement[currentEmergencyTable.id].push(guest._id.toString());
          alreadyAssigned.add(guest._id.toString());

        });
      });
    }
  }
 
  const finalUnassigned = guests.filter(g => g && g._id && !alreadyAssigned.has(g._id.toString()));
  
  const emptyTables = tables.filter(t => !arrangement[t.id] || arrangement[t.id].length === 0);
  const fullTables = tables.filter(t => arrangement[t.id] && arrangement[t.id].length > 0);
 
  emptyTables.forEach(t => {
  });
 
  const mergeCandidates = [];
 
  const tablesWithGuests = tables.filter(t => arrangement[t.id] && arrangement[t.id].length > 0);
 
  const tableUtilizations = tablesWithGuests.map(table => {
    const guestIds = arrangement[table.id] || [];
    const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
    const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const utilization = totalPeople / table.capacity;
   
    const genders = tableGuests.map(g => g.gender).filter(Boolean);
    const gender = genders.length > 0 ? genders[0] : null;
    const mixedGenders = genders.length > 0 && !genders.every(g => g === gender);
   
    return {
      table,
      totalPeople,
      utilization,
      gender,
      mixedGenders,
      guests: tableGuests
    };
  });

  tableUtilizations.forEach(t => {
    const groups = [...new Set(t.guests.map(g => g.customGroup || g.group).filter(Boolean))];
  });
 
  for (let i = 0; i < tableUtilizations.length; i++) {
    for (let j = i + 1; j < tableUtilizations.length; j++) {
      const t1 = tableUtilizations[i];
      const t2 = tableUtilizations[j];
     
      if (t1.utilization >= 0.65 && t2.utilization >= 0.65) {
        continue;
      }
            
      if (t1.gender && t2.gender && t1.gender !== t2.gender) {
        continue;
      }
      if (t1.mixedGenders || t2.mixedGenders) {
        continue;
      }
      
      const groups1 = [...new Set(t1.guests.map(g => g.customGroup || g.group).filter(Boolean))];
      const groups2 = [...new Set(t2.guests.map(g => g.customGroup || g.group).filter(Boolean))];
      let canMerge = true;

      for (const g of groups1) {
        if (groupPolicies[g] === 'S') {
          canMerge = false;
          break;
        }
      }

      if (canMerge) {
        for (const g of groups2) {
          if (groupPolicies[g] === 'S') {
            canMerge = false;
            break;
          }
        }
      }

      if (canMerge) {
        for (const g1 of groups1) {
          for (const g2 of groups2) {
            if (!canGroupsMix(g1, g2, mixingMode, preferences.groupMixingRules, clusterMap, groupPolicies)) {
              canMerge = false;
              break;
            }
          }
          if (!canMerge) break;
        }
      }

      if (!canMerge) {
        continue;
      }
      
      const combinedPeople = t1.totalPeople + t2.totalPeople;
          
      let optimalCapacity = null;
      let newUtilization = 0;
     
      if (combinedPeople >= 11 && combinedPeople <= 12) {
        optimalCapacity = 12;
        newUtilization = combinedPeople / 12;
      } else if (combinedPeople >= 8 && combinedPeople <= 10) {
        optimalCapacity = 10;
        newUtilization = combinedPeople / 10;
      } else if (combinedPeople >= 13 && combinedPeople <= 16) {
        const has16 = tables.some(t => t.capacity === 16);
        if (has16) {
          optimalCapacity = 16;
          newUtilization = combinedPeople / 16;
        }
      }
     
      if (!optimalCapacity) {
        continue;
      }
     
      const avgCurrentUtil = (t1.utilization + t2.utilization) / 2;
      const improvement = newUtilization - avgCurrentUtil;
     
      if (improvement > 0.05) {  
        mergeCandidates.push({
          table1: t1,
          table2: t2,
          combinedPeople,
          optimalCapacity,
          newUtilization,
          improvement
        });
      }
    }
  }
 
  mergeCandidates.sort((a, b) => b.improvement - a.improvement);
  
  const mergedTables = new Set();
  let mergeCount = 0;
 
  for (const merge of mergeCandidates) {
    
    if (mergedTables.has(merge.table1.table.id) || mergedTables.has(merge.table2.table.id)) {
      continue;
    }

    if (merge.combinedPeople > merge.optimalCapacity) {
      continue;
    }
          
    const guestIds1 = arrangement[merge.table1.table.id] || [];
    const guestIds2 = arrangement[merge.table2.table.id] || [];
    arrangement[merge.table1.table.id] = [...guestIds1, ...guestIds2];
   
    merge.table1.table.capacity = merge.optimalCapacity;
    merge.table1.table.remainingCapacity = merge.optimalCapacity - merge.combinedPeople;
    
    if (merge.optimalCapacity === 12) {
      merge.table1.table.size = { width: 120, height: 120 };
    } else if (merge.optimalCapacity === 10) {
      merge.table1.table.size = { width: 120, height: 120 };
    }

    arrangement[merge.table2.table.id] = [];
   
    mergedTables.add(merge.table1.table.id);
    mergedTables.add(merge.table2.table.id);
    mergeCount++;
  }

  const tablesBeforeCleanup = tables.length;
  tables = tables.filter(t => {
    const guestIds = arrangement[t.id] || [];
    const hasGuests = guestIds.length > 0;
    if (!hasGuests) {
      delete arrangement[t.id];  
    }
    return hasGuests;
  });
  const removedCount = tablesBeforeCleanup - tables.length;
  if (removedCount > 0) {
  }
 
  const count24Tables = tables.filter(t => t.capacity === 24).length;
 
  Object.entries(arrangement).forEach(([tableId, guestIds]) => {
    const table = tables.find(t => t.id === tableId);
 
    if (!preferences.skipFinalAdjustment) {
      if (table && guestIds && guestIds.length > 0) {
        const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
        let correctCapacity = table.capacity;
       
        if (table.capacity === 24 && totalPeople < 24) {
          if (totalPeople <= 12) {
            correctCapacity = totalPeople >= 11 ? 12 : 10;
          } else if (totalPeople >= 13 && totalPeople <= 22) {
            correctCapacity = 24;
          } else if (totalPeople === 23) {
            correctCapacity = 24;
          }
        }
        else if (table.capacity === 12 && totalPeople < 11) {
          correctCapacity = 10;
        } else if (table.capacity === 12 && totalPeople >= 11) {
        }
       
        if (correctCapacity !== table.capacity) {
          table.capacity = correctCapacity;
          table.type = correctCapacity >= 24 ? 'rectangular' : 'round';
          table.remainingCapacity = correctCapacity - totalPeople;
          
          if (correctCapacity === 10) {
            table.size = { width: 120, height: 120 };
          } else if (correctCapacity === 12) {
            table.size = { width: 120, height: 120 };
          } else if (correctCapacity >= 24) {
            table.size = { width: 160, height: 100 };
          }
        }
      }
    }
  });
 
  const tablesToSplit = [];
 
  tables.forEach(table => {
    const guestIds = arrangement[table.id] || [];
    const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
    const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
   
    if (table.capacity === 24 && totalPeople >= 13 && totalPeople < 23) {
      tablesToSplit.push({ table, guestIds, tableGuests, totalPeople });
    }
  });

  for (const split of tablesToSplit) {
    const { table, guestIds, tableGuests, totalPeople } = split;
      
    let capacity1, capacity2;
    if (totalPeople <= 20) {
      capacity1 = 10;
      capacity2 = 10;
    } else {
      capacity1 = 12;
      capacity2 = 12;
    }
   
    const targetPeople1 = Math.ceil(totalPeople / 2);
    let guests1 = [];
    let guests2 = [];
    let currentPeople1 = 0;

    const sortedGuestIds = [...guestIds].sort((a, b) => {
      const guestA = guests.find(g => g._id.toString() === a);
      const guestB = guests.find(g => g._id.toString() === b);
      const sizeA = guestA?.attendingCount || 1;
      const sizeB = guestB?.attendingCount || 1;
      return sizeB - sizeA;  
    });

    for (const gId of sortedGuestIds) {
      const guest = guests.find(g => g._id.toString() === gId);
      const guestSize = guest?.attendingCount || 1;
     
      if (currentPeople1 + guestSize <= capacity1) {
        guests1.push(gId);
        currentPeople1 += guestSize;
      } else {
        guests2.push(gId);
      }
    }

    const people1 = guests1.reduce((sum, gId) => {
      const g = guests.find(g => g._id.toString() === gId);
      return sum + (g ? (g.attendingCount || 1) : 0);
    }, 0);

    const people2 = guests2.reduce((sum, gId) => {
      const g = guests.find(g => g._id.toString() === gId);
      return sum + (g ? (g.attendingCount || 1) : 0);
    }, 0);
   
    table.capacity = capacity1;
    table.type = capacity1 >= 24 ? 'rectangular' : 'round';
    table.size = capacity1 >= 24 
      ? { width: 160, height: 100 }
      : { width: 120, height: 120 };
    table.remainingCapacity = capacity1 - people1;
    arrangement[table.id] = guests1;

    let maxTableNumber = 0;
    tables.forEach(t => {
      const match = t.name.match(/שולחן (\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > maxTableNumber) {
          maxTableNumber = num;
        }
      }
    });
    const newTableNumber = maxTableNumber + 1;
    const newPosition = calculateNextTablePosition(tables, gender);
   
    const newTable = {
      id: `split_${table.id}_${Date.now()}`,
      name: `שולחן ${newTableNumber}`,
      capacity: capacity2,
      type: capacity2 >= 24 ? 'rectangular' : 'round',
      size: capacity2 >= 24 
        ? { width: 160, height: 100 }
        : { width: 120, height: 120 },
      position: newPosition,
      remainingCapacity: capacity2 - people2,
      gender: gender
    };
   
    tables.push(newTable);
    arrangement[newTable.id] = guests2;
   
  }

  const tablesWithGuests2 = tables.filter(t => arrangement[t.id] && arrangement[t.id].length > 0);
  
  const tableUtilizations2 = tablesWithGuests2.map(table => {
    const guestIds = arrangement[table.id] || [];
    const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
    const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const utilization = totalPeople / table.capacity;
    
    const genders = tableGuests.map(g => g.gender).filter(Boolean);
    const gender = genders.length > 0 ? genders[0] : null;
    const mixedGenders = genders.length > 0 && !genders.every(g => g === gender);
    
    return {
      table,
      totalPeople,
      utilization,
      gender,
      mixedGenders,
      guests: tableGuests
    };
  });

  const mergeCandidates2 = [];
  
  for (let i = 0; i < tableUtilizations2.length; i++) {
    for (let j = i + 1; j < tableUtilizations2.length; j++) {
      const t1 = tableUtilizations2[i];
      const t2 = tableUtilizations2[j];
      
      if (t1.utilization >= 0.65 && t2.utilization >= 0.65) continue;
      
      if (t1.gender && t2.gender && t1.gender !== t2.gender) continue;
      if (t1.mixedGenders || t2.mixedGenders) continue;
      
      const groups1 = [...new Set(t1.guests.map(g => g.customGroup || g.group).filter(Boolean))];
      const groups2 = [...new Set(t2.guests.map(g => g.customGroup || g.group).filter(Boolean))];
      let canMerge = true;

      for (const g of groups1) {
        if (groupPolicies[g] === 'S') {
          canMerge = false;
          break;
        }
      }

      if (canMerge) {
        for (const g of groups2) {
          if (groupPolicies[g] === 'S') {
            canMerge = false;
            break;
          }
        }
      }

      if (canMerge) {
        for (const g1 of groups1) {
          for (const g2 of groups2) {
            if (!canGroupsMix(g1, g2, mixingMode, preferences.groupMixingRules, clusterMap, groupPolicies)) {
              canMerge = false;
              break;
            }
          }
          if (!canMerge) break;
        }
      }

      if (!canMerge) continue;
      
      const combinedPeople = t1.totalPeople + t2.totalPeople;
      
      let optimalCapacity = null;
      let newUtilization = 0;
      
      if (combinedPeople >= 11 && combinedPeople <= 12) {
        optimalCapacity = 12;
        newUtilization = combinedPeople / 12;
      } else if (combinedPeople >= 8 && combinedPeople <= 10) {
        optimalCapacity = 10;
        newUtilization = combinedPeople / 10;
      }
      
      if (!optimalCapacity) continue;
      
      const avgCurrentUtil = (t1.utilization + t2.utilization) / 2;
      const improvement = newUtilization - avgCurrentUtil;
      
      if (improvement > 0.05) {  
        mergeCandidates2.push({
          table1: t1,
          table2: t2,
          combinedPeople,
          optimalCapacity,
          newUtilization,
          improvement
        });
      }
    }
  }
  
  mergeCandidates2.sort((a, b) => b.improvement - a.improvement);
  
  const mergedTables2 = new Set();
  let mergeCount2 = 0;
  
  for (const merge of mergeCandidates2) {
    if (mergedTables2.has(merge.table1.table.id) || mergedTables2.has(merge.table2.table.id)) {
      continue;
    }

    if (merge.combinedPeople > merge.optimalCapacity) {
      continue;
    }
      
    const guestIds1 = arrangement[merge.table1.table.id] || [];
    const guestIds2 = arrangement[merge.table2.table.id] || [];
    arrangement[merge.table1.table.id] = [...guestIds1, ...guestIds2];
   
    merge.table1.table.capacity = merge.optimalCapacity;
    merge.table1.table.remainingCapacity = merge.optimalCapacity - merge.combinedPeople;
    
    if (merge.optimalCapacity === 12) {
      merge.table1.table.size = { width: 120, height: 120 };
    } else if (merge.optimalCapacity === 10) {
      merge.table1.table.size = { width: 120, height: 120 };
    }

    arrangement[merge.table2.table.id] = [];
   
    mergedTables2.add(merge.table1.table.id);
    mergedTables2.add(merge.table2.table.id);
    mergeCount2++;
  }
  
  if (mergeCount2 > 0) {
    tables = tables.filter(t => {
      const guestIds = arrangement[t.id] || [];
      const hasGuests = guestIds.length > 0;
      if (!hasGuests) {
        delete arrangement[t.id];  
      }
      return hasGuests;
    });
  }

  tables.forEach(table => {
    const guestIds = arrangement[table.id] || [];
    const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
    const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
   
    if (table.capacity === 12 && totalPeople > 0 && totalPeople < 11) {
      table.capacity = 10;
      table.size = { width: 120, height: 120 };
      table.remainingCapacity = 10 - totalPeople;
    }
  });


  tables = tables.filter(table => {
    const tableGuests = arrangement[table.id] || [];
    const totalPeople = tableGuests.reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
   
    if (totalPeople === 0) {
      delete arrangement[table.id];
      return false; 
    }
   
    if (table.capacity === 24 && totalPeople < 23) {
     
      tableGuests.forEach(guestId => {
        const guest = guests.find(g => g._id.toString() === guestId);
        if (guest) {
        }
      });
     
      delete arrangement[table.id];
      return false; 
    }
   
    return true;
  });

  tables.sort((a, b) => {
    if (a.capacity !== b.capacity) {
      return a.capacity - b.capacity;
    }
    if (a.position && b.position) {
      if (Math.abs(a.position.y - b.position.y) > 50) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    }
    return 0;
  });

  tables.forEach(t => {
    const guestCount = (arrangement[t.id] || []).length;
    const guestIds = arrangement[t.id] || [];
    const tableGuests = guestIds.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
    const totalPeople = tableGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
  });

  return { arrangement, tables };
}

function hasSeparationConflicts(guestsToCheck, table, preferences, allGuests) {
   return false;
}

const exportSeatingChart = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format } = req.query;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }
   
    const seating = await Seating.findOne({ event: eventId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const isSeparated = seating.isSeparatedSeating || false;
   
    if (isSeparated) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);
     
      const maleTablesWithGuests = (seating.maleTables || []).map(table => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        type: table.type,
        gender: 'male',
        guests: (seating.maleArrangement[table.id] || []).map(guestId => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return guest ? {
            id: guest._id,
            name: `${guest.firstName} ${guest.lastName}`,
            attendingCount: guest.maleCount || 0,
            group: guest.customGroup || guest.group
          } : null;
        }).filter(Boolean)
      }));
     
      const femaleTablesWithGuests = (seating.femaleTables || []).map(table => ({
        id: table.id,
        name: table.name,
        capacity: table.capacity,
        type: table.type,
        gender: 'female',
        guests: (seating.femaleArrangement[table.id] || []).map(guestId => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return guest ? {
            id: guest._id,
            name: `${guest.firstName} ${guest.lastName}`,
            attendingCount: guest.femaleCount || 0,
            group: guest.customGroup || guest.group
          } : null;
        }).filter(Boolean)
      }));
     
      const allTablesForExport = [...maleTablesWithGuests, ...femaleTablesWithGuests];
     
      const totalMalePeople = maleGuests.reduce((sum, g) => sum + (g.maleCount || 0), 0);
      const totalFemalePeople = femaleGuests.reduce((sum, g) => sum + (g.femaleCount || 0), 0);
     
      const seatedMalePeople = Object.values(seating.maleArrangement).flat().reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.maleCount || 0) : 0);
      }, 0);
     
      const seatedFemalePeople = Object.values(seating.femaleArrangement).flat().reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.femaleCount || 0) : 0);
      }, 0);
     
      const exportData = {
        event: {
          name: event.eventName || event.name || '',
          date: event.eventDate || event.date || new Date()
        },
        isSeparatedSeating: true,
        maleTables: maleTablesWithGuests,
        femaleTables: femaleTablesWithGuests,
        tables: allTablesForExport,
        statistics: {
          totalTables: maleTablesWithGuests.length + femaleTablesWithGuests.length,
          maleTables: maleTablesWithGuests.length,
          femaleTables: femaleTablesWithGuests.length,
          occupiedTables: maleTablesWithGuests.filter(t => t.guests.length > 0).length +
                         femaleTablesWithGuests.filter(t => t.guests.length > 0).length,
          totalPeople: totalMalePeople + totalFemalePeople,
          totalMalePeople,
          totalFemalePeople,
          seatedPeople: seatedMalePeople + seatedFemalePeople,
          seatedMalePeople,
          seatedFemalePeople
        },
        format
      };

      res.json(exportData);
     
    } else {
      const statistics = seating.getStatistics(guests);

      const exportData = {
        event: {
          name: event.eventName || event.name || '',
          date: event.eventDate || event.date || new Date()
        },
        isSeparatedSeating: false,
        tables: seating.tables.map(table => ({
          id: table.id,
          name: table.name,
          capacity: table.capacity,
          type: table.type,
          guests: (seating.arrangement[table.id] || []).map(guestId => {
            const guest = guests.find(g => g._id.toString() === guestId);
            return guest ? {
              id: guest._id,
              name: `${guest.firstName} ${guest.lastName}`,
              attendingCount: guest.attendingCount || 1,
              group: guest.customGroup || guest.group
            } : null;
          }).filter(Boolean)
        })),
        statistics: {
          totalTables: statistics.totalTables || 0,
          occupiedTables: statistics.occupiedTables || 0,
          fullyOccupiedTables: statistics.fullyOccupiedTables || 0,
          seatedGuests: statistics.seatedGuests || 0,
          seatedPeople: statistics.seatedPeople || 0,
          totalPeople: statistics.totalPeople || 0
        },
        format
      };

      res.json(exportData);
    }
   
  } catch (err) {
    res.status(500).json({ message: req.t('seating.errors.exportFailed') });
  }
};

const getSeatingStatistics = async (req, res) => {
  try {
    const { eventId } = req.params;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const seating = await Seating.findOne({ event: eventId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const statistics = seating.getStatistics(guests);
   
    res.json({
      ...statistics,
      syncSummary: seating.getSyncSummary()
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const deleteSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo || shareInfo.permission !== 'edit') {
        return res.status(403).json({ message: req.t('events.accessDenied') });
      }
    }
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOneAndDelete({ event: eventId });
   
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    res.json({ message: req.t('seating.deleteSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const validateSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { tables, arrangement } = req.body;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    const tempSeating = new Seating({
      event: eventId,
      tables,
      arrangement: arrangement || {}
    });

    const validationErrors = tempSeating.validateArrangement(guests);
   
    res.json({
      isValid: validationErrors.length === 0,
      errors: validationErrors,
      statistics: tempSeating.getStatistics(guests)
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const cloneSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { targetEventId } = req.body;
   
    const [sourceEvent, targetEvent] = await Promise.all([
      Event.findOne({ _id: eventId, user: req.userId }),
      Event.findOne({ _id: targetEventId, user: req.userId })
    ]);

    if (!sourceEvent || !targetEvent) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const sourceSeating = await Seating.findOne({ event: eventId });
    if (!sourceSeating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const existingTargetSeating = await Seating.findOne({ event: targetEventId });
    if (existingTargetSeating) {
      return res.status(400).json({ message: req.t('seating.errors.targetAlreadyHasSeating') });
    }

    const newSeating = new Seating({
      event: targetEventId,
      tables: sourceSeating.tables.map(table => ({
        ...table,
        id: `temp_${tableIndex + 1}_${Math.random().toString(36).substr(2, 9)}`
      })),
      arrangement: {},
      preferences: {
        seatingRules: { mustSitTogether: [], cannotSitTogether: [] },
        groupMixingRules: [],
        allowGroupMixing: false,
        preferredTableSize: 12,
        groupPolicies: {}
      },
      layoutSettings: sourceSeating.layoutSettings,
      syncSettings: sourceSeating.syncSettings || {
        autoSyncEnabled: true,
        syncOnRsvpChange: true,
        syncOnAttendingCountChange: true,
        autoCreateTables: true,
        autoOptimizeTables: true,
        preferredTableSize: 12
      },
      generatedBy: 'manual'
    });

    await newSeating.save();

    res.json({
      message: req.t('seating.cloneSuccess'),
      seating: {
        tables: newSeating.tables,
        arrangement: {},
        preferences: newSeating.preferences,
        layoutSettings: newSeating.layoutSettings,
        syncSettings: newSeating.syncSettings,
        syncSummary: newSeating.getSyncSummary()
      }
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getSeatingSubjestions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guestId } = req.query;
   
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const seating = await Seating.findOne({ event: eventId });
    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guest = guests.find(g => g._id.toString() === guestId);
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const suggestions = generateSeatingSubjestions(guest, guests, seating.tables, seating.arrangement, seating.preferences, req);
   
    res.json({
      guest: {
        id: guest._id,
        name: `${guest.firstName} ${guest.lastName}`,
        group: guest.customGroup || guest.group,
        attendingCount: guest.attendingCount || 1
      },
      suggestions
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

function generateSeatingSubjestions(guest, allGuests, tables, arrangement, preferences, req) {
  const suggestions = [];
  return suggestions.slice(0, 5);
}

const suggestTables = async (req, res) => {
  try {
    const { eventId } = req.params;
    const {
      allowGroupMixing,
      groupMixingRules,
      groupPolicies,
      preferredTableSize,
      isSeparatedSeating,
      existingTables,
      existingMaleTables,
      existingFemaleTables,
      existingArrangement,
      existingMaleArrangement,
      existingFemaleArrangement,
      preserveExisting
    } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const isOwner = event.user.toString() === req.userId;

    if (!isOwner) {
      const shareInfo = event.sharedWith.find(
        share => share.userId && share.userId.toString() === req.userId
      );
     
      if (!shareInfo) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }
    }

    const guests = await Guest.find({
      event: eventId,
      rsvpStatus: 'confirmed'
    });

    if (guests.length === 0) {
      return res.json({
        tableSettings: {},
        maleTableSettings: {},
        femaleTableSettings: {},
        totalTables: 0
      });
    }

    const enhancedPreferences = {
      allowGroupMixing: allowGroupMixing || false,
      groupMixingRules: groupMixingRules || [],
      groupPolicies: groupPolicies || {},
      preferredTableSize: preferredTableSize || 12,
      seatingRules: { mustSitTogether: [], cannotSitTogether: [] }
    };

    if (isSeparatedSeating) {
      const maleGuests = guests
        .filter(g => g.maleCount && g.maleCount > 0)
        .map(g => {
          const guestObj = g.toObject ? g.toObject() : {...g};
          return {
            ...guestObj,
            _id: g._id,
            attendingCount: g.maleCount,
            gender: 'male'
          };
        });

      const femaleGuests = guests
        .filter(g => g.femaleCount && g.femaleCount > 0)
        .map(g => {
          const guestObj = g.toObject ? g.toObject() : {...g};
          return {
            ...guestObj,
            _id: g._id,
            attendingCount: g.femaleCount,
            gender: 'female'
          };
        });

      let maleGuestsToSeat = maleGuests;
      let femaleGuestsToSeat = femaleGuests;

      if (preserveExisting) {
        if (existingMaleArrangement && Object.keys(existingMaleArrangement).length > 0) {
          const seatedMaleIds = new Set(Object.values(existingMaleArrangement).flat());
          maleGuestsToSeat = maleGuests.filter(g => !seatedMaleIds.has(g._id.toString()));
        }
        if (existingFemaleArrangement && Object.keys(existingFemaleArrangement).length > 0) {
          const seatedFemaleIds = new Set(Object.values(existingFemaleArrangement).flat());
          femaleGuestsToSeat = femaleGuests.filter(g => !seatedFemaleIds.has(g._id.toString()));
        }
      }

      let maleTablesList = [];
      let femaleTablesList = [];
      
      if (!preserveExisting) {
        maleTablesList = existingMaleTables || [];
        femaleTablesList = existingFemaleTables || [];
        
        if (maleTablesList.length === 0) {
          const totalMalePeople = maleGuestsToSeat.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
          maleTablesList = createAdditionalTables(totalMalePeople, 0, req, enhancedPreferences.preferredTableSize);
        }
        
        if (femaleTablesList.length === 0) {
          const totalFemalePeople = femaleGuestsToSeat.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
          femaleTablesList = createAdditionalTables(totalFemalePeople, 0, req, enhancedPreferences.preferredTableSize);
        }
      }

      const maleResult = runDryGenerateOptimalSeating(
        maleGuestsToSeat,
        maleTablesList,
        enhancedPreferences,
        'male'
      );
     
      const femaleResult = runDryGenerateOptimalSeating(
        femaleGuestsToSeat,
        femaleTablesList,
        enhancedPreferences,
        'female'
      );

      res.json({
        maleTableSettings: maleResult.tableSettings,
        femaleTableSettings: femaleResult.tableSettings,
        maleTotalTables: maleResult.totalTables,
        femaleTotalTables: femaleResult.totalTables,
        maleDetails: maleResult.details,
        femaleDetails: femaleResult.details
      });
    } else {
      let guestsToSeat = guests;
      let tablesToUse = existingTables || [];

      if (preserveExisting && existingArrangement && Object.keys(existingArrangement).length > 0) {
        const seatedIds = new Set(Object.values(existingArrangement).flat());
        guestsToSeat = guests.filter(g => !seatedIds.has(g._id.toString()));
        tablesToUse = [];

      }

      const result = runDryGenerateOptimalSeating(
        guestsToSeat,
        tablesToUse,
        enhancedPreferences,
        null,
        preserveExisting ? {} : (existingArrangement || {})
      );

      res.json({
        tableSettings: result.tableSettings,
        totalTables: result.totalTables,
        details: result.details
      });
    }
  } catch (err) {
    res.status(500).json({
      message: req.t('errors.serverError'),
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

function runDryGenerateOptimalSeating(guests, existingTables, preferences, gender = null, currentArrangement = {}) {
 
  if (!guests || guests.length === 0) {
    return {
      tableSettings: {},
      totalTables: 0,
      details: { totalPeople: 0, totalCapacity: 0 }
    };
  }

  const totalPeople = guests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
  const existingCapacity = existingTables.reduce((sum, t) => sum + t.capacity, 0);
  const initialTablesCount = existingTables.length;

  let tablesCopy;
 
  if (existingTables.length === 0) {
    tablesCopy = [];
  } else {
    tablesCopy = existingTables.map(t => ({
      id: t.id || `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: t.name || 'Table',
      capacity: t.capacity,
      type: t.type || 'round',
      position: t.position ? { ...t.position } : { x: 0, y: 0 },
      rotation: t.rotation || 0,
      assignedGuests: t.assignedGuests || [],
      remainingCapacity: t.capacity
    }));
  }

  const initialCopyCount = tablesCopy.length;
  const existingTableIds = new Set(existingTables.map(t => t.id));

  let result = null;
  let wasRetrySuccessful = false;
 
  if (existingTables.length === 0) {
    const dryRunResult = generateOptimalSeating(guests, tablesCopy, preferences, gender);
    tablesCopy = dryRunResult.tables;
   
    const hasEmergencyTables = tablesCopy.some(t => !existingTableIds.has(t.id) && t.id.includes('table_'));
    const tempTables = tablesCopy.filter(t => t.id.includes('temp_'));
   
    if (hasEmergencyTables) {
      const MAX_RETRIES = 3;
      let retryAttempt = 0;
      let bestRetryTables = null;
      let bestRetryResult = null;
      let retrySucceeded = false;
     
      while (retryAttempt < MAX_RETRIES && !retrySucceeded) {
        retryAttempt++;
     
        let retryTables = [];
         
        const dryRunResult = generateOptimalSeating(guests, tablesCopy, preferences, gender);
        retryTables = retryResult.tables;
     
        const stillHasEmergency = retryTables.some(t => t.id.includes('table_') && !t.id.includes('retry_') && !t.id.includes('temp_'));
     
        if (!stillHasEmergency) {
          bestRetryTables = retryTables;
          bestRetryResult = retryResult;
          retrySucceeded = true;
        } else {
          if (!bestRetryTables || retryTables.length < bestRetryTables.length) {
            bestRetryTables = retryTables;
            bestRetryResult = retryResult;
          }
        }
      }
     
      if (retrySucceeded) {
        tablesCopy = bestRetryTables;
        result = bestRetryResult;
        wasRetrySuccessful = true;
      } else {
        result = dryRunResult;
      }
    } else {
      result = dryRunResult;
    }
  } else {
      tablesCopy = [];
      const dryRunResult = generateOptimalSeating(guests, tablesCopy, preferences, gender);
      tablesCopy = dryRunResult.tables;
      result = dryRunResult;
  }

  const finalTablesCount = tablesCopy.length;

  let tableSettings = {};
  let actualTableCount = 0;

  if (existingTables.length === 0) {

    const capacityChanges = { from12to10: 0, kept12: 0 };
   
    tablesCopy.forEach(table => {
      if (table.capacity === 12) {
        const guestsInTable = result.arrangement[table.id] || table.assignedGuests || [];
        const guestObjects = guestsInTable.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
        const totalPeopleInTable = guestObjects.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
       
        if (totalPeopleInTable > 0 && totalPeopleInTable < 11) {
          table.capacity = 10;
          table.remainingCapacity = 10 - totalPeopleInTable;
          capacityChanges.from12to10++;
        } else if (totalPeopleInTable >= 11) {
          capacityChanges.kept12++;
        }
      }
    });

    if (capacityChanges.from12to10 > 0) {
      tableSettings[10] = (tableSettings[10] || 0) + capacityChanges.from12to10;
      tableSettings[12] = Math.max(0, (tableSettings[12] || 0) - capacityChanges.from12to10);
      if (tableSettings[12] === 0) delete tableSettings[12];
    }

  } else {

   
    const unassignedGuests = guests.filter(guest => {
      const guestId = guest._id.toString();
      return !Object.values(result.arrangement).some(guestList => guestList.includes(guestId));
    });
   
   
    if (unassignedGuests.length > 0) {
      const unassignedPeopleCount = unassignedGuests.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
     
      const existing24Tables = tablesCopy.filter(t => t.capacity === 24).length;
      const canCreate24Tables = Math.max(0, 2 - existing24Tables);
     
      let remainingPeople = unassignedPeopleCount;
      let tablesOf24Created = 0;
     
      const currentTablesCount = tablesCopy.filter(table => {
        const hasGuestsInResult = result.arrangement[table.id] && result.arrangement[table.id].length > 0;
        const hasGuestsInTable = table.assignedGuests && table.assignedGuests.length > 0;
        return hasGuestsInResult || hasGuestsInTable;
      }).length;
      let nextTableNumber = currentTablesCount + 1;
     
      while (remainingPeople >= 22 && tablesOf24Created < canCreate24Tables) {
        const newTableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const newTable = {
          id: newTableId,
          name: `שולחן ${nextTableNumber}`,
          capacity: 24,
          type: 'round',
          position: calculateNextTablePosition(tablesCopy, gender),
          rotation: 0,
          size: {
            width: 160,
            height: 100
          },
          assignedGuests: [],
          remainingCapacity: 24
        };
        tablesCopy.push(newTable);
        tableSettings[24] = (tableSettings[24] || 0) + 1;
        remainingPeople -= 24;
        tablesOf24Created++;
        nextTableNumber++;
      }
     
      if (remainingPeople > 0) {
        const newTablesNeeded = Math.ceil(remainingPeople / 10);
       
        for (let i = 0; i < newTablesNeeded; i++) {
          const newTableId = `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const newTable = {
            id: newTableId,
            name: `שולחן ${nextTableNumber}`,
            capacity: 10,
            type: 'round',
            position: calculateNextTablePosition(tablesCopy, gender),
            rotation: 0,
            size: {
              width: 120,
              height: 120
            },
            assignedGuests: [],
            remainingCapacity: 10
          };
          tablesCopy.push(newTable);
          tableSettings[10] = (tableSettings[10] || 0) + 1;
          nextTableNumber++;
        }
      }
    }
   
  }

  tablesCopy = tablesCopy.filter(table => {
    const hasGuestsInResult = result.arrangement[table.id] && result.arrangement[table.id].length > 0;
    const hasGuestsInTable = table.assignedGuests && table.assignedGuests.length > 0;
    const hasGuests = hasGuestsInResult || hasGuestsInTable;
 
    if (!hasGuests) {
    }
 
    if (table.capacity === 24 && hasGuests) {
      const tableGuests = result.arrangement[table.id] || table.assignedGuests || [];
      const guestObjects = tableGuests.map(gId => guests.find(g => g._id.toString() === gId)).filter(Boolean);
      const totalPeople = guestObjects.reduce((sum, g) => sum + (g.attendingCount || 1), 0);
   
      if (totalPeople < 23) {
        return false;
      }
    }
 
    return hasGuests;
  });

  tablesCopy.sort((a, b) => {
    if (a.capacity !== b.capacity) {
      return a.capacity - b.capacity;
    }
    if (a.position && b.position) {
      if (a.position.y !== b.position.y) {
        return a.position.y - b.position.y;
      }
      return a.position.x - b.position.x;
    }
    return 0;
  });

  if (gender === 'male' || gender === 'female') {
    const START_X = gender === 'male' ? 300 : 1300;
    const START_Y = 280;
    const SPACING_X = 200;
    const SPACING_Y = 180;
    const COLS = 4;
    
    tablesCopy.forEach((table, index) => {
      table.order = index;
      const row = Math.floor(index / COLS);
      const col = index % COLS;
      const x = START_X + col * SPACING_X;
      const y = START_Y + row * SPACING_Y;
      table.position = { x, y };
    });
  } else {
    const CANVAS_HEIGHT = 1600;
    const BOUNDARY_PADDING = 150;
    const START_X = 300;
    const START_Y = 250;
    const SPACING_X = 200;
    const SPACING_Y = 180;
    const COLS_FIRST_SECTION = 5;
    const COLS_OTHER_SECTIONS = 4;
    const ROWS = 7;
    const TABLES_FIRST_SECTION = ROWS * COLS_FIRST_SECTION; 
    const TABLES_OTHER_SECTION = ROWS * COLS_OTHER_SECTIONS; 
    const SECTION_GAP = 200; 
    const MAX_Y = CANVAS_HEIGHT - BOUNDARY_PADDING;

    tablesCopy.forEach((table, index) => {
      table.name = `שולחן ${index + 1}`;
      table.order = index;

      let row, col, sectionOffset;
      if (index < TABLES_FIRST_SECTION) {
        row = Math.floor(index / COLS_FIRST_SECTION);
        col = index % COLS_FIRST_SECTION;
        sectionOffset = 0;
      } else {
        const indexAfterFirst = index - TABLES_FIRST_SECTION;
        const section = 1 + Math.floor(indexAfterFirst / TABLES_OTHER_SECTION);
        const indexInSection = indexAfterFirst % TABLES_OTHER_SECTION;
        row = Math.floor(indexInSection / COLS_OTHER_SECTIONS);
        col = indexInSection % COLS_OTHER_SECTIONS;
        sectionOffset = (COLS_FIRST_SECTION * SPACING_X + SECTION_GAP) + (section - 1) * (COLS_OTHER_SECTIONS * SPACING_X + SECTION_GAP);
      }

      const y = Math.min(START_Y + row * SPACING_Y, MAX_Y - 100);
      const x = START_X + col * SPACING_X + sectionOffset;

      table.position = { x, y };
    });
  }

  tablesCopy.forEach(t => {
    const pos = t.position || { x: 0, y: 0 };
  });

  tableSettings = {};
  tablesCopy.forEach(table => {
    const capacity = table.capacity;
    tableSettings[capacity] = (tableSettings[capacity] || 0) + 1;
  });
 
  const totalTables = Object.values(tableSettings).reduce((sum, count) => sum + count, 0);
  const suggestedCapacity = Object.entries(tableSettings).reduce(
    (sum, [cap, count]) => sum + (parseInt(cap) * count), 0
  );

  return {
    tableSettings,
    totalTables,
    arrangement: result.arrangement,    
    tables: tablesCopy,              
    details: {
      totalPeople,
      existingCapacity,
      suggestedCapacity,
      totalCapacity: existingCapacity + suggestedCapacity,
      existingTablesCount: initialTablesCount,
      finalTablesCount: totalTables
    }
  };
}

module.exports = {
  getSeatingArrangement,
  saveSeatingArrangement,
  generateAISeating,
  exportSeatingChart,
  getSeatingStatistics,
  deleteSeatingArrangement,
  validateSeatingArrangement,
  getSeatingSubjestions,
  cloneSeatingArrangement,
  processSeatingSync,
  updateSyncSettings,
  getSyncStatus,
  proposeSyncOptions,
  applySyncOption,
  moveAffectedGuestsToUnassigned,
  suggestTables
};