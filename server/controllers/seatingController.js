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

    const seating = await Seating.findOne({ event: eventId, user: req.userId });
    
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
        generatedBy: 'manual',
        version: 1,
        updatedAt: new Date()
      });
    }

    res.json({
      tables: seating.tables || [],
      arrangement: seating.arrangement || {},
      preferences: seating.preferences || {
        groupTogether: [],
        keepSeparate: [],
        specialRequests: []
      },
      layoutSettings: seating.layoutSettings || {
        canvasScale: 1,
        canvasOffset: { x: 0, y: 0 }
      },
      generatedBy: seating.generatedBy || 'manual',
      version: seating.version || 1,
      updatedAt: seating.updatedAt || new Date()
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
    const { tables, arrangement, preferences, layoutSettings } = req.body;
        
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ 
      event: eventId, 
      user: req.userId, 
      rsvpStatus: 'confirmed' 
    });

    const arrangementObj = arrangement && typeof arrangement === 'object' ? arrangement : {};

    const errors = [];
    if (tables && arrangementObj) {
      for (const [tableId, guestIds] of Object.entries(arrangementObj)) {
        if (!Array.isArray(guestIds)) continue;
        
        const table = tables.find(t => t.id === tableId);
        if (!table) continue;
        
        const totalPeople = guestIds.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest ? (guest.attendingCount || 1) : 0);
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
      tables: tables || [],
      arrangement: arrangementObj,
      preferences: preferences || {
        groupTogether: [],
        keepSeparate: [],
        specialRequests: []
      },
      layoutSettings: layoutSettings || {
        canvasScale: 1,
        canvasOffset: { x: 0, y: 0 }
      },
      generatedBy: 'manual',
      updatedAt: new Date()
    };

    const seating = await Seating.findOneAndUpdate(
      { event: eventId, user: req.userId },
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
        version: seating.version,
        updatedAt: seating.updatedAt
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

const generateAISeating = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { 
      tables, 
      preferences, 
      guests: requestGuests, 
      currentArrangement, 
      clearExisting, 
      preserveExisting, 
      allTables 
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
        const additionalTables = createAdditionalTables(additionalCapacityNeeded, tablesToUse.length, req);
        tablesToUse = [...tablesToUse, ...additionalTables];
      }

      aiArrangement = generateOptimalSeatingWithExisting(guests, tablesToUse, preferences, currentArrangement);
    } else {
      const totalGuests = guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      const totalCapacity = tablesToUse.reduce((sum, table) => sum + table.capacity, 0);
      
      if (totalCapacity < totalGuests) {
        const receivedNewTables = allTables && allTables.length > tables.length;
        if (!receivedNewTables) {
          const additionalCapacityNeeded = totalGuests - totalCapacity;
          const additionalTables = createAdditionalTables(additionalCapacityNeeded, tablesToUse.length, req);
          tablesToUse = [...tablesToUse, ...additionalTables];
        }
      }
      
      aiArrangement = generateOptimalSeating(guests, tablesToUse, preferences);
    }

    let seating = await Seating.findOne({ event: eventId, user: req.userId });
    
    if (seating) {
      seating.tables = tablesToUse;
      seating.arrangement = aiArrangement;
      seating.generatedBy = 'ai';
      seating.version += 1;
      seating.updatedAt = new Date();
    } else {
      seating = new Seating({
        event: eventId,
        user: req.userId,
        tables: tablesToUse,
        arrangement: aiArrangement,
        preferences,
        generatedBy: 'ai'
      });
    }

    await seating.save();

    res.json({
      message: req.t('seating.ai.generationSuccess'),
      arrangement: seating.arrangement,
      tables: seating.tables,
      statistics: seating.getStatistics(guests)
    });
  } catch (err) {
    res.status(500).json({ message: req.t('seating.errors.aiGenerationFailed') });
  }
};

