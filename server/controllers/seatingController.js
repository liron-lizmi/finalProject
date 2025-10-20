const Seating = require('../models/Seating');
const Event = require('../models/Event');
const Guest = require('../models/Guest');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { createCanvas } = require('canvas');

const getSeatingArrangement = async (req, res) => {
  try {
    const { eventId } = req.params;
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const actualEventId = event.originalEvent || eventId;

    let seating = await Seating.findOne({ event: actualEventId, user: event.originalEvent ? (await Event.findById(event.originalEvent)).user : req.userId });
      
    if (!seating) {
      return res.json({
        tables: [],
        arrangement: {},
        preferences: {
          groupTogether: [],
          keepSeparate: [],
          specialRequests: []
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

    const freshSeating = new Seating(seating);
   
    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    const cleanupResult = await cleanupEmptyTables(freshSeating, guests, req);
   
    if (cleanupResult.hasChanges) {
      await Seating.findByIdAndUpdate(
        seating._id,
        {
          tables: freshSeating.tables,
          arrangement: freshSeating.arrangement,
          updatedAt: new Date()
        },
        { new: true }
      );
    }

    const syncSummary = {
      autoSyncEnabled: freshSeating.syncSettings?.autoSyncEnabled !== false,
      pendingTriggers: freshSeating.syncTriggers?.filter(t => !t.processed).length || 0,
      lastSyncTrigger: freshSeating.syncTriggers?.length > 0 ?
        freshSeating.syncTriggers[freshSeating.syncTriggers.length - 1].timestamp : null,
      lastSyncProcessed: freshSeating.lastSyncProcessed || null,
      syncStats: freshSeating.syncStats || {
        totalSyncs: 0,
        successfulSyncs: 0,
        failedSyncs: 0,
        lastSyncStatus: 'success'
      },
      recentTriggers: freshSeating.syncTriggers?.slice(-5) || []
    };

    res.json({
      tables: freshSeating.tables || [],
      arrangement: freshSeating.arrangement || {},
      preferences: freshSeating.preferences || {
        groupTogether: [],
        keepSeparate: [],
        specialRequests: []
      },
      layoutSettings: freshSeating.layoutSettings || {
        canvasScale: 1,
        canvasOffset: { x: 0, y: 0 }
      },
      syncSettings: freshSeating.syncSettings || {
        autoSyncEnabled: true,
        syncOnRsvpChange: true,
        syncOnAttendingCountChange: true,
        autoCreateTables: true,
        autoOptimizeTables: true,
        preferredTableSize: 12
      },
      generatedBy: freshSeating.generatedBy || 'manual',
      version: freshSeating.version || 1,
      updatedAt: freshSeating.updatedAt || new Date(),
      syncSummary,
      cleanupSummary: cleanupResult.hasChanges ? cleanupResult.cleanupSummary : null
    });
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
    const { tables, arrangement, preferences, layoutSettings, syncSettings } = req.body;
       
    const event = await Event.findOne({ _id: eventId, user: req.userId });
      if (!event) {
        return res.status(404).json({ message: req.t('events.notFound') });
      }

    const actualEventId = event.originalEvent || eventId;
    const actualUserId = event.originalEvent ? (await Event.findById(event.originalEvent)).user : req.userId;

    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

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

    const errors = [];
    if (cleanedTables && cleanedArrangement) {
      for (const [tableId, guestIds] of Object.entries(cleanedArrangement)) {
        if (!Array.isArray(guestIds)) {
          continue;
        }
       
        const table = cleanedTables.find(t => t.id === tableId);
        if (!table) {
          continue;
        }
       
        const totalPeople = guestIds.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          if (!guest) {
            return sum;
          }
          return sum + (guest.attendingCount || 1);
        }, 0);

        if (totalPeople > table.capacity) {
          errors.push(req.t('validation.tableOvercapacity', {
            tableName: table.name,
            occupancy: totalPeople,
            capacity: table.capacity
          }));
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        message: req.t('seating.errors.validationFailed'),
        errors
      });
    }

    const updateData = {
      tables: cleanedTables,
      arrangement: cleanedArrangement,
      preferences: preferences || {
        groupTogether: [],
        keepSeparate: [],
        specialRequests: []
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
      generatedBy: 'manual',
      updatedAt: new Date()
    };

    const seating = await Seating.findOneAndUpdate(
      { event: actualEventId, user: actualUserId },
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

    res.json({
      message: req.t('seating.saveSuccess'),
      seating: {
        tables: seating.tables,
        arrangement: seating.arrangement,
        preferences: seating.preferences,
        layoutSettings: seating.layoutSettings,
        syncSettings: seating.syncSettings,
        version: seating.version,
        updatedAt: seating.updatedAt,
        syncSummary: seating.getSyncSummary()
      }
    });
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
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    let seating;
    let retryCount = 0;
    const maxRetries = 5;
   
    while (retryCount < maxRetries) {
      try {
        seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
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
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    const pendingTriggers = seating.pendingSyncTriggers;

    if (pendingTriggers.length === 0) {
      const cleanupResult = await cleanupEmptyTables(seating, guests, req);
     
      if (cleanupResult.hasChanges) {
        const saveResult = await saveSeatingWithRetryAndValidation(seating, guests, maxRetries);
        if (!saveResult.success) {
          throw new Error(`Failed to save after cleanup: ${saveResult.error}`);
        }
       
        return res.json({
          message: req.t('seating.sync.arrangementOptimized'),
          hasChanges: true,
          requiresUserDecision: false,
          seating: {
            tables: seating.tables,
            arrangement: seating.arrangement,
            syncSummary: seating.getSyncSummary()
          },
          cleanupActions: cleanupResult.actions
        });
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
      const option1 = await generateSyncOption(seating, pendingTriggers, guests, req, 'conservative');
      const option2 = await generateSyncOption(seating, pendingTriggers, guests, req, 'optimal');
      const affectedGuests = extractAffectedGuests(pendingTriggers, guests);

      return res.json({
        message: req.t('seating.sync.userApprovalRequired'),
        hasChanges: true,
        requiresUserDecision: true,
        options: [option1, option2],
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
              trigger.changeData?.type === 'attending_count_changed') {
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

    const cleanupResult = await cleanupEmptyTables(seating, guests, req);
    if (cleanupResult.hasChanges) {
      hasChanges = true;
      syncResults.push({
        success: true,
        actions: cleanupResult.actions
      });
    }

    const saveResult = await saveSeatingWithRetryAndValidation(seating, guests, maxRetries);
    if (!saveResult.success) {
      throw new Error(`Failed to save seating after sync: ${saveResult.error}`);
    }

    const savedSeating = saveResult.savedSeating || await Seating.findOne({ event: actualEventId, user: actualUserId });

    const totalActions = syncResults.reduce((sum, result) =>
      sum + (result.actions?.length || 0), 0
    );

    res.json({
      message: hasChanges
        ? req.t('seating.sync.changesProcessed', { count: totalActions })
        : req.t('seating.sync.noChangesNeeded'),
      syncResults,
      hasChanges,
      requiresUserDecision: false,
      seating: {
        tables: savedSeating.tables,
        arrangement: savedSeating.arrangement,
        syncSummary: savedSeating.getSyncSummary()
      }
    });

  } catch (err) {    
    if (err.name === 'VersionError') {
      try {
        const currentSeating = await Seating.findOne({ event: actualEventId, user: actualUserId });
        if (currentSeating) {
          return res.json({
            message: req.t('seating.sync.versionConflictResolved'),
            hasChanges: false,
            requiresUserDecision: false,
            seating: {
              tables: currentSeating.tables,
              arrangement: currentSeating.arrangement,
              syncSummary: currentSeating.getSyncSummary()
            }
          });
        }
      } catch (retryError) {
        // Continue to the error response below
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
          // Continue with error handling below
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

const saveSeatingWithRetry = async (seating, maxRetries = 3) => {
  let retryCount = 0;
 
  while (retryCount < maxRetries) {
    try {
      await seating.save();
      return;
    } catch (error) {
      retryCount++;
     
      if (error.name === 'VersionError' && retryCount < maxRetries) {
        const latestSeating = await Seating.findById(seating._id);
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
      }
     
      if (retryCount >= maxRetries) {
        throw error;
      }
     
      await new Promise(resolve => setTimeout(resolve, 100 * retryCount));
    }
  }
};

const cleanupEmptyTables = async (seating, guests, req) => {
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
          const optimalCapacity = Math.max(12, Math.ceil(guestSize * 1.5));
         
          const newTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
         
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

  const tablesWithOverflow = [];
 
  for (const table of seating.tables) {
    const tableGuests = seating.arrangement[table.id] || [];
    const actualOccupancy = tableGuests.reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      if (!guest) {
        return sum;
      }
      return sum + (guest?.attendingCount || 1);
    }, 0);
   
    if (actualOccupancy > table.capacity) {
      tablesWithOverflow.push({ table, actualOccupancy });
    }
  }
 
  for (const { table, actualOccupancy } of tablesWithOverflow) {
    const excess = actualOccupancy - table.capacity;
    const tableGuests = seating.arrangement[table.id] || [];
    const guestsToMove = [];
    let capacityToMove = 0;
   
    for (let i = tableGuests.length - 1; i >= 0 && capacityToMove < excess; i--) {
      const guestId = tableGuests[i];
      const guest = guests.find(g => g._id.toString() === guestId);
      const guestSize = guest?.attendingCount || 1;
     
      guestsToMove.push({ guestId, guest, guestSize });
      capacityToMove += guestSize;
    }
   
    let targetTable = null;
   
    for (const candidateTable of seating.tables) {
      if (candidateTable.id === table.id) continue;
     
      const candidateGuests = seating.arrangement[candidateTable.id] || [];
      const candidateOccupancy = candidateGuests.reduce((sum, gId) => {
        const g = guests.find(guest => guest._id.toString() === gId);
        return sum + (g?.attendingCount || 1);
      }, 0);
     
      const availableSpace = candidateTable.capacity - candidateOccupancy;
     
      if (availableSpace >= capacityToMove) {
        targetTable = candidateTable;
        break;
      }
    }
   
    if (!targetTable) {
      const tableNumber = seating.tables.length + 1;
      const optimalCapacity = Math.max(12, capacityToMove);
     
      targetTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
     
      actions.push({
        action: 'table_created_for_overflow',
        details: {
          tableName: targetTable.name,
          fromTable: table.name,
          capacity: targetTable.capacity,
          reason: req.t('seating.sync.tableCreatedForOverflow')
        }
      });
    }
   
    if (!seating.arrangement[targetTable.id]) {
      seating.arrangement[targetTable.id] = [];
    }
   
    guestsToMove.forEach(({ guestId, guest }) => {
      const guestIndex = seating.arrangement[table.id].indexOf(guestId);
      if (guestIndex !== -1) {
        seating.arrangement[table.id].splice(guestIndex, 1);
        seating.arrangement[targetTable.id].push(guestId);
      }
    });
   
    const newOccupancy = (seating.arrangement[table.id] || []).reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
   
    if (newOccupancy > table.capacity) {
      // Still overcapacity after move - should not happen but handle gracefully
    }
   
    actions.push({
      action: 'guests_moved_for_capacity',
      details: {
        fromTable: table.name,
        toTable: targetTable.name,
        guestsCount: guestsToMove.length,
        reason: req.t('seating.sync.guestsMovedForCapacity')
      }
    });
  }

  const finalTablesCount = seating.tables.length;
  const finalArrangementKeys = Object.keys(seating.arrangement);
  const hasChanges = originalTablesCount !== finalTablesCount ||
                     originalArrangementKeys.length !== finalArrangementKeys.length ||
                     !originalArrangementKeys.every(key => finalArrangementKeys.includes(key)) ||
                     actions.length > 0;
 
  return {
    hasChanges,
    actions,
    tablesRemoved: originalTablesCount - finalTablesCount,
    cleanupSummary: {
      emptyTablesRemoved: emptyTables.length,
      orphanedEntriesRemoved: orphanedArrangements.length,
      guestsRescued: actions.filter(a => a.action === 'guest_rescued_to_existing_table' || a.action === 'table_created_for_rescue').length,
      overflowTablesCreated: actions.filter(a => a.action === 'table_created_for_overflow').length
    }
  };
};

const checkForConflictingChanges = async (seating, triggers, guests) => {
  for (const trigger of triggers) {
    const { changeType, changeData } = trigger;
   
    if (changeType === 'guest_deleted' ||
        (changeType === 'rsvp_updated' && changeData.type === 'status_no_longer_confirmed')) {
      continue;
    }
   
    if (changeType === 'rsvp_updated' && changeData.type === 'attending_count_changed') {
      const { guestId, newCount, oldCount } = changeData;
     
      const changeAmount = newCount - oldCount;
     
      if (changeAmount >= 2) {
        return true;
      }
     
      if (changeAmount === 1) {
        const isGuestSeated = Object.values(seating.arrangement || {}).some(guestIds =>
          Array.isArray(guestIds) && guestIds.includes(guestId)
        );
       
        if (isGuestSeated) {
          let guestTableId = null;
          Object.keys(seating.arrangement).forEach(tableId => {
            if (seating.arrangement[tableId] && seating.arrangement[tableId].includes(guestId)) {
              guestTableId = tableId;
            }
          });

          if (guestTableId) {
            const currentTable = seating.tables.find(t => t.id === guestTableId);
            if (currentTable) {
              const tableGuests = seating.arrangement[guestTableId] || [];
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
            }
          }
        }
      }
           
      const isGuestSeated = Object.values(seating.arrangement || {}).some(guestIds =>
        Array.isArray(guestIds) && guestIds.includes(guestId)
      );
     
      if (isGuestSeated) {
        let guestTableId = null;
        Object.keys(seating.arrangement).forEach(tableId => {
          if (seating.arrangement[tableId] && seating.arrangement[tableId].includes(guestId)) {
            guestTableId = tableId;
          }
        });

        if (guestTableId) {
          const currentTable = seating.tables.find(t => t.id === guestTableId);
          if (currentTable) {
            const tableGuests = seating.arrangement[guestTableId] || [];
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
          }
        }
      } else {
        const hasAvailableSpace = seating.tables.some(table => {
          const tableGuests = seating.arrangement[table.id] || [];
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
   
    if ((changeType === 'rsvp_updated' && changeData.type === 'status_became_confirmed') ||
        changeType === 'guest_added') {
      const guest = changeData.guest;
      const guestSize = guest.attendingCount || 1;
     
      const hasAvailableSpace = seating.tables.some(table => {
        const tableGuests = seating.arrangement[table.id] || [];
        const currentOccupancy = tableGuests.reduce((sum, guestId) => {
          const g = guests.find(guest => guest._id.toString() === guestId);
          return sum + (g?.attendingCount || 1);
        }, 0);
       
        return (table.capacity - currentOccupancy) >= guestSize;
      });
     
      if (!hasAvailableSpace) {
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

  try {
    switch (changeType) {
      case 'guest_added':
      case 'rsvp_updated':
        if (changeData.type === 'status_became_confirmed') {
          const result = await seatNewGuest(seating, changeData.guest, guests, req);
          actions.push(...result.actions);
        } else if (changeData.type === 'status_no_longer_confirmed') {
          const result = await unseatGuest(seating, changeData.guestId, guests, req);
          actions.push(...result.actions);
        } else if (changeData.type === 'attending_count_changed') {
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
     
      if (finalOccupancy > newTable.capacity) {
        // Handle overcapacity gracefully
      }
     
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

  return { actions };
};

const seatNewGuest = async (seating, guest, allGuests, req) => {
  const actions = [];
  const guestSize = guest.attendingCount || 1;
 
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
   
    if (finalOccupancy > availableTable.capacity) {
      // Handle overcapacity gracefully
    }
   
    actions.push({
      action: 'guest_seated',
      details: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        tableName: availableTable.name,
        attendingCount: guestSize
      }
    });
  }
 
  return { actions };
};

const unseatGuest = async (seating, guestId, allGuests, req) => {
  const actions = [];
  let guestName = req.t('seating.unknownGuest');
 
  const guest = allGuests.find(g => g._id.toString() === guestId) ||
               allGuests.find(g => g._id === guestId);
  if (guest) {
    guestName = `${guest.firstName} ${guest.lastName}`;
  }
 
  let wasSeated = false;
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

const handleAttendingCountChange = async (seating, changeData, allGuests, req) => {
  const actions = [];
  const { guestId, guest, oldCount, newCount } = changeData;
 
  let guestTableId = null;
  Object.keys(seating.arrangement).forEach(tableId => {
    if (seating.arrangement[tableId].includes(guestId)) {
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
 
  const shouldOptimize = newCount < oldCount && newTotalSize <= (currentTable.capacity / 3);
 
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

    if (shouldOptimize && seating.tables.length > 1) {
      const guestGroup = guest.customGroup || guest.group;
      const betterTable = seating.tables.find(table => {
        if (table.id === guestTableId) return false;
       
        const targetGuests = seating.arrangement[table.id] || [];
        if (targetGuests.length === 0) return false;
       
        const targetOccupancy = targetGuests.reduce((sum, guestId) => {
          const g = allGuests.find(guest => guest._id.toString() === guestId);
          return sum + (g?.attendingCount || 1);
        }, 0);
       
        const hasSpace = (table.capacity - targetOccupancy) >= newCount;
       
        const hasSameGroup = targetGuests.some(guestId => {
          const tableGuest = allGuests.find(g => g._id.toString() === guestId);
          return tableGuest && (tableGuest.customGroup || tableGuest.group) === guestGroup;
        });
       
        return hasSpace && hasSameGroup;
      });

      if (betterTable) {
        const guestIndex = seating.arrangement[guestTableId].indexOf(guestId);
        if (guestIndex !== -1) {
          seating.arrangement[guestTableId].splice(guestIndex, 1);
          if (seating.arrangement[guestTableId].length === 0) {
            delete seating.arrangement[guestTableId];
          }
        }

        if (!seating.arrangement[betterTable.id]) {
          seating.arrangement[betterTable.id] = [];
        }
        seating.arrangement[betterTable.id].push(guestId);
       
        actions[actions.length - 1] = {
          action: 'guest_moved_for_optimization',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            fromTable: currentTable.name,
            toTable: betterTable.name,
            oldCount,
            newCount,
            reason: req.t('seating.sync.movedForOptimization')
          }
        };

        if (seating.arrangement[guestTableId] === undefined || seating.arrangement[guestTableId].length === 0) {
          const wasAutoCreated = currentTable.autoCreated || currentTable.createdForSync;
          if (wasAutoCreated) {
            seating.tables = seating.tables.filter(t => t.id !== guestTableId);
            delete seating.arrangement[guestTableId];
           
            actions.push({
              action: 'empty_table_removed',
              details: {
                tableName: currentTable.name,
                reason: req.t('seating.sync.emptyTableRemovedAfterMove')
              }
            });
          }
        }
      }
    }
  } else {
    const guestIndex = seating.arrangement[guestTableId].indexOf(guestId);
    if (guestIndex !== -1) {
      seating.arrangement[guestTableId].splice(guestIndex, 1);
      if (seating.arrangement[guestTableId].length === 0) {
        delete seating.arrangement[guestTableId];
      }
    }

    let newTable = seating.findAvailableTable(newCount, allGuests);
   
    if (!newTable && seating.syncSettings?.autoCreateTables) {
      const tableNumber = seating.tables.length + 1;
      const optimalCapacity = Math.max(
        seating.syncSettings.preferredTableSize || 12,
        Math.ceil(newCount * 1.2)
      );
     
      newTable = seating.createTable(optimalCapacity, tableNumber, true, true, req);
     
      actions.push({
        action: 'table_created',
        details: {
          tableName: newTable.name,
          capacity: newTable.capacity,
          reason: req.t('seating.sync.createdForResize')
        }
      });
    }

    if (newTable) {
      if (!seating.arrangement[newTable.id]) {
        seating.arrangement[newTable.id] = [];
      }
      seating.arrangement[newTable.id].push(guestId);
     
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
    } else {
      if (!seating.arrangement[guestTableId]) {
        seating.arrangement[guestTableId] = [];
      }
      seating.arrangement[guestTableId].push(guestId);
     
      actions.push({
        action: 'resize_failed',
        details: {
          guestName: `${guest.firstName} ${guest.lastName}`,
          reason: req.t('seating.sync.noTableForResize'),
          fallback: req.t('seating.sync.keptAtOriginalTable')
        }
      });
    }

    if (seating.arrangement[guestTableId] === undefined || seating.arrangement[guestTableId].length === 0) {
      const wasAutoCreated = currentTable.autoCreated || currentTable.createdForSync;
      if (wasAutoCreated) {
        seating.tables = seating.tables.filter(t => t.id !== guestTableId);
        delete seating.arrangement[guestTableId];
       
        actions.push({
          action: 'empty_table_removed',
          details: {
            tableName: currentTable.name,
            reason: req.t('seating.sync.emptyTableRemovedAfterMove')
          }
        });
      }
    }
  }

  return { actions };
};

const isGuestSeated = (seating, guestId) => {
  return Object.values(seating.arrangement || {}).some(guestIds =>
    Array.isArray(guestIds) && guestIds.includes(guestId)
  );
};

const updateSyncSettings = async (req, res) => {
  try {
    const { eventId } = req.params;
    const syncSettings = req.body;
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOneAndUpdate(
      { event: actualEventId, user: actualUserId },
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
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const actualEventId = event.originalEvent || eventId;
    let actualUserId = req.userId;
    if (event.originalEvent) {
      const originalEvent = await Event.findById(event.originalEvent);
      if (originalEvent) {
        actualUserId = originalEvent.user;
      }
    }

    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
   
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
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
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
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    const option1 = await generateSyncOption(seating, pendingTriggers, guests, req, 'conservative');
    const option2 = await generateSyncOption(seating, pendingTriggers, guests, req, 'optimal');
    const affectedGuests = extractAffectedGuests(pendingTriggers, guests);

    res.json({
      message: req.t('seating.sync.optionsGenerated'),
      options: [option1, option2],
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
  const optionSeating = {
    tables: JSON.parse(JSON.stringify(seating.tables)),
    arrangement: JSON.parse(JSON.stringify(seating.arrangement || {}))
  };

  const actions = [];
  let description = '';

  try {
    for (const trigger of triggers) {
      const result = await simulateSyncTrigger(optionSeating, trigger, guests, req, strategy);
      actions.push(...result.actions);
    }

    if (strategy === 'optimal' && seating.syncSettings?.autoOptimizeTables) {
      const optimized = optimizeArrangementSimulation(optionSeating, guests);
      if (optimized.wasOptimized) {
        actions.push(...optimized.actions);
      }
    }

    optionSeating.tables = updateTableNamesWithGroupsInSync(
      optionSeating.tables,
      optionSeating.arrangement,
      guests,
      req
    );

    description = generateOptionDescription(actions, strategy, req);

    return {
      id: `${strategy}_${Date.now()}`,
      strategy,
      description,
      tables: optionSeating.tables,
      arrangement: optionSeating.arrangement,
      actions,
      stats: calculateArrangementStats(optionSeating, guests)
    };

  } catch (error) {
    return {
      id: `${strategy}_error`,
      strategy,
      description: req.t('seating.sync.optionGenerationError'),
      tables: seating.tables,
      arrangement: seating.arrangement,
      actions: [],
      error: error.message
    };
  }
};

const simulateSyncTrigger = async (optionSeating, trigger, guests, req, strategy) => {
  const { changeType, changeData } = trigger;
  const actions = [];

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
        } else if (changeData.type === 'attending_count_changed') {
          const result = await simulateAttendingCountChange(optionSeating, changeData, guests, req, strategy);
          actions.push(...result.actions);
        }
        break;

      case 'guest_deleted':
        const deleteResult = await simulateUnseatGuest(optionSeating, changeData.guestId, guests, req);
        actions.push(...deleteResult.actions);
        break;

      default:
        // Unknown trigger type
    }
  } catch (error) {
    actions.push({
      action: 'simulation_error',
      details: {
        error: error.message,
        triggerType: changeType
      }
    });
  }

  return { actions };
};

const simulateSeatNewGuest = async (optionSeating, guest, allGuests, req, strategy) => {
  const actions = [];
  const guestSize = guest.attendingCount || 1;
 
  let availableTable = findAvailableTableSimulation(optionSeating, guestSize, allGuests);
 
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
   
    const finalOccupancy = optionSeating.arrangement[availableTable.id].reduce((sum, guestId) => {
      const g = allGuests.find(guest => guest._id.toString() === guestId);
      return sum + (g?.attendingCount || 1);
    }, 0);
   
    if (finalOccupancy > availableTable.capacity) {
      // Handle overcapacity in simulation
    }
   
    actions.push({
      action: 'guest_seated',
      details: {
        guestName: `${guest.firstName} ${guest.lastName}`,
        tableName: availableTable.name,
        attendingCount: guestSize
      }
    });
  }
 
  return { actions };
};

const simulateUnseatGuest = async (optionSeating, guestId, allGuests, req) => {
  const actions = [];
  let guestName = req.t('seating.unknownGuest');
 
  const guest = allGuests.find(g => g._id.toString() === guestId) ||
               allGuests.find(g => g._id === guestId);
  if (guest) {
    guestName = `${guest.firstName} ${guest.lastName}`;
  }
 
  let wasSeated = false;
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
 
  return { actions };
};

const simulateAttendingCountChange = async (optionSeating, changeData, allGuests, req, strategy) => {
  const actions = [];
  const { guestId, guest, oldCount, newCount } = changeData;
 
  let guestTableId = null;
  Object.keys(optionSeating.arrangement).forEach(tableId => {
    if (optionSeating.arrangement[tableId].includes(guestId)) {
      guestTableId = tableId;
    }
  });

  if (!guestTableId) {
    const result = await simulateSeatNewGuest(optionSeating, guest, allGuests, req, strategy);
    return result;
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

    let newTable = findAvailableTableSimulation(optionSeating, newCount, allGuests);
   
    if (!newTable) {
      const tableNumber = optionSeating.tables.length + 1;
      const optimalCapacity = Math.max(
        strategy === 'conservative' ? 12 : 12,
        Math.ceil(newCount * 1.5)
      );
     
      newTable = createTableSimulation(optionSeating, optimalCapacity, tableNumber, req);
     
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
   
    if (!optionSeating.arrangement[newTable.id].includes(guestId)) {
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
   
    const finalOccupancy = optionSeating.arrangement[newTable.id].reduce((sum, gId) => {
      const g = allGuests.find(guest => guest._id.toString() === gId);
      return sum + (g?.attendingCount || 1);
    }, 0);
   
    if (finalOccupancy > newTable.capacity) {
      // Handle overcapacity in simulation
    }
  }

  return { actions };
};

const findAvailableTableSimulation = (optionSeating, guestSize, allGuests) => {
  return optionSeating.tables.find(table => {
    const tableGuests = optionSeating.arrangement[table.id] || [];
    const currentOccupancy = tableGuests.reduce((sum, guestId) => {
      const guest = allGuests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
   
    return (table.capacity - currentOccupancy) >= guestSize;
  });
};

const determineOptimalTableSize = (existingTables, guestSize, strategy) => {
  if (existingTables.length === 0) {
    return Math.max(8, guestSize * 2);
  }

  const tableSizes = existingTables.map(t => t.capacity);
  const sizeCount = {};
  tableSizes.forEach(size => {
    sizeCount[size] = (sizeCount[size] || 0) + 1;
  });

  const mostCommonSize = Object.keys(sizeCount)
    .reduce((a, b) => sizeCount[a] > sizeCount[b] ? a : b);

  if (strategy === 'conservative') {
    return parseInt(mostCommonSize);
  } else {
    const targetSize = parseInt(mostCommonSize);
    return Math.max(targetSize, Math.ceil(guestSize * 1.5));
  }
};

const createTableSimulation = (optionSeating, capacity, tableNumber, req) => {
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
        tableName = `שולחן ${tableNumber}`;
      }
    }
  } catch (error) {
    tableName = `שולחן ${tableNumber}`;
  }
 
  const newTable = {
    id: `sync_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: tableName,
    type: capacity <= 8 ? 'round' : 'rectangular',
    capacity: capacity,
    position: {
      x: 300 + ((tableNumber - 1) % 3) * 200,
      y: 300 + Math.floor((tableNumber - 1) / 3) * 200
    },
    rotation: 0,
    size: capacity <= 8 ?
      { width: 120, height: 120 } :
      { width: 160, height: 100 },
    autoCreated: true,
    createdForSync: true
  };

  optionSeating.tables.push(newTable);
  return newTable;
};

const updateTableNamesWithGroupsInSync = (tables, arrangement, guests, req) => {
  return tables.map(table => {
    const basicNamePattern = new RegExp(`^${req.t('seating.tableName')} \\d+$`);
    if (!basicNamePattern.test(table.name)) {
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

  optionSeating.tables.forEach(table => {
    const tableGuests = optionSeating.arrangement[table.id] || [];
    const tableOccupancy = tableGuests.reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);

    if (tableOccupancy === 0) {
      tablesToRemove.push(table.id);
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

  return { wasOptimized: optimized, actions };
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

const extractAffectedGuests = (triggers, guests) => {
  const affectedGuestIds = new Set();
 
  triggers.forEach(trigger => {
    const { changeData } = trigger;
   
    if (changeData.guestId) {
      affectedGuestIds.add(changeData.guestId);
    }
    if (changeData.guest && changeData.guest._id) {
      affectedGuestIds.add(changeData.guest._id.toString());
    }
  });

  return Array.from(affectedGuestIds).map(guestId => {
    const guest = guests.find(g => g._id.toString() === guestId);
    return guest ? {
      id: guest._id,
      name: `${guest.firstName} ${guest.lastName}`,
      attendingCount: guest.attendingCount || 1,
      group: guest.customGroup || guest.group
    } : null;
  }).filter(Boolean);
};

const applySyncOption = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { optionId, customArrangement } = req.body;
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    let seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    await seating.populate();
    seating = await Seating.findById(seating._id);

    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    let appliedArrangement;
    let appliedTables;
    let actions = [];

    if (customArrangement) {
      appliedArrangement = customArrangement.arrangement;
      appliedTables = customArrangement.tables;
      actions = customArrangement.actions || [];
    } else {
      const pendingTriggers = seating.pendingSyncTriggers;
      if (pendingTriggers.length === 0) {
        return res.status(400).json({ message: req.t('seating.sync.noChangesToProcess') });
      }
     
      const strategy = optionId.includes('conservative') ? 'conservative' : 'optimal';
     
      const option = await generateSyncOption(seating, pendingTriggers, guests, req, strategy);
      appliedArrangement = option.arrangement;
      appliedTables = option.tables;
      actions = option.actions;
    }

    const validTableIds = new Set(appliedTables.map(t => t.id));
    const cleanedArrangement = {};
   
    Object.keys(appliedArrangement).forEach(tableId => {
      if (validTableIds.has(tableId)) {
        cleanedArrangement[tableId] = appliedArrangement[tableId];
      }
    });

    const validationErrors = validateArrangementCapacity(appliedTables, cleanedArrangement, guests, req);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: req.t('seating.sync.validationFailed'),
        errors: validationErrors
      });
    }

    seating.tables = appliedTables;
    seating.arrangement = cleanedArrangement;
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

    const cleanupResult = await cleanupEmptyTables(seating, guests, req);
    if (cleanupResult.hasChanges) {
      actions.push(...cleanupResult.actions);
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
         
          seating.tables = appliedTables;
          seating.arrangement = cleanedArrangement;
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

    const finalStats = calculateArrangementStats({
      tables: seating.tables,
      arrangement: seating.arrangement
    }, guests);

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

    res.json({
      message: req.t('seating.sync.optionApplied'),
      seating: {
        tables: seating.tables,
        arrangement: seating.arrangement,
        version: seating.version,
        syncSummary
      },
      appliedActions: actions,
      stats: finalStats,
      cleanupSummary: cleanupResult.hasChanges ? cleanupResult.cleanupSummary : null
    });

  } catch (err) {
    res.status(500).json({
      message: req.t('seating.sync.applyOptionFailed'),
      error: process.env.NODE_ENV === 'development' ? err.message : req.t('errors.serverError')
    });
  }
};

const validateArrangementCapacity = (tables, arrangement, guests, req) => {
  const errors = [];
 
  const validTableIds = new Set(tables.map(t => t.id));
  const invalidTableIds = Object.keys(arrangement).filter(tableId => !validTableIds.has(tableId));
 
  if (invalidTableIds.length > 0) {
    invalidTableIds.forEach(tableId => {
      errors.push({
        type: 'table_not_found',
        message: req.t('seating.sync.validation.tableNotFound', { tableId })
      });
    });
    return errors;
  }
 
  Object.entries(arrangement).forEach(([tableId, guestIds]) => {
    if (!Array.isArray(guestIds)) return;
   
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
   
    const totalPeople = guestIds.reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);

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

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    const movedGuests = [];
    const actions = [];

    affectedGuestIds.forEach(guestId => {
      const guest = guests.find(g => g._id.toString() === guestId);
      if (!guest) return;

      let wasMovedFromTable = null;
     
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

      if (wasMovedFromTable) {
        movedGuests.push({
          id: guest._id,
          name: `${guest.firstName} ${guest.lastName}`,
          attendingCount: guest.attendingCount || 1,
          fromTable: wasMovedFromTable
        });

        actions.push({
          action: 'guest_moved_to_unassigned',
          details: {
            guestName: `${guest.firstName} ${guest.lastName}`,
            fromTable: wasMovedFromTable,
            reason: req.t('seating.sync.movedByUserRequest')
          }
        });
      }
    });

    if (seating.syncSettings?.autoOptimizeTables) {
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

    const pendingTriggers = seating.pendingSyncTriggers;
    pendingTriggers.forEach(trigger => {
      const isRelatedTrigger = affectedGuestIds.some(guestId =>
        trigger.changeData.guestId === guestId ||
        (trigger.changeData.guest && trigger.changeData.guest._id &&
         trigger.changeData.guest._id.toString() === guestId)
      );

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

    res.json({
      message: req.t('seating.sync.guestsMovedToUnassigned', { count: movedGuests.length }),
      movedGuests,
      actions,
      seating: {
        tables: seating.tables,
        arrangement: seating.arrangement,
        version: seating.version,
        syncSummary: seating.getSyncSummary()
      },
      stats: calculateArrangementStats({
        tables: seating.tables,
        arrangement: seating.arrangement
      }, guests)
    });

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
      isSeparatedSeating
    } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ 
      event: eventId, 
      user: req.userId, 
      rsvpStatus: 'confirmed' 
    });

    if (guests.length === 0) {
      return res.status(400).json({ message: req.t('seating.errors.noConfirmedGuests') });
    }

    const enhancedPreferences = {
      ...preferences,
      seatingRules: seatingRules || preferences.seatingRules || { mustSitTogether: [], cannotSitTogether: [] },
      groupMixingRules: groupMixingRules || preferences.groupMixingRules || [],
      allowGroupMixing: allowGroupMixing !== undefined ? allowGroupMixing : (preferences.allowGroupMixing || false),
      preferredTableSize: preferredTableSize || preferences.preferredTableSize || 12,
      groupPolicies: preferences.groupPolicies || {}
    };

    let seating = await Seating.findOne({ event: eventId, user: req.userId });

    if (isSeparatedSeating) {
      const maleGuests = guests.filter(g => g.maleCount && g.maleCount > 0);
      const femaleGuests = guests.filter(g => g.femaleCount && g.femaleCount > 0);

      let maleTablesList = allMaleTables && allMaleTables.length > 0 ? allMaleTables : (maleTables || []);
      let femaleTablesList = allFemaleTables && allFemaleTables.length > 0 ? allFemaleTables : (femaleTables || []);

      if (!maleTablesList || maleTablesList.length === 0) {
        const totalMaleGuests = maleGuests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
        const maleTablesToCreate = createAdditionalTables(totalMaleGuests, 0, req, enhancedPreferences.preferredTableSize);
        maleTablesList = maleTablesToCreate;
      }

      if (!femaleTablesList || femaleTablesList.length === 0) {
        const totalFemaleGuests = femaleGuests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
        const femaleTablesToCreate = createAdditionalTables(totalFemaleGuests, 0, req, enhancedPreferences.preferredTableSize);
        femaleTablesList = femaleTablesToCreate;
      }

      let aiMaleArrangement, aiFemaleArrangement;

      if (preserveExisting && currentMaleArrangement && Object.keys(currentMaleArrangement).length > 0) {
        const seatedMaleGuestIds = new Set(Object.values(currentMaleArrangement).flat());
        const unassignedMaleGuests = maleGuests.filter(guest => !seatedMaleGuestIds.has(guest._id.toString()));
        const unassignedMalePeopleCount = unassignedMaleGuests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
        
        const availableMaleCapacity = maleTablesList.reduce((sum, table) => {
          const tableGuests = currentMaleArrangement[table.id] || [];
          const currentOccupancy = tableGuests.reduce((sum, guestId) => {
            const guest = maleGuests.find(g => g._id.toString() === guestId);
            return sum + (guest?.maleCount || 0);
          }, 0);
          return sum + Math.max(0, table.capacity - currentOccupancy);
        }, 0);

        const receivedNewTables = allMaleTables && allMaleTables.length > (maleTables?.length || 0);
        if (!receivedNewTables && availableMaleCapacity < unassignedMalePeopleCount) {
          const additionalCapacityNeeded = unassignedMalePeopleCount - availableMaleCapacity;
          const additionalTables = createAdditionalTables(additionalCapacityNeeded, maleTablesList.length, req, enhancedPreferences.preferredTableSize);
          maleTablesList = [...maleTablesList, ...additionalTables];
        }

        aiMaleArrangement = generateOptimalSeatingWithExisting(maleGuests, maleTablesList, enhancedPreferences, currentMaleArrangement);
      } else {
        const totalMaleGuests = maleGuests.reduce((sum, guest) => sum + (guest.maleCount || 0), 0);
        const totalMaleCapacity = maleTablesList.reduce((sum, table) => sum + table.capacity, 0);
        
        if (totalMaleCapacity < totalMaleGuests) {
          const receivedNewTables = allMaleTables && allMaleTables.length > (maleTables?.length || 0);
          if (!receivedNewTables) {
            const additionalCapacityNeeded = totalMaleGuests - totalMaleCapacity;
            const additionalTables = createAdditionalTables(additionalCapacityNeeded, maleTablesList.length, req, enhancedPreferences.preferredTableSize);
            maleTablesList = [...maleTablesList, ...additionalTables];
          }
        }
        
        aiMaleArrangement = generateOptimalSeating(maleGuests, maleTablesList, enhancedPreferences);
      }

      if (preserveExisting && currentFemaleArrangement && Object.keys(currentFemaleArrangement).length > 0) {
        const seatedFemaleGuestIds = new Set(Object.values(currentFemaleArrangement).flat());
        const unassignedFemaleGuests = femaleGuests.filter(guest => !seatedFemaleGuestIds.has(guest._id.toString()));
        const unassignedFemalePeopleCount = unassignedFemaleGuests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
        
        const availableFemaleCapacity = femaleTablesList.reduce((sum, table) => {
          const tableGuests = currentFemaleArrangement[table.id] || [];
          const currentOccupancy = tableGuests.reduce((sum, guestId) => {
            const guest = femaleGuests.find(g => g._id.toString() === guestId);
            return sum + (guest?.femaleCount || 0);
          }, 0);
          return sum + Math.max(0, table.capacity - currentOccupancy);
        }, 0);

        const receivedNewTables = allFemaleTables && allFemaleTables.length > (femaleTables?.length || 0);
        if (!receivedNewTables && availableFemaleCapacity < unassignedFemalePeopleCount) {
          const additionalCapacityNeeded = unassignedFemalePeopleCount - availableFemaleCapacity;
          const additionalTables = createAdditionalTables(additionalCapacityNeeded, femaleTablesList.length, req, enhancedPreferences.preferredTableSize);
          femaleTablesList = [...femaleTablesList, ...additionalTables];
        }

        aiFemaleArrangement = generateOptimalSeatingWithExisting(femaleGuests, femaleTablesList, enhancedPreferences, currentFemaleArrangement);
      } else {
        const totalFemaleGuests = femaleGuests.reduce((sum, guest) => sum + (guest.femaleCount || 0), 0);
        const totalFemaleCapacity = femaleTablesList.reduce((sum, table) => sum + table.capacity, 0);
        
        if (totalFemaleCapacity < totalFemaleGuests) {
          const receivedNewTables = allFemaleTables && allFemaleTables.length > (femaleTables?.length || 0);
          if (!receivedNewTables) {
            const additionalCapacityNeeded = totalFemaleGuests - totalFemaleCapacity;
            const additionalTables = createAdditionalTables(additionalCapacityNeeded, femaleTablesList.length, req, enhancedPreferences.preferredTableSize);
            femaleTablesList = [...femaleTablesList, ...additionalTables];
          }
        }
        
        aiFemaleArrangement = generateOptimalSeating(femaleGuests, femaleTablesList, enhancedPreferences);
      }

      if (seating) {
        seating.maleTables = maleTablesList;
        seating.femaleTables = femaleTablesList;
        seating.maleArrangement = aiMaleArrangement;
        seating.femaleArrangement = aiFemaleArrangement;
        seating.isSeparatedSeating = true;
        seating.generatedBy = 'ai';
        seating.preferences = enhancedPreferences;
        seating.version += 1;
        seating.updatedAt = new Date();
        
        seating.syncTriggers = [];
        seating.lastSyncProcessed = new Date();
        
        await seating.save();
      } else {
        seating = new Seating({
          event: eventId,
          user: req.userId,
          maleTables: maleTablesList,
          femaleTables: femaleTablesList,
          maleArrangement: aiMaleArrangement,
          femaleArrangement: aiFemaleArrangement,
          isSeparatedSeating: true,
          preferences: enhancedPreferences,
          generatedBy: 'ai',
          tables: [],
          arrangement: {}
        });
        
        await seating.save();
      }

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
      
      if (!tablesToUse || tablesToUse.length === 0) {
        return res.status(400).json({ message: req.t('seating.errors.noTables') });
      }

      let aiArrangement;

      if (preserveExisting && currentArrangement && Object.keys(currentArrangement).length > 0) {
        const seatedGuestIds = new Set(Object.values(currentArrangement).flat());
        const unassignedGuests = guests.filter(guest => !seatedGuestIds.has(guest._id.toString()));
        const unassignedPeopleCount = unassignedGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        
        const availableCapacity = tablesToUse.reduce((sum, table) => {
          const tableGuests = currentArrangement[table.id] || [];
          const currentOccupancy = tableGuests.reduce((sum, guestId) => {
            const guest = guests.find(g => g._id.toString() === guestId);
            return sum + (guest?.attendingCount || 1);
          }, 0);
          return sum + Math.max(0, table.capacity - currentOccupancy);
        }, 0);

        const receivedNewTables = allTables && allTables.length > tables.length;
        if (!receivedNewTables && availableCapacity < unassignedPeopleCount) {
          const additionalCapacityNeeded = unassignedPeopleCount - availableCapacity;
          const additionalTables = createAdditionalTables(additionalCapacityNeeded, tablesToUse.length, req, enhancedPreferences.preferredTableSize);
          tablesToUse = [...tablesToUse, ...additionalTables];
        }

        aiArrangement = generateOptimalSeatingWithExisting(guests, tablesToUse, enhancedPreferences, currentArrangement);
      } else {
        const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        const totalCapacity = tablesToUse.reduce((sum, table) => sum + table.capacity, 0);
        
        if (totalCapacity < totalGuests) {
          const receivedNewTables = allTables && allTables.length > tables.length;
          if (!receivedNewTables) {
            const additionalCapacityNeeded = totalGuests - totalCapacity;
            const additionalTables = createAdditionalTables(additionalCapacityNeeded, tablesToUse.length, req, enhancedPreferences.preferredTableSize);
            tablesToUse = [...tablesToUse, ...additionalTables];
          }
        }
        
        aiArrangement = generateOptimalSeating(guests, tablesToUse, enhancedPreferences);
      }

      if (seating) {
        seating.tables = tablesToUse;
        seating.arrangement = aiArrangement;
        seating.isSeparatedSeating = false;
        seating.generatedBy = 'ai';
        seating.preferences = enhancedPreferences;
        seating.version += 1;
        seating.updatedAt = new Date();
        
        seating.syncTriggers = [];
        seating.lastSyncProcessed = new Date();
        
        await seating.save();
      } else {
        seating = new Seating({
          event: eventId,
          user: req.userId,
          tables: tablesToUse,
          arrangement: aiArrangement,
          isSeparatedSeating: false,
          preferences: enhancedPreferences,
          generatedBy: 'ai'
        });
        
        await seating.save();
      }

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

function findOptimalCombination(guests, targetCapacity, preferences) {
  const guestSizes = guests.map(g => ({
    guest: g,
    size: g.attendingCount || 1
  }));
 
  guestSizes.sort((a, b) => b.size - a.size);
 
  function findExactMatch(remaining, index, current, currentSize) {
    if (currentSize === targetCapacity) {
      return current;
    }
   
    if (index >= remaining.length || currentSize > targetCapacity) {
      return null;
    }
   
    for (let i = index; i < remaining.length; i++) {
      const newSize = currentSize + remaining[i].size;
      if (newSize <= targetCapacity) {
        const result = findExactMatch(
          remaining,
          i + 1,
          [...current, remaining[i].guest],
          newSize
        );
        if (result) return result;
      }
    }
   
    return null;
  }
 
  const exactMatch = findExactMatch(guestSizes, 0, [], 0);
  if (exactMatch) {
    return exactMatch;
  }
 
  let bestCombination = [];
  let bestSize = 0;
 
  function findBestFit(remaining, index, current, currentSize) {
    if (currentSize > bestSize && currentSize <= targetCapacity) {
      bestSize = currentSize;
      bestCombination = [...current];
    }
   
    if (index >= remaining.length || currentSize >= targetCapacity) {
      return;
    }
   
    for (let i = index; i < remaining.length; i++) {
      const newSize = currentSize + remaining[i].size;
      if (newSize <= targetCapacity) {
        findBestFit(
          remaining,
          i + 1,
          [...current, remaining[i].guest],
          newSize
        );
      }
    }
  }
 
  findBestFit(guestSizes, 0, [], 0);
 
  return bestCombination.length > 0 ? bestCombination : null;
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

    const hasDirectRule = groupMixingRules.some(rule => 
      (rule.group1 === group1 && rule.group2 === group2) ||
      (rule.group1 === group2 && rule.group2 === group1)
    );

    if (hasDirectRule) return true;

    if (clusterMap && clusterMap.has(group1) && clusterMap.has(group2)) {
      return clusterMap.get(group1) === clusterMap.get(group2);
    }

    return false;
  }

  return false;
}

function groupGuestsByClusters(guests, mixingMode, clusterMap, alreadyAssigned, groupPolicies) {
  const clusterGuests = new Map();
  const noClusterGuests = [];
  const separateGroups = new Map();
  const allFlexibleGuests = [];

  guests.forEach(guest => {
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

function assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, allGuests, alreadyAssigned, req) {
  const guestId = guest._id.toString();
  
  if (alreadyAssigned && alreadyAssigned.has(guestId)) {
    return false;
  }
  
  for (const tableId in arrangement) {
    if (arrangement[tableId] && arrangement[tableId].includes(guestId)) {
      if (alreadyAssigned) {
        alreadyAssigned.add(guestId);
      }
      return false;
    }
  }
  
  const guestSize = guest.attendingCount || 1;
  if (table.remainingCapacity < guestSize) {
    return false;
  }

  if (hasSeparationConflicts([guest], table, preferences, allGuests)) {
    return false;
  }

  const guestGroup = guest.customGroup || guest.group;
  const groupPolicies = preferences.groupPolicies || {};
  const guestPolicy = groupPolicies[guestGroup] || 'M';

  if (guestPolicy === 'S') {
    const tableGuests = table.assignedGuests.map(gId => 
      allGuests.find(g => g._id.toString() === gId)
    ).filter(Boolean);

    const hasOtherGroups = tableGuests.some(g => {
      const tGroup = g.customGroup || g.group;
      return tGroup !== guestGroup;
    });

    if (hasOtherGroups) {
      return false;
    }
  }

  if (!arrangement[table.id]) {
    arrangement[table.id] = [];
  }
  
  arrangement[table.id].push(guestId);
  table.assignedGuests.push(guestId);
  table.remainingCapacity -= guestSize;
  
  if (alreadyAssigned) {
    alreadyAssigned.add(guestId);
  }
  
  return true;
}

function determineMixingMode(preferences) {
  if (!preferences.allowGroupMixing) {
    return 'none';
  }

  if (!preferences.groupMixingRules || preferences.groupMixingRules.length === 0) {
    return 'free';
  }

  return 'rules';
}

function generateOptimalSeatingWithExisting(guests, tables, preferences, existingArrangement) {
  const mixingMode = determineMixingMode(preferences);
  
  const arrangement = JSON.parse(JSON.stringify(existingArrangement || {}));
  
  const cleanedArrangement = {};
  const seenGuests = new Set();
  
  Object.keys(arrangement).forEach(tableId => {
    const guestIds = arrangement[tableId] || [];
    const uniqueGuests = [];
    
    guestIds.forEach(guestId => {
      if (!seenGuests.has(guestId)) {
        seenGuests.add(guestId);
        uniqueGuests.push(guestId);
      }
    });
    
    if (uniqueGuests.length > 0) {
      cleanedArrangement[tableId] = uniqueGuests;
    }
  });
  
  Object.keys(arrangement).forEach(key => delete arrangement[key]);
  Object.assign(arrangement, cleanedArrangement);
  
  const availableTables = tables.map(table => {
    const existingGuestIds = arrangement[table.id] || [];
    const existingGuests = existingGuestIds.map(gId => 
      guests.find(g => g._id.toString() === gId)
    ).filter(Boolean);
    
    const occupiedCapacity = existingGuests.reduce((sum, g) => 
      sum + (g.attendingCount || 1), 0
    );
    
    return {
      ...table,
      remainingCapacity: table.capacity - occupiedCapacity,
      assignedGuests: [...existingGuestIds]
    };
  });

  const alreadyAssigned = new Set();
  Object.values(arrangement).forEach(guestIds => {
    if (Array.isArray(guestIds)) {
      guestIds.forEach(id => alreadyAssigned.add(id));
    }
  });

  const clusterMap = mixingMode === 'rules' ? buildMixingClusters(preferences.groupMixingRules) : new Map();

  const groupPolicies = preferences.groupPolicies || {};
  const separateGroupsList = [];
  const separateGroupSizes = {};
  
  guests.forEach(guest => {
    if (alreadyAssigned.has(guest._id.toString())) return;
    
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
  
  const tablesWithSGroupGuests = new Map();
  availableTables.forEach(table => {
    if (table.assignedGuests.length === 0) return;
    
    const tableGuests = table.assignedGuests.map(gId => 
      guests.find(g => g._id.toString() === gId)
    ).filter(Boolean);
    
    if (tableGuests.length === 0) return;
    
    const sGroupsInTable = new Set();
    tableGuests.forEach(g => {
      const group = g.customGroup || g.group;
      const policy = groupPolicies[group];
      if (policy === 'S') {
        sGroupsInTable.add(group);
      }
    });
    
    if (sGroupsInTable.size > 0) {
      tablesWithSGroupGuests.set(table.id, sGroupsInTable);
    }
  });
  
  const reservedTablesForSGroups = new Map();
  const reservedTableIds = new Set();
  
  separateGroupsList.forEach(groupName => {
    const alreadySeatedInTable = Array.from(tablesWithSGroupGuests.entries()).find(
      ([tableId, groups]) => groups.has(groupName)
    );
    
    if (alreadySeatedInTable) {
      return;
    }
    
    const groupSize = separateGroupSizes[groupName];
    
    const suitableTable = availableTables.find(table => 
      !reservedTableIds.has(table.id) &&
      table.assignedGuests.length === 0 &&
      table.capacity >= groupSize
    );
    
    if (suitableTable) {
      reservedTablesForSGroups.set(groupName, suitableTable.id);
      reservedTableIds.add(suitableTable.id);
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
          !tablesWithSGroupGuests.has(table.id) &&
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
  unreservedTables.sort((a, b) => b.capacity - a.capacity);

  const groupedGuests = {};
  guests.forEach(guest => {
    if (alreadyAssigned.has(guest._id.toString())) return;
    const group = guest.customGroup || guest.group;
    if (!groupedGuests[group]) groupedGuests[group] = [];
    groupedGuests[group].push(guest);
  });

  const sortedGroups = Object.entries(groupedGuests).sort((a, b) => {
    const aTotal = a[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const bTotal = b[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    return bTotal - aTotal;
  });

  sortedGroups.forEach(([, guestList]) => {
    guestList.sort((a, b) => (b.attendingCount || 1) - (a.attendingCount || 1));
  });

  sortedGroups.forEach(([groupName, groupGuests]) => {
    const groupPolicy = groupPolicies[groupName];
    const unassigned = groupGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;
    
    const tablesWithSameGroup = unreservedTables.filter(table => {
      if (table.assignedGuests.length === 0) return false;
      
      const tableGuests = table.assignedGuests.map(gId => 
        guests.find(g => g._id.toString() === gId)
      ).filter(Boolean);
      
      const allSameGroup = tableGuests.every(g => {
        const tGroup = g.customGroup || g.group;
        return tGroup === groupName;
      });
      
      if (!allSameGroup) return false;
      
      const sGroupsInTable = tablesWithSGroupGuests.get(table.id);
      if (sGroupsInTable && sGroupsInTable.size > 0) {
        return sGroupsInTable.has(groupName);
      }
      
      return true;
    });
    
    for (const table of tablesWithSameGroup) {
      const stillUnassigned = unassigned.filter(g => !alreadyAssigned.has(g._id.toString()));
      if (stillUnassigned.length === 0) break;
      
      for (const guest of stillUnassigned) {
        if (table.remainingCapacity >= (guest.attendingCount || 1)) {
          assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        }
      }
    }
  });

  if (mixingMode === 'rules' && clusterMap.size > 0) {
    const clusterGroups = new Map();
    clusterMap.forEach((clusterId, groupName) => {
      const policy = groupPolicies[groupName];
      if (policy === 'S') return;
      
      if (!clusterGroups.has(clusterId)) {
        clusterGroups.set(clusterId, []);
      }
      clusterGroups.get(clusterId).push(groupName);
    });
    
    clusterGroups.forEach((groupNames, clusterId) => {
      const clusterUnassigned = [];
      groupNames.forEach(groupName => {
        const groupGuests = groupedGuests[groupName] || [];
        const unassigned = groupGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
        unassigned.forEach(guest => {
          clusterUnassigned.push({ guest, group: groupName });
        });
      });
      
      const totalClusterSize = clusterUnassigned.reduce((sum, item) => 
        sum + (item.guest.attendingCount || 1), 0
      );
      
      if (clusterUnassigned.length === 0) return;
      
      clusterUnassigned.sort((a, b) => 
        (b.guest.attendingCount || 1) - (a.guest.attendingCount || 1)
      );
      
      let availableCapacityTotal = 0;
      let capacityInExistingClusterTables = 0;
      let capacityInEmptyTables = 0;
      
      unreservedTables.forEach(table => {
        if (table.assignedGuests.length > 0) {
          const tableGroups = new Set();
          table.assignedGuests.forEach(gId => {
            const g = guests.find(guest => guest._id.toString() === gId);
            if (g) {
              const group = g.customGroup || g.group;
              tableGroups.add(group);
            }
          });
          
          const hasClusterGroups = Array.from(tableGroups).some(tGroup => 
            groupNames.includes(tGroup)
          );
          
          if (hasClusterGroups && tableGroups.size === 1) {
            capacityInExistingClusterTables += table.remainingCapacity;
          }
        } 
        else if (!tablesWithSGroupGuests.has(table.id)) {
          capacityInEmptyTables += table.capacity;
        }
      });
      
      availableCapacityTotal = capacityInExistingClusterTables + capacityInEmptyTables;
      
      const needsNewCapacity = Math.max(0, totalClusterSize - availableCapacityTotal);
      
      if (needsNewCapacity === 0) {
        const availableTablesToFill = unreservedTables.filter(t => {
          if (t.assignedGuests.length > 0) {
            const tableGuests = t.assignedGuests.map(gId => 
              guests.find(guest => guest._id.toString() === gId)
            ).filter(Boolean);
            
            const hasSGuests = tableGuests.some(g => {
              const group = g.customGroup || g.group;
              const policy = groupPolicies[group] || 'M';
              return policy === 'S';
            });
            
            return !hasSGuests && t.remainingCapacity > 0;
          }
          
          return !reservedTableIds.has(t.id);
        }).sort((a, b) => {
          if (a.capacity === 12 && b.capacity !== 12) return -1;
          if (b.capacity === 12 && a.capacity !== 12) return 1;
          return b.capacity - a.capacity;
        });
        
        for (const table of availableTablesToFill) {
          const stillUnassigned = clusterUnassigned.filter(item => 
            !alreadyAssigned.has(item.guest._id.toString())
          );
          
          if (stillUnassigned.length === 0) break;
          
          for (const item of stillUnassigned) {
            if (table.remainingCapacity >= (item.guest.attendingCount || 1)) {
              assignGuestToTableAdvanced(item.guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
            }
          }
        }
      } else {
        const emptyTables = unreservedTables.filter(t => 
          t.assignedGuests.length === 0 &&
          !tablesWithSGroupGuests.has(t.id)
        ).sort((a, b) => {
          if (a.capacity === 12 && b.capacity !== 12) return -1;
          if (b.capacity === 12 && a.capacity !== 12) return 1;
          return b.capacity - a.capacity;
        });
        
        let remainingToSeat = needsNewCapacity;
        const tablesToUse = [];
        
        for (const table of emptyTables) {
          if (remainingToSeat <= 0) break;
          tablesToUse.push(table);
          remainingToSeat -= table.capacity;
        }
        
        for (const table of tablesToUse) {
          const stillUnassigned = clusterUnassigned.filter(item => 
            !alreadyAssigned.has(item.guest._id.toString())
          );
          
          if (stillUnassigned.length === 0) break;
          
          for (const item of stillUnassigned) {
            if (table.remainingCapacity >= (item.guest.attendingCount || 1)) {
              assignGuestToTableAdvanced(item.guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
            }
          }
        }
      }
    });
  }

  sortedGroups.forEach(([groupName, groupGuests]) => {
    const groupPolicy = groupPolicies[groupName];
    if (groupPolicy === 'S') return;
    
    const unassigned = groupGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;
    
    const emptyTables = unreservedTables.filter(t => 
      t.assignedGuests.length === 0 &&
      !tablesWithSGroupGuests.has(t.id)
    );
    
    for (const table of emptyTables) {
      const stillUnassigned = unassigned.filter(g => !alreadyAssigned.has(g._id.toString()));
      if (stillUnassigned.length === 0) break;
      
      for (const guest of stillUnassigned) {
        if (table.remainingCapacity >= (guest.attendingCount || 1)) {
          assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        }
      }
    }
  });

  const { separateGroups } = groupGuestsByClusters(
    guests, 
    mixingMode,
    clusterMap, 
    alreadyAssigned,
    preferences.groupPolicies
  );

  separateGroups.forEach((guestsInGroup, group) => {
    const unassigned = guestsInGroup.filter(g => !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;

    const existingTableForGroup = availableTables.find(table => {
      const sGroups = tablesWithSGroupGuests.get(table.id);
      return sGroups && sGroups.has(group) && sGroups.size === 1;
    });
    
    if (existingTableForGroup && existingTableForGroup.remainingCapacity > 0) {
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
        t.assignedGuests.length === 0 &&
        !tablesWithSGroupGuests.has(t.id)
      );
    }
    
    if (targetTable) {
      unassigned.forEach(guest => {
        assignGuestToTableAdvanced(guest, targetTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
      });
    }
  });

  const stillUnassigned = guests.filter(g => !alreadyAssigned.has(g._id.toString()));
  
  if (stillUnassigned.length > 0) {
    stillUnassigned.forEach(guest => {
      for (const table of availableTables) {
        if (table.remainingCapacity >= (guest.attendingCount || 1)) {
          if (canGuestBeAssignedToTable(guest, table, arrangement, guests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests)) {
            assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
            break;
          }
        }
      }
    });
  }
  
  return arrangement;
}

function canGuestBeAssignedToTable(guest, table, arrangement, allGuests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests) {
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
    
    if (!canGroupsMix(guestGroup, tGroup, mixingMode, null, clusterMap, groupPolicies)) {
      return false;
    }
  }
  
  return true;
}

function canGuestBeAssignedToTable(guest, table, arrangement, allGuests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests) {
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
    
    if (!canGroupsMix(guestGroup, tGroup, mixingMode, null, clusterMap, groupPolicies)) {
      return false;
    }
  }
  
  return true;
}

function canGuestBeAssignedToTable(guest, table, arrangement, allGuests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests) {
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
    
    if (!canGroupsMix(guestGroup, tGroup, mixingMode, null, clusterMap, groupPolicies)) {
      return false;
    }
  }
  
  return true;
}

function canGuestBeAssignedToTable(guest, table, arrangement, allGuests, groupPolicies, clusterMap, mixingMode, tablesWithSGroupGuests) {
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
    
    if (!canGroupsMix(guestGroup, tGroup, mixingMode, null, clusterMap, groupPolicies)) {
      return false;
    }
  }
  
  return true;
}

function createAdditionalTables(additionalCapacityNeeded, existingTablesCount, req, preferredTableSize = 12) {
  const additionalTables = [];
  let remainingCapacity = additionalCapacityNeeded;
  let tableCounter = existingTablesCount + 1;
 
  while (remainingCapacity > 0) {
    let tableCapacity;
   
    if (remainingCapacity >= preferredTableSize - 2 && remainingCapacity <= preferredTableSize + 4) {
      tableCapacity = preferredTableSize;
    } else if (remainingCapacity <= 8) {
      tableCapacity = preferredTableSize;
    } else if (remainingCapacity <= 10) {
      tableCapacity = 10;
    } else if (remainingCapacity <= preferredTableSize) {
      tableCapacity = preferredTableSize;
    } else if (remainingCapacity <= 16) {
      tableCapacity = preferredTableSize;
    } else if (remainingCapacity <= 20) {
      tableCapacity = preferredTableSize;
    } else {
      if (remainingCapacity % preferredTableSize <= 3) {
        tableCapacity = preferredTableSize;
      } else if (remainingCapacity % 10 <= 3) {
        tableCapacity = 10;
      } else {
        tableCapacity = preferredTableSize;
      }
    }
   
    const tableName = req.t('seating.tableName', { number: tableCounter });
   
    const newTable = {
      id: `auto_table_${Date.now()}_${tableCounter}_${Math.random().toString(36).substr(2, 9)}`,
      name: tableName,
      type: tableCapacity <= 10 ? 'round' : 'rectangular',
      capacity: tableCapacity,
      position: {
        x: 300 + (tableCounter % 3) * 200,
        y: 300 + Math.floor(tableCounter / 3) * 200
      },
      rotation: 0,
      size: tableCapacity <= 10 ?
        { width: 120, height: 120 } :
        { width: 160, height: 100 },
      autoCreated: true,
      createdForSync: false
    };
   
    additionalTables.push(newTable);
    remainingCapacity -= tableCapacity;
    tableCounter++;
  }
 
  return additionalTables;
}

function generateOptimalSeating(guests, tables, preferences) {
  
  const mixingMode = determineMixingMode(preferences);
  
  const arrangement = {};
  const availableTables = tables.map(table => ({
    ...table,
    remainingCapacity: table.capacity,
    assignedGuests: []
  }));

  const alreadyAssigned = new Set();

  const clusterMap = mixingMode === 'rules' ? buildMixingClusters(preferences.groupMixingRules) : new Map();

  const groupPolicies = preferences.groupPolicies || {};
  const separateGroupsList = [];
  const separateGroupSizes = {};
  
  guests.forEach(guest => {
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
    if (alreadyAssigned.has(guest._id.toString())) return;
    const group = guest.customGroup || guest.group;
    if (!groupedGuests[group]) groupedGuests[group] = [];
    groupedGuests[group].push(guest);
  });

  const sortedGroups = Object.entries(groupedGuests).sort((a, b) => {
    const aTotal = a[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    const bTotal = b[1].reduce((sum, g) => sum + (g.attendingCount || 1), 0);
    return bTotal - aTotal;
  });

  sortedGroups.forEach(([, guestList]) => {
    guestList.sort((a, b) => (b.attendingCount || 1) - (a.attendingCount || 1));
  });

  sortedGroups.forEach(([groupName, groupGuests]) => {
    const groupPolicy = groupPolicies[groupName];
    if (groupPolicy === 'S') return;
    
    const unassigned = groupGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;
    
    const emptyTables = unreservedTables.filter(t => t.assignedGuests.length === 0);
    emptyTables.sort((a, b) => b.capacity - a.capacity);
    
    for (const table of emptyTables) {
      const stillUnassigned = unassigned.filter(g => !alreadyAssigned.has(g._id.toString()));
      if (stillUnassigned.length === 0) break;
      
      const combo = findOptimalCombination(stillUnassigned, table.capacity, preferences);
      
      if (combo && combo.length > 0) {
        for (const guest of combo) {
          assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        }
      }
    }
  });

  const { clusterGuests, noClusterGuests, separateGroups, allFlexibleGuests } = groupGuestsByClusters(
    guests, 
    mixingMode,
    clusterMap, 
    alreadyAssigned,
    preferences.groupPolicies
  );

  separateGroups.forEach((guestsInGroup, group) => {
    const unassigned = guestsInGroup.filter(g => !alreadyAssigned.has(g._id.toString()));
    if (unassigned.length === 0) return;


    const reservedTableId = reservedTablesForSGroups.get(group);
    let targetTable = null;
    
    if (reservedTableId) {
      targetTable = availableTables.find(t => t.id === reservedTableId);
    }
    
    if (!targetTable) {
      targetTable = availableTables.find(t => t.assignedGuests.length === 0);
    }
    
    if (targetTable) {
      unassigned.forEach(guest => {
        assignGuestToTableAdvanced(guest, targetTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
      });
    } else {
      console.error(` No table available for S group ${group}!`);
    }
  });

  if (mixingMode === 'rules') {
    clusterGuests.forEach((guestsInCluster) => {
      const unassigned = guestsInCluster.filter(g => !alreadyAssigned.has(g._id.toString()));
      unassigned.forEach(guest => {
        for (const table of unreservedTables) {
          if (assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key })) {
            break;
          }
        }
      });
    });
  }

  if (mixingMode === 'free' && allFlexibleGuests.length > 0) {
    const unassigned = allFlexibleGuests.filter(g => !alreadyAssigned.has(g._id.toString()));
    unassigned.forEach(guest => {
      for (const table of unreservedTables) {
        if (assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key })) {
          break;
        }
      }
    });
  }

  sortedGroups.forEach(([groupName, groupGuests]) => {
    groupGuests.forEach(guest => {
      if (alreadyAssigned.has(guest._id.toString())) return;
      
      const guestGroup = guest.customGroup || guest.group;
      let assigned = false;

      for (const table of unreservedTables) {
        const tableGroups = table.assignedGuests.map(gId => {
          const g = guests.find(guest => guest._id.toString() === gId);
          return g ? (g.customGroup || g.group) : null;
        }).filter(Boolean);
        
        if (tableGroups.length > 0 && tableGroups.every(g => g === guestGroup)) {
          if (assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key })) {
            assigned = true;
            break;
          }
        }
      }

      if (assigned) return;

      if (mixingMode !== 'none') {
        for (const table of unreservedTables) {
          const tableGroups = table.assignedGuests.map(gId => {
            const g = guests.find(guest => guest._id.toString() === gId);
            return g ? (g.customGroup || g.group) : null;
          }).filter(Boolean);
          
          if (tableGroups.length > 0) {
            const canMixWithAll = tableGroups.every(tGroup => 
              canGroupsMix(guestGroup, tGroup, mixingMode, preferences.groupMixingRules, clusterMap, preferences.groupPolicies)
            );
            
            if (canMixWithAll) {
              if (assignGuestToTableAdvanced(guest, table, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key })) {
                assigned = true;
                break;
              }
            }
          }
        }
      }

      if (assigned) return;

      const emptyTable = availableTables.find(t => 
        !reservedTableIds.has(t.id) &&
        t.assignedGuests.length === 0 && 
        t.remainingCapacity >= (guest.attendingCount || 1)
      );
      
      if (emptyTable) {
        assignGuestToTableAdvanced(guest, emptyTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
      }
    });
  });

  const stillUnassigned = guests.filter(g => !alreadyAssigned.has(g._id.toString()));
  
  if (stillUnassigned.length > 0) {
    
    stillUnassigned.forEach(guest => {
      const guestGroup = guest.customGroup || guest.group;
      const guestPolicy = preferences.groupPolicies ? preferences.groupPolicies[guestGroup] : null;
            
      if (guestPolicy === 'S') {
        const emptyTable = availableTables.find(t => 
          t.assignedGuests.length === 0 && 
          t.remainingCapacity >= (guest.attendingCount || 1)
        );
        
        if (emptyTable) {
          assignGuestToTableAdvanced(guest, emptyTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        } else {
          console.error(` No empty table available for S group guest ${guest.firstName}!`);
        }
      } else {
        const anyTable = availableTables.find(t => 
          !reservedTableIds.has(t.id) &&
          t.remainingCapacity >= (guest.attendingCount || 1)
        );
        
        if (anyTable) {
          assignGuestToTableAdvanced(guest, anyTable, arrangement, availableTables, preferences, guests, alreadyAssigned, { t: (key) => key });
        } else {
          console.error(` No table with capacity for guest ${guest.firstName}!`);
        }
      }
    });
  }

  return arrangement;
}

function calculateOptimalSplit(totalPeople, preferredSize = 12) {
  const splits = [];
  let remaining = totalPeople;
 
  while (remaining > 0) {
    if (remaining >= preferredSize - 2 && remaining <= preferredSize + 4) {
      splits.push(preferredSize);
      remaining -= preferredSize;
    } else if (remaining >= preferredSize * 2 - 4) {
      const half = Math.ceil(remaining / 2);
      if (half >= preferredSize - 2 && half <= preferredSize + 2) {
        splits.push(half, remaining - half);
        remaining = 0;
      } else {
        splits.push(preferredSize);
        remaining -= preferredSize;
      }
    } else if (remaining >= preferredSize) {
      splits.push(preferredSize);
      remaining -= preferredSize;
    } else {
      splits.push(remaining);
      remaining = 0;
    }
  }
 
  return splits;
}

function assignGuestToTable(guest, table, arrangement, unassignedGuests) {
  if (!arrangement[table.id]) {
    arrangement[table.id] = [];
  }
 
  const guestSize = guest.attendingCount || 1;
  arrangement[table.id].push(guest._id.toString());
  table.remainingCapacity -= guestSize;
  table.assignedGuests.push(guest._id.toString());
 
  const index = unassignedGuests.findIndex(g => g._id.toString() === guest._id.toString());
  if (index !== -1) {
    unassignedGuests.splice(index, 1);
  }
}

function hasSeparationConflicts(guestsToCheck, table, preferences, allGuests) {
  if (!preferences.seatingRules || !preferences.seatingRules.cannotSitTogether ||
      preferences.seatingRules.cannotSitTogether.length === 0) {
    return false;
  }

  return guestsToCheck.some(guest =>
    preferences.seatingRules.cannotSitTogether.some(rule => {
      const isGuestInRule = (rule.guest1Id === guest._id.toString() || rule.guest2Id === guest._id.toString());
      if (!isGuestInRule) return false;

      const conflictGuestId = rule.guest1Id === guest._id.toString() ? rule.guest2Id : rule.guest1Id;
      return table.assignedGuests.includes(conflictGuestId);
    })
  );
}
   
const exportSeatingChart = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { format } = req.query;
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const actualEventId = event.originalEvent || eventId;
    let actualUserId = req.userId;
    if (event.originalEvent) {
      const originalEvent = await Event.findById(event.originalEvent);
      if (originalEvent) {
        actualUserId = originalEvent.user;
      }
    }
    
    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({
      event: actualEventId,
      user: actualUserId,
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
          name: event.eventName || event.name || event.title || '',
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
          name: event.eventName || event.name || event.title || '',
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
    console.error('Export error:', err);
    res.status(500).json({ message: req.t('seating.errors.exportFailed') });
  }
};

async function exportToPDF(res, event, tables, arrangement, guests, req) {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
 
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="seating-chart-${event.eventName}.pdf"`);
 
  doc.pipe(res);
  doc.fontSize(20).text(req.t('seating.export.title'), { align: 'center' });
  doc.end();
}

async function exportToExcel(res, event, tables, arrangement, guests, req) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(req.t('seating.export.seatingChart'));
 
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="seating-chart-${event.eventName}.xlsx"`);
 
  await workbook.xlsx.write(res);
  res.end();
}

async function exportToPNG(res, event, tables, arrangement, guests, req) {
  const canvas = createCanvas(1200, 800);
  const ctx = canvas.getContext('2d');
 
  const buffer = canvas.toBuffer('image/png');
 
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="seating-chart-${event.eventName}.png"`);
  res.send(buffer);
}

const getSeatingStatistics = async (req, res) => {
  try {
    const { eventId } = req.params;
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const actualEventId = event.originalEvent || eventId;
    let actualUserId = req.userId;
    if (event.originalEvent) {
      const originalEvent = await Event.findById(event.originalEvent);
      if (originalEvent) {
        actualUserId = originalEvent.user;
      }
    }

    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });

    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

     const guests = await Guest.find({
      event: actualEventId,
      user: actualUserId,
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
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOneAndDelete({ event: actualEventId, user: actualUserId });
   
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
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
      rsvpStatus: 'confirmed'
    });

    const tempSeating = new Seating({
      event: eventId,
      user: req.userId,
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

    const sourceSeating = await Seating.findOne({ event: actualEventId, user: actualUserId });
    if (!sourceSeating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const existingTargetSeating = await Seating.findOne({ event: targetEventId, user: req.userId });
    if (existingTargetSeating) {
      return res.status(400).json({ message: req.t('seating.errors.targetAlreadyHasSeating') });
    }

    const newSeating = new Seating({
      event: targetEventId,
      user: req.userId,
      tables: sourceSeating.tables.map(table => ({
        ...table,
        id: `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      })),
      arrangement: {},
      preferences: {
        groupTogether: [],
        keepSeparate: [],
        specialRequests: []
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
   
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOne({ event: actualEventId, user: actualUserId });
    const guests = await Guest.find({
      event: eventId,
      user: req.userId,
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
  moveAffectedGuestsToUnassigned
};