function generateOptimalSeatingWithExisting(guests, tables, preferences, currentArrangement) {
  const arrangement = { ...currentArrangement };
  
  const seatedGuestIds = new Set();
  if (currentArrangement && typeof currentArrangement === 'object') {
    Object.values(currentArrangement).forEach(guestIds => {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(id => seatedGuestIds.add(id));
      }
    });
  }

  const unassignedGuests = guests.filter(guest => !seatedGuestIds.has(guest._id.toString()));
  
  if (unassignedGuests.length === 0) {
    return arrangement;
  }

  const unassignedPeopleCount = unassignedGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);

  const availableTables = tables.map(table => {
    const assignedGuests = arrangement[table.id] || [];
    const currentOccupancy = assignedGuests.reduce((sum, guestId) => {
      const guest = guests.find(g => g._id.toString() === guestId);
      return sum + (guest?.attendingCount || 1);
    }, 0);
    
    return {
      ...table,
      remainingCapacity: table.capacity - currentOccupancy,
      assignedGuests: [...assignedGuests]
    };
  });

  const totalAvailableCapacity = availableTables.reduce((sum, table) => sum + table.remainingCapacity, 0);

  availableTables.sort((a, b) => {
    const aHasGuests = a.assignedGuests.length > 0 ? 1 : 0;
    const bHasGuests = b.assignedGuests.length > 0 ? 1 : 0;
    
    if (aHasGuests !== bHasGuests) {
      return bHasGuests - aHasGuests;
    }
    
    return b.remainingCapacity - a.remainingCapacity;
  });

  if (preferences.groupTogether) {
    preferences.groupTogether.forEach(groupRule => {
      const unassignedGroupGuests = groupRule.guestIds
        .map(id => unassignedGuests.find(g => g._id.toString() === id))
        .filter(Boolean);
      
      if (unassignedGroupGuests.length === 0) return;

      const seatedGroupMembers = groupRule.guestIds.filter(id => seatedGuestIds.has(id));
      
      if (seatedGroupMembers.length > 0) {
        const targetTableId = Object.keys(arrangement).find(tableId => 
          seatedGroupMembers.some(memberId => arrangement[tableId].includes(memberId))
        );
        
        if (targetTableId) {
          const targetTable = availableTables.find(t => t.id === targetTableId);
          if (targetTable) {
            unassignedGroupGuests.forEach(guest => {
              const guestSize = guest.attendingCount || 1;
              if (targetTable.remainingCapacity >= guestSize && 
                  !hasSeparationConflicts([guest], targetTable, preferences, guests)) {
                assignGuestToTable(guest, targetTable, arrangement, unassignedGuests);
              }
            });
          }
        }
      } else {
        const totalPeople = unassignedGroupGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
        
        const suitableTable = availableTables.find(table => 
          table.remainingCapacity >= totalPeople
        );

        if (suitableTable) {
          unassignedGroupGuests.forEach(guest => {
            assignGuestToTable(guest, suitableTable, arrangement, unassignedGuests);
          });
        }
      }
    });
  }

  const groupedGuests = {};
  unassignedGuests.forEach(guest => {
    const group = guest.customGroup || guest.group;
    if (!groupedGuests[group]) {
      groupedGuests[group] = [];
    }
    groupedGuests[group].push(guest);
  });

  Object.entries(groupedGuests).forEach(([groupName, groupGuests]) => {
    groupGuests.forEach(guest => {
      const guestSize = guest.attendingCount || 1;
      
      let preferredTable = availableTables.find(table => {
        const hasSpaceForGuest = table.remainingCapacity >= guestSize;
        const hasSameGroup = table.assignedGuests.some(guestId => {
          const assignedGuest = guests.find(g => g._id.toString() === guestId);
          return assignedGuest && (assignedGuest.customGroup || assignedGuest.group) === groupName;
        });
        
        return hasSpaceForGuest && hasSameGroup && 
               !hasSeparationConflicts([guest], table, preferences, guests);
      });

      if (!preferredTable) {
        preferredTable = availableTables.find(table => 
          table.remainingCapacity >= guestSize &&
          !hasSeparationConflicts([guest], table, preferences, guests)
        );
      }

      if (preferredTable) {
        assignGuestToTable(guest, preferredTable, arrangement, []);
      }
    });
  });

  return arrangement;
}

function createAdditionalTables(additionalCapacityNeeded, existingTablesCount, req) {
  const additionalTables = [];
  let remainingCapacity = additionalCapacityNeeded;
  let tableCounter = existingTablesCount + 1;
  
  while (remainingCapacity > 0) {
    let tableCapacity;
    
    if (remainingCapacity <= 8) {
      tableCapacity = 10; 
    } else if (remainingCapacity <= 10) {
      tableCapacity = 10;
    } else if (remainingCapacity <= 12) {
      tableCapacity = 12;
    } else if (remainingCapacity <= 20) {
      if (remainingCapacity <= 16) {
        tableCapacity = 10;
      } else {
        tableCapacity = 12;
      }
    } else if (remainingCapacity <= 24) {
      tableCapacity = 12;
    } else {
      if (remainingCapacity % 12 <= 3) {
        tableCapacity = 12;
      } else if (remainingCapacity % 10 <= 3) {
        tableCapacity = 10;
      } else {
        tableCapacity = 11; 
      }
    }
    
    const newTable = {
      id: `auto_table_${Date.now()}_${tableCounter}_${Math.random().toString(36).substr(2, 9)}`,
      name: req.t('seating.table', { number: tableCounter }),
      type: tableCapacity <= 10 ? 'round' : 'rectangular',
      capacity: tableCapacity,
      position: {
        x: 300 + (tableCounter % 3) * 200,
        y: 300 + Math.floor(tableCounter / 3) * 200
      },
      rotation: 0,
      size: tableCapacity <= 10 ? 
        { width: 120, height: 120 } : 
        { width: 160, height: 100 }
    };
    
    additionalTables.push(newTable);
    remainingCapacity -= tableCapacity;
    tableCounter++;
  }
  
  return additionalTables;
}

function generateOptimalSeating(guests, tables, preferences) {
  const arrangement = {};
  const unassignedGuests = [...guests];
  const availableTables = tables.map(table => ({
    ...table,
    remainingCapacity: table.capacity,
    assignedGuests: []
  }));

  availableTables.sort((a, b) => {
    const getTablePriority = (capacity) => {
      if (capacity >= 10 && capacity <= 12) return 3; 
      if (capacity >= 8 && capacity <= 9) return 2; 
      if (capacity >= 13 && capacity <= 16) return 2; 
      return 1; 
    };
    const priorityDiff = getTablePriority(b.capacity) - getTablePriority(a.capacity);
    if (priorityDiff !== 0) return priorityDiff;
    return Math.abs(11 - a.capacity) - Math.abs(11 - b.capacity); 
  });

  if (preferences.groupTogether) {
    preferences.groupTogether.forEach(groupRule => {
      const groupGuests = groupRule.guestIds
        .map(id => guests.find(g => g._id.toString() === id))
        .filter(Boolean);
      
      if (groupGuests.length === 0) return;

      const totalPeople = groupGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
      
      const exactTable = availableTables.find(table => 
        table.remainingCapacity >= totalPeople && 
        table.capacity >= totalPeople && 
        table.capacity <= totalPeople + 1 
      );

      if (exactTable) {
        groupGuests.forEach(guest => {
          assignGuestToTable(guest, exactTable, arrangement, unassignedGuests);
        });
      } else {
        const fallbackTable = availableTables.find(table => table.remainingCapacity >= totalPeople);
        if (fallbackTable) {
          groupGuests.forEach(guest => {
            assignGuestToTable(guest, fallbackTable, arrangement, unassignedGuests);
          });
        }
      }
    });
  }

  const groupedGuests = {};
  unassignedGuests.forEach(guest => {
    const group = guest.customGroup || guest.group;
    if (!groupedGuests[group]) {
      groupedGuests[group] = [];
    }
    groupedGuests[group].push(guest);
  });

  const sortedGroups = Object.entries(groupedGuests).sort((a, b) => {
    const aTotalPeople = a[1].reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    const bTotalPeople = b[1].reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    return bTotalPeople - aTotalPeople; 
  });

  sortedGroups.forEach(([groupName, groupGuests]) => {
    const totalGroupPeople = groupGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0);
    
    const exactFitTable = availableTables.find(table => 
      table.remainingCapacity >= totalGroupPeople && 
      table.capacity >= totalGroupPeople &&
      table.capacity <= totalGroupPeople + 2 && 
      !hasSeparationConflicts(groupGuests, table, preferences, guests)
    );

    if (exactFitTable) {
      groupGuests.forEach(guest => {
        assignGuestToTable(guest, exactFitTable, arrangement, unassignedGuests);
      });
    } else {
      
      if (totalGroupPeople > 18) {
        const optimalSplits = calculateOptimalSplit(totalGroupPeople);
        let guestIndex = 0;
        
        optimalSplits.forEach(splitSize => {
          const splitGuests = groupGuests.slice(guestIndex, guestIndex + splitSize);
          guestIndex += splitSize;
          
          if (splitGuests.length === 0) return;
          
          const splitTable = availableTables.find(table => 
            table.remainingCapacity >= splitSize &&
            table.capacity >= splitSize &&
            !hasSeparationConflicts(splitGuests, table, preferences, guests)
          );

          if (splitTable) {
            splitGuests.forEach(guest => {
              const guestSize = guest.attendingCount || 1;
              if (splitTable.remainingCapacity >= guestSize) {
                assignGuestToTable(guest, splitTable, arrangement, unassignedGuests);
              }
            });
          }
        });
      } else {
        const anyAvailableTable = availableTables.find(table => 
          table.remainingCapacity >= totalGroupPeople && 
          !hasSeparationConflicts(groupGuests, table, preferences, guests)
        );

        if (anyAvailableTable) {
          groupGuests.forEach(guest => {
            assignGuestToTable(guest, anyAvailableTable, arrangement, unassignedGuests);
          });
        } else {
          groupGuests.forEach(guest => {
            const guestSize = guest.attendingCount || 1;
            
            let preferredTable = availableTables.find(table => {
              const hasSpaceForGuest = table.remainingCapacity >= guestSize;
              const hasSameGroup = table.assignedGuests.some(guestId => {
                const assignedGuest = guests.find(g => g._id.toString() === guestId);
                return assignedGuest && (assignedGuest.customGroup || assignedGuest.group) === groupName;
              });
              
              return hasSpaceForGuest && hasSameGroup &&
                     !hasSeparationConflicts([guest], table, preferences, guests);
            });

            if (!preferredTable) {
              preferredTable = availableTables.find(table => 
                table.remainingCapacity >= guestSize &&
                table.assignedGuests.length === 0 &&
                table.capacity >= 10 && table.capacity <= 12 &&
                !hasSeparationConflicts([guest], table, preferences, guests)
              );
            }

            if (!preferredTable) {
              preferredTable = availableTables.find(table => 
                table.remainingCapacity >= guestSize &&
                !hasSeparationConflicts([guest], table, preferences, guests)
              );
            }

            if (preferredTable) {
              assignGuestToTable(guest, preferredTable, arrangement, unassignedGuests);
            }
          });
        }
      }
    }
  });

  if (unassignedGuests.length > 0) {
    unassignedGuests.forEach(guest => {
      const availableTable = availableTables.find(table => 
        table.remainingCapacity >= (guest.attendingCount || 1) &&
        table.capacity >= 10 && table.capacity <= 12 &&
        !hasSeparationConflicts([guest], table, preferences, guests)
      ) || availableTables.find(table => 
        table.remainingCapacity >= (guest.attendingCount || 1) &&
        !hasSeparationConflicts([guest], table, preferences, guests)
      );
      
      if (availableTable) {
        assignGuestToTable(guest, availableTable, arrangement, []);
      }
    });
  }

  return arrangement;
}

function calculateOptimalSplit(totalPeople) {
  if (totalPeople >= 19 && totalPeople <= 24) {
    const half = Math.floor(totalPeople / 2);
    return [half, totalPeople - half];
  }
  
  if (totalPeople >= 25 && totalPeople <= 36) {
    const third = Math.floor(totalPeople / 3);
    const remainder = totalPeople % 3;
    if (remainder === 0) {
      return [third, third, third];
    } else if (remainder === 1) {
      return [third + 1, third, third];
    } else {
      return [third + 1, third + 1, third];
    }
  }
  
  const splits = [];
  let remaining = totalPeople;
  
  while (remaining > 0) {
    if (remaining >= 22) {
      splits.push(11);
      remaining -= 11;
    } else if (remaining >= 20) {
      splits.push(10); 
      remaining -= 10;
    } else if (remaining >= 12) {
      splits.push(12); 
      remaining -= 12;
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
  if (!preferences.keepSeparate || preferences.keepSeparate.length === 0) {
    return false;
  }

  return guestsToCheck.some(guest => 
    preferences.keepSeparate.some(rule => {
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
    const { tables, arrangement, guests } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    switch (format) {
      case 'pdf':
        await exportToPDF(res, event, tables, arrangement, guests, req);
        break;
      case 'excel':
        await exportToExcel(res, event, tables, arrangement, guests, req);
        break;
      case 'png':
        await exportToPNG(res, event, tables, arrangement, guests, req);
        break;
      default:
        return res.status(400).json({ message: req.t('seating.errors.invalidFormat') });
    }
  } catch (err) {
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

    const seating = await Seating.findOne({ event: eventId, user: req.userId });
    if (!seating) {
      return res.status(404).json({ message: req.t('seating.notFound') });
    }

    const guests = await Guest.find({ 
      event: eventId, 
      user: req.userId, 
      rsvpStatus: 'confirmed' 
    });

    const statistics = seating.getStatistics(guests);
    
    res.json(statistics);
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

    const seating = await Seating.findOneAndDelete({ event: eventId, user: req.userId });
    
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

const getSeatingSubjestions = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guestId } = req.query;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOne({ event: eventId, user: req.userId });
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

    const sourceSeating = await Seating.findOne({ event: eventId, user: req.userId });
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
      generatedBy: 'manual'
    });

    await newSeating.save();

    res.json({
      message: req.t('seating.cloneSuccess'),
      seating: {
        tables: newSeating.tables,
        arrangement: {},
        preferences: newSeating.preferences,
        layoutSettings: newSeating.layoutSettings
      }
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getSeatingArrangement,
  saveSeatingArrangement,
  generateAISeating,
  exportSeatingChart,
  getSeatingStatistics,
  deleteSeatingArrangement,
  validateSeatingArrangement,
  getSeatingSubjestions,
  cloneSeatingArrangement
};