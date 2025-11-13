const mongoose = require('mongoose');

const TableSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['round', 'rectangular', 'square'],
    default: 'round'
  },
  capacity: {
    type: Number,
    required: true,
    min: 2,
    max: 24
  },
  position: {
    x: {
      type: Number,
      required: true
    },
    y: {
      type: Number,
      required: true
    }
  },
  size: {
    width: {
      type: Number,
      required: true,
      default: 120
    },
    height: {
      type: Number,
      required: true,
      default: 120
    }
  },
  rotation: {
    type: Number,
    default: 0,
    min: 0,
    max: 360
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 500
  },
  autoCreated: {
    type: Boolean,
    default: false
  },
  createdForSync: {
    type: Boolean,
    default: false
  }
}, { _id: false });

const PreferenceSchema = new mongoose.Schema({
  groupTogether: [{
    id: String,
    name: String,
    guestIds: [String]
  }],
  keepSeparate: [{
    id: String,
    guest1Id: String,
    guest2Id: String,
    reason: String
  }],
  specialRequests: [{
    id: String,
    guestId: String,
    request: String,
    priority: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    }
  }],

  seatingRules: {
    mustSitTogether: [{
      id: String,
      guest1Id: String,
      guest2Id: String,
      reason: String
    }]
  },
  
  groupMixingRules: [{
    id: String,
    group1: String,
    group2: String,
    allowMixing: {
      type: Boolean,
      default: true
    }
  }],
  
  allowGroupMixing: {
    type: Boolean,
    default: false
  },
  
  preferredTableSize: {
    type: Number,
    default: 12,
    min: 6,
    max: 24
  },
  
  groupPolicies: {
    type: Map,
    of: String, 
    default: {}
  }

}, { _id: false });

const SyncTriggerSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now
  },
  changeType: {
    type: String,
    enum: [
      'guest_added',
      'guest_deleted', 
      'guest_details_updated',
      'rsvp_updated',
      'public_rsvp_updated',
      'bulk_guests_added',
      'status_became_confirmed',
      'status_no_longer_confirmed',
      'attending_count_changed'
    ],
    required: true
  },
  changeData: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  processed: {
    type: Boolean,
    default: false
  },
  processedAt: {
    type: Date
  },
  syncResult: {
    success: {
      type: Boolean
    },
    actions: [{
      action: String,
      details: mongoose.Schema.Types.Mixed
    }],
    errorMessage: String
  }
}, { _id: false });

const SeatingSchema = new mongoose.Schema({
  event: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Event',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  tables: [TableSchema],
  arrangement: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isSeparatedSeating: {
    type: Boolean,
    default: false
  },
  maleArrangement: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  femaleArrangement: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  maleTables: [TableSchema],
  femaleTables: [TableSchema],
  preferences: {
    type: PreferenceSchema,
    default: {
      groupTogether: [],
      keepSeparate: [],
      specialRequests: [],
      seatingRules: {
        mustSitTogether: [],
        cannotSitTogether: []
      },
      groupMixingRules: [],
      allowGroupMixing: false,
      preferredTableSize: 12,
      groupPolicies: {}
      }
  },
  layoutSettings: {
    canvasScale: {
      type: Number,
      default: 1,
      min: 0.5,
      max: 2
    },
    canvasOffset: {
      x: {
        type: Number,
        default: 0
      },
      y: {
        type: Number,
        default: 0
      }
    }
  },
  generatedBy: {
    type: String,
    enum: ['manual', 'ai'],
    default: 'manual'
  },
  aiSettings: {
    prioritizeGroups: {
      type: Boolean,
      default: true
    },
    balanceTableSizes: {
      type: Boolean,
      default: true
    },
    considerSpecialNeeds: {
      type: Boolean,
      default: true
    },
    mixGroups: {
      type: Boolean,
      default: false
    },
    separateAgeGroups: {
      type: Boolean,
      default: false
    },
    prioritizeVIPs: {
      type: Boolean,
      default: false
    },
    customInstructions: {
      type: String,
      maxlength: 1000
    }
  },
  syncSettings: {
    autoSyncEnabled: {
      type: Boolean,
      default: true
    },
    syncOnRsvpChange: {
      type: Boolean,
      default: true
    },
    syncOnAttendingCountChange: {
      type: Boolean,
      default: true
    },
    autoCreateTables: {
      type: Boolean,
      default: true
    },
    autoOptimizeTables: {
      type: Boolean,
      default: true
    },
    preferredTableSize: {
      type: Number,
      default: 12,
      min: 6,
      max: 24
    }
  },
  syncTriggers: [SyncTriggerSchema],
  lastSyncTrigger: {
    type: Date
  },
  lastSyncProcessed: {
    type: Date
  },
  syncStats: {
    totalSyncs: {
      type: Number,
      default: 0
    },
    successfulSyncs: {
      type: Number,
      default: 0
    },
    failedSyncs: {
      type: Number,
      default: 0
    },
    lastSyncStatus: {
      type: String,
      enum: ['success', 'failed', 'partial'],
      default: 'success'
    },
    tablesCreatedBySync: {
      type: Number,
      default: 0
    },
    tablesRemovedBySync: {
      type: Number,
      default: 0
    },
    guestsMovedBySync: {
      type: Number,
      default: 0
    }
  },
  version: {
    type: Number,
    default: 1
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

SeatingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

SeatingSchema.index({ event: 1, user: 1 }, { unique: true });

SeatingSchema.virtual('totalCapacity').get(function() {
  return this.tables.reduce((sum, table) => sum + table.capacity, 0);
});

SeatingSchema.virtual('currentOccupancy').get(function() {
  let occupancy = 0;
  for (const guestIds of Object.values(this.arrangement || {})) {
    if (Array.isArray(guestIds)) {
      occupancy += guestIds.length;
    }
  }
  return occupancy;
});

SeatingSchema.virtual('pendingSyncTriggers').get(function() {
  return (this.syncTriggers || []).filter(trigger => !trigger.processed);
});

SeatingSchema.virtual('hasPendingSync').get(function() {
  return this.pendingSyncTriggers.length > 0;
});

SeatingSchema.methods.validateArrangement = function(guests) {
  const errors = [];
  const isSeparated = this.isSeparatedSeating || false;
  
  if (isSeparated) {
    const maleGuests = guests.filter(g => g.gender === 'male');
    const femaleGuests = guests.filter(g => g.gender === 'female');
    
    for (const [tableId, guestIds] of Object.entries(this.maleArrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      const table = this.maleTables.find(t => t.id === tableId);
      if (!table) {
        errors.push({
          type: 'table_not_found',
          tableId,
          gender: 'male',
          messageKey: 'validation.tableNotFound',
          params: { tableId }
        });
        continue;
      }

      const totalPeople = guestIds.reduce((sum, guestId) => {
        const guest = maleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0);

      if (totalPeople > table.capacity) {
        errors.push({
          type: 'overcapacity',
          tableId,
          tableName: table.name,
          gender: 'male',
          capacity: table.capacity,
          occupancy: totalPeople,
          messageKey: 'validation.tableOvercapacity',
          params: { 
            tableName: table.name, 
            occupancy: totalPeople, 
            capacity: table.capacity 
          }
        });
      }
    }
    
    for (const [tableId, guestIds] of Object.entries(this.femaleArrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      const table = this.femaleTables.find(t => t.id === tableId);
      if (!table) {
        errors.push({
          type: 'table_not_found',
          tableId,
          gender: 'female',
          messageKey: 'validation.tableNotFound',
          params: { tableId }
        });
        continue;
      }

      const totalPeople = guestIds.reduce((sum, guestId) => {
        const guest = femaleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0);

      if (totalPeople > table.capacity) {
        errors.push({
          type: 'overcapacity',
          tableId,
          tableName: table.name,
          gender: 'female',
          capacity: table.capacity,
          occupancy: totalPeople,
          messageKey: 'validation.tableOvercapacity',
          params: { 
            tableName: table.name, 
            occupancy: totalPeople, 
            capacity: table.capacity 
          }
        });
      }
    }

    const seatedMaleGuests = new Set();
    for (const guestIds of Object.values(this.maleArrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      for (const guestId of guestIds) {
        if (seatedMaleGuests.has(guestId)) {
          errors.push({
            type: 'duplicate_guest',
            guestId,
            gender: 'male',
            messageKey: 'validation.duplicateGuest',
            params: { guestId }
          });
        }
        seatedMaleGuests.add(guestId);
      }
    }
    
    const seatedFemaleGuests = new Set();
    for (const guestIds of Object.values(this.femaleArrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      for (const guestId of guestIds) {
        if (seatedFemaleGuests.has(guestId)) {
          errors.push({
            type: 'duplicate_guest',
            guestId,
            gender: 'female',
            messageKey: 'validation.duplicateGuest',
            params: { guestId }
          });
        }
        seatedFemaleGuests.add(guestId);
      }
    }
  } else {
    for (const [tableId, guestIds] of Object.entries(this.arrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      const table = this.tables.find(t => t.id === tableId);
      if (!table) {
        errors.push({
          type: 'table_not_found',
          tableId,
          messageKey: 'validation.tableNotFound',
          params: { tableId }
        });
        continue;
      }

      const totalPeople = guestIds.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0);

      if (totalPeople > table.capacity) {
        errors.push({
          type: 'overcapacity',
          tableId,
          tableName: table.name,
          capacity: table.capacity,
          occupancy: totalPeople,
          messageKey: 'validation.tableOvercapacity',
          params: { 
            tableName: table.name, 
            occupancy: totalPeople, 
            capacity: table.capacity 
          }
        });
      }
    }

    const seatedGuests = new Set();
    for (const guestIds of Object.values(this.arrangement || {})) {
      if (!Array.isArray(guestIds)) continue;
      
      for (const guestId of guestIds) {
        if (seatedGuests.has(guestId)) {
          errors.push({
            type: 'duplicate_guest',
            guestId,
            messageKey: 'validation.duplicateGuest',
            params: { guestId }
          });
        }
        seatedGuests.add(guestId);
      }
    }
  }

  return errors;
};

SeatingSchema.methods.getStatistics = function(guests) {
  const isSeparated = this.isSeparatedSeating || false;
  
  if (isSeparated) {
    const maleGuests = guests.filter(g => g.gender === 'male');
    const femaleGuests = guests.filter(g => g.gender === 'female');
    
    const maleStats = {
      totalTables: this.maleTables.length,
      occupiedTables: Object.keys(this.maleArrangement || {}).filter(tableId => 
        Array.isArray(this.maleArrangement[tableId]) && this.maleArrangement[tableId].length > 0
      ).length,
      totalCapacity: this.maleTables.reduce((sum, table) => sum + table.capacity, 0),
      totalGuests: maleGuests.length,
      totalPeople: maleGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
      seatedGuests: 0,
      seatedPeople: 0,
      unseatedGuests: 0,
      unseatedPeople: 0,
      utilizationRate: 0,
      tableUtilization: [],
      autoCreatedTables: this.maleTables.filter(t => t.autoCreated).length,
      syncCreatedTables: this.maleTables.filter(t => t.createdForSync).length
    };
    
    const femaleStats = {
      totalTables: this.femaleTables.length,
      occupiedTables: Object.keys(this.femaleArrangement || {}).filter(tableId => 
        Array.isArray(this.femaleArrangement[tableId]) && this.femaleArrangement[tableId].length > 0
      ).length,
      totalCapacity: this.femaleTables.reduce((sum, table) => sum + table.capacity, 0),
      totalGuests: femaleGuests.length,
      totalPeople: femaleGuests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
      seatedGuests: 0,
      seatedPeople: 0,
      unseatedGuests: 0,
      unseatedPeople: 0,
      utilizationRate: 0,
      tableUtilization: [],
      autoCreatedTables: this.femaleTables.filter(t => t.autoCreated).length,
      syncCreatedTables: this.femaleTables.filter(t => t.createdForSync).length
    };

    const seatedMaleGuestIds = new Set();
    for (const guestIds of Object.values(this.maleArrangement || {})) {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(id => seatedMaleGuestIds.add(id));
      }
    }
    
    const seatedFemaleGuestIds = new Set();
    for (const guestIds of Object.values(this.femaleArrangement || {})) {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(id => seatedFemaleGuestIds.add(id));
      }
    }

    maleGuests.forEach(guest => {
      const people = guest.attendingCount || 1;
      if (seatedMaleGuestIds.has(guest._id.toString())) {
        maleStats.seatedGuests++;
        maleStats.seatedPeople += people;
      } else {
        maleStats.unseatedGuests++;
        maleStats.unseatedPeople += people;
      }
    });
    
    femaleGuests.forEach(guest => {
      const people = guest.attendingCount || 1;
      if (seatedFemaleGuestIds.has(guest._id.toString())) {
        femaleStats.seatedGuests++;
        femaleStats.seatedPeople += people;
      } else {
        femaleStats.unseatedGuests++;
        femaleStats.unseatedPeople += people;
      }
    });

    if (maleStats.totalCapacity > 0) {
      maleStats.utilizationRate = (maleStats.seatedPeople / maleStats.totalCapacity) * 100;
    }
    
    if (femaleStats.totalCapacity > 0) {
      femaleStats.utilizationRate = (femaleStats.seatedPeople / femaleStats.totalCapacity) * 100;
    }

    this.maleTables.forEach(table => {
      const guestIds = this.maleArrangement[table.id] || [];
      const occupancy = Array.isArray(guestIds) ? guestIds.reduce((sum, guestId) => {
        const guest = maleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0) : 0;

      const tableUtilizationRate = (occupancy / table.capacity) * 100;

      maleStats.tableUtilization.push({
        tableId: table.id,
        tableName: table.name,
        capacity: table.capacity,
        occupancy,
        utilizationRate: tableUtilizationRate,
        isOvercapacity: occupancy > table.capacity,
        autoCreated: table.autoCreated || false,
        createdForSync: table.createdForSync || false,
        gender: 'male'
      });
    });
    
    this.femaleTables.forEach(table => {
      const guestIds = this.femaleArrangement[table.id] || [];
      const occupancy = Array.isArray(guestIds) ? guestIds.reduce((sum, guestId) => {
        const guest = femaleGuests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0) : 0;

      const tableUtilizationRate = (occupancy / table.capacity) * 100;

      femaleStats.tableUtilization.push({
        tableId: table.id,
        tableName: table.name,
        capacity: table.capacity,
        occupancy,
        utilizationRate: tableUtilizationRate,
        isOvercapacity: occupancy > table.capacity,
        autoCreated: table.autoCreated || false,
        createdForSync: table.createdForSync || false,
        gender: 'female'
      });
    });

    return {
      isSeparatedSeating: true,
      totalTables: maleStats.totalTables + femaleStats.totalTables,
      occupiedTables: maleStats.occupiedTables + femaleStats.occupiedTables,
      totalCapacity: maleStats.totalCapacity + femaleStats.totalCapacity,
      totalGuests: maleStats.totalGuests + femaleStats.totalGuests,
      totalPeople: maleStats.totalPeople + femaleStats.totalPeople,
      seatedGuests: maleStats.seatedGuests + femaleStats.seatedGuests,
      seatedPeople: maleStats.seatedPeople + femaleStats.seatedPeople,
      unseatedGuests: maleStats.unseatedGuests + femaleStats.unseatedGuests,
      unseatedPeople: maleStats.unseatedPeople + femaleStats.unseatedPeople,
      utilizationRate: ((maleStats.seatedPeople + femaleStats.seatedPeople) / (maleStats.totalCapacity + femaleStats.totalCapacity)) * 100,
      maleStats,
      femaleStats
    };
  } else {
    const stats = {
      isSeparatedSeating: false,
      totalTables: this.tables.length,
      occupiedTables: Object.keys(this.arrangement || {}).filter(tableId => 
        Array.isArray(this.arrangement[tableId]) && this.arrangement[tableId].length > 0
      ).length,
      totalCapacity: this.totalCapacity,
      totalGuests: guests.length,
      totalPeople: guests.reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
      seatedGuests: 0,
      seatedPeople: 0,
      unseatedGuests: 0,
      unseatedPeople: 0,
      utilizationRate: 0,
      tableUtilization: [],
      autoCreatedTables: this.tables.filter(t => t.autoCreated).length,
      syncCreatedTables: this.tables.filter(t => t.createdForSync).length
    };

    const seatedGuestIds = new Set();
    for (const guestIds of Object.values(this.arrangement || {})) {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(id => seatedGuestIds.add(id));
      }
    }

    guests.forEach(guest => {
      const people = guest.attendingCount || 1;
      if (seatedGuestIds.has(guest._id.toString())) {
        stats.seatedGuests++;
        stats.seatedPeople += people;
      } else {
        stats.unseatedGuests++;
        stats.unseatedPeople += people;
      }
    });

    if (stats.totalCapacity > 0) {
      stats.utilizationRate = (stats.seatedPeople / stats.totalCapacity) * 100;
    }

    this.tables.forEach(table => {
      const guestIds = this.arrangement[table.id] || [];
      const occupancy = Array.isArray(guestIds) ? guestIds.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest ? (guest.attendingCount || 1) : 0);
      }, 0) : 0;

      const tableUtilizationRate = (occupancy / table.capacity) * 100;

      if (occupancy > 0) {
        stats.occupiedTables++;
      }

      if (tableUtilizationRate >= 100) {
        stats.fullyOccupiedTables++;
      }

      stats.tableUtilization.push({
        tableId: table.id,
        tableName: table.name,
        capacity: table.capacity,
        occupancy,
        utilizationRate: tableUtilizationRate,
        isOvercapacity: occupancy > table.capacity,
        autoCreated: table.autoCreated || false,
        createdForSync: table.createdForSync || false
      });
    });

    return stats;
  }
};

SeatingSchema.methods.addSyncTrigger = function(changeType, changeData) {
  if (!this.syncTriggers) {
    this.syncTriggers = [];
  }

  const trigger = {
    timestamp: new Date(),
    changeType,
    changeData,
    processed: false
  };

  this.syncTriggers.push(trigger);
  
  if (this.syncTriggers.length > 20) {
    this.syncTriggers = this.syncTriggers.slice(-20);
  }

  this.lastSyncTrigger = new Date();
  return trigger;
};

SeatingSchema.methods.processSyncTrigger = function(trigger, result) {
  const triggerIndex = this.syncTriggers.findIndex(t => 
    t.timestamp.getTime() === trigger.timestamp.getTime() && 
    t.changeType === trigger.changeType
  );

  if (triggerIndex !== -1) {
    this.syncTriggers[triggerIndex].processed = true;
    this.syncTriggers[triggerIndex].processedAt = new Date();
    this.syncTriggers[triggerIndex].syncResult = result;

    this.syncStats.totalSyncs = (this.syncStats.totalSyncs || 0) + 1;
    
    if (result.success) {
      this.syncStats.successfulSyncs = (this.syncStats.successfulSyncs || 0) + 1;
      this.syncStats.lastSyncStatus = 'success';
    } else {
      this.syncStats.failedSyncs = (this.syncStats.failedSyncs || 0) + 1;
      this.syncStats.lastSyncStatus = 'failed';
    }

    if (result.actions) {
      result.actions.forEach(action => {
        switch (action.action) {
          case 'table_created':
            this.syncStats.tablesCreatedBySync = (this.syncStats.tablesCreatedBySync || 0) + 1;
            break;
          case 'table_removed':
            this.syncStats.tablesRemovedBySync = (this.syncStats.tablesRemovedBySync || 0) + 1;
            break;
          case 'guest_moved':
            this.syncStats.guestsMovedBySync = (this.syncStats.guestsMovedBySync || 0) + 1;
            break;
        }
      });
    }

    this.lastSyncProcessed = new Date();
  }
};

SeatingSchema.methods.findAvailableTable = function(guestSize, guests, excludeTableIds = [], gender = null) {
  const isSeparated = this.isSeparatedSeating || false;
  
  if (isSeparated && gender) {
    const currentTables = gender === 'male' ? this.maleTables : this.femaleTables;
    const currentArrangement = gender === 'male' ? this.maleArrangement : this.femaleArrangement;
    
    return currentTables.find(table => {
      if (excludeTableIds.includes(table.id)) return false;
      
      const tableGuests = currentArrangement[table.id] || [];
      const currentOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);
      
      return (table.capacity - currentOccupancy) >= guestSize;
    });
  } else {
    return this.tables.find(table => {
      if (excludeTableIds.includes(table.id)) return false;
      
      const tableGuests = this.arrangement[table.id] || [];
      const currentOccupancy = tableGuests.reduce((sum, guestId) => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return sum + (guest?.attendingCount || 1);
      }, 0);
      
      return (table.capacity - currentOccupancy) >= guestSize;
    });
  }
};

SeatingSchema.methods.createTable = function(capacity, tableNumber, isAutoCreated = false, isCreatedForSync = false, req = null) {
  if (!req || !req.t) {
    throw new Error('Translation function (req.t) is required for createTable');
  }
  
  
  let tableName;
  try {
    tableName = req.t('seating.tableName', { number: tableNumber });
    
    if (!tableName || tableName === 'seating.tableName' || !tableName.includes(tableNumber.toString())) {      
      const baseTableName = req.t('seating.tableName');

      if (baseTableName && baseTableName !== 'seating.tableName') {
        tableName = `${baseTableName} ${tableNumber}`;
      }
    }
  } catch (error) {
    tableName = `שולחן ${tableNumber}`;
  }
    
  const newTable = {
    id: `auto_table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
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
    autoCreated: isAutoCreated,
    createdForSync: isCreatedForSync
  };

  this.tables.push(newTable);
  return newTable;
};

SeatingSchema.methods.optimizeArrangement = function(guests, gender = null) {
  const isSeparated = this.isSeparatedSeating || false;
  
  if (isSeparated && gender) {
    let optimized = false;
    const tablesToRemove = [];
    const currentTables = gender === 'male' ? this.maleTables : this.femaleTables;
    const currentArrangement = gender === 'male' ? this.maleArrangement : this.femaleArrangement;
    const originalTablesCount = currentTables.length;
    
    const seatedGuestCounts = {};
    Object.values(currentArrangement || {}).forEach(guestIds => {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(guestId => {
          seatedGuestCounts[guestId] = (seatedGuestCounts[guestId] || 0) + 1;
        });
      }
    });
    
    const duplicateGuests = Object.keys(seatedGuestCounts).filter(guestId => 
      seatedGuestCounts[guestId] > 1
    );
    
    duplicateGuests.forEach(guestId => {
      let foundFirst = false;
      Object.keys(currentArrangement).forEach(tableId => {
        const guestIndex = currentArrangement[tableId].indexOf(guestId);
        if (guestIndex !== -1) {
          if (foundFirst) {
            currentArrangement[tableId].splice(guestIndex, 1);
            if (currentArrangement[tableId].length === 0) {
              delete currentArrangement[tableId];
            }
            optimized = true;
          } else {
            foundFirst = true;
          }
        }
      });
    });

    currentTables.forEach(table => {
      const tableGuests = currentArrangement[table.id] || [];
      if (tableGuests.length === 0) {
        tablesToRemove.push(table.id);
      }
    });

    if (currentTables.length > 1) {
      const underUtilizedTables = currentTables.filter(table => {
        if (tablesToRemove.includes(table.id)) return false;
        
        const tableGuests = currentArrangement[table.id] || [];
        const tableOccupancy = tableGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);

        return tableOccupancy > 0 && tableOccupancy <= table.capacity / 3;
      });

      for (const underTable of underUtilizedTables) {
        const tableGuests = currentArrangement[underTable.id] || [];
        const tableOccupancy = tableGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);

        const availableTable = currentTables.find(targetTable => {
          if (targetTable.id === underTable.id) return false;
          if (tablesToRemove.includes(targetTable.id)) return false;
          
          const targetGuests = currentArrangement[targetTable.id] || [];
          const targetOccupancy = targetGuests.reduce((sum, guestId) => {
            const guest = guests.find(g => g._id.toString() === guestId);
            return sum + (guest?.attendingCount || 1);
          }, 0);
          
          return (targetTable.capacity - targetOccupancy) >= tableOccupancy;
        });
        
        if (availableTable) {
          if (!currentArrangement[availableTable.id]) {
            currentArrangement[availableTable.id] = [];
          }
          
          const newGuests = tableGuests.filter(guestId => 
            !currentArrangement[availableTable.id].includes(guestId)
          );
          
          currentArrangement[availableTable.id].push(...newGuests);
          tablesToRemove.push(underTable.id);
          optimized = true;
        }
      }
    }

    tablesToRemove.forEach(tableId => {
      const index = currentTables.findIndex(t => t.id === tableId);
      if (index !== -1) {
        currentTables.splice(index, 1);
      }
      delete currentArrangement[tableId];
      optimized = true;
    });

    const validTableIds = new Set(currentTables.map(t => t.id));
    Object.keys(currentArrangement).forEach(tableId => {
      if (!validTableIds.has(tableId)) {
        delete currentArrangement[tableId];
        optimized = true;
      }
    });
    
    if (gender === 'male') {
      this.maleTables = currentTables;
      this.maleArrangement = currentArrangement;
    } else {
      this.femaleTables = currentTables;
      this.femaleArrangement = currentArrangement;
    }

    return optimized;
  } else if (!isSeparated) {
    let optimized = false;
    const tablesToRemove = [];
    const originalTablesCount = this.tables.length;
    
    const seatedGuestCounts = {};
    Object.values(this.arrangement || {}).forEach(guestIds => {
      if (Array.isArray(guestIds)) {
        guestIds.forEach(guestId => {
          seatedGuestCounts[guestId] = (seatedGuestCounts[guestId] || 0) + 1;
        });
      }
    });
    
    const duplicateGuests = Object.keys(seatedGuestCounts).filter(guestId => 
      seatedGuestCounts[guestId] > 1
    );
    
    duplicateGuests.forEach(guestId => {
      let foundFirst = false;
      Object.keys(this.arrangement).forEach(tableId => {
        const guestIndex = this.arrangement[tableId].indexOf(guestId);
        if (guestIndex !== -1) {
          if (foundFirst) {
            this.arrangement[tableId].splice(guestIndex, 1);
            if (this.arrangement[tableId].length === 0) {
              delete this.arrangement[tableId];
            }
            optimized = true;
          } else {
            foundFirst = true;
          }
        }
      });
    });

    this.tables.forEach(table => {
      const tableGuests = this.arrangement[table.id] || [];
      if (tableGuests.length === 0) {
        tablesToRemove.push(table.id);
      }
    });

    if (this.tables.length > 1) {
      const underUtilizedTables = this.tables.filter(table => {
        if (tablesToRemove.includes(table.id)) return false;
        
        const tableGuests = this.arrangement[table.id] || [];
        const tableOccupancy = tableGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);

        return tableOccupancy > 0 && tableOccupancy <= table.capacity / 3;
      });

      for (const underTable of underUtilizedTables) {
        const tableGuests = this.arrangement[underTable.id] || [];
        const tableOccupancy = tableGuests.reduce((sum, guestId) => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return sum + (guest?.attendingCount || 1);
        }, 0);

        const availableTable = this.tables.find(targetTable => {
          if (targetTable.id === underTable.id) return false;
          if (tablesToRemove.includes(targetTable.id)) return false;
          
          const targetGuests = this.arrangement[targetTable.id] || [];
          const targetOccupancy = targetGuests.reduce((sum, guestId) => {
            const guest = guests.find(g => g._id.toString() === guestId);
            return sum + (guest?.attendingCount || 1);
          }, 0);
          
          return (targetTable.capacity - targetOccupancy) >= tableOccupancy;
        });
        
        if (availableTable) {
          if (!this.arrangement[availableTable.id]) {
            this.arrangement[availableTable.id] = [];
          }
          
          const newGuests = tableGuests.filter(guestId => 
            !this.arrangement[availableTable.id].includes(guestId)
          );
          
          this.arrangement[availableTable.id].push(...newGuests);
          tablesToRemove.push(underTable.id);
          optimized = true;
        }
      }
    }

    tablesToRemove.forEach(tableId => {
      this.tables = this.tables.filter(t => t.id !== tableId);
      delete this.arrangement[tableId];
      optimized = true;
    });

    const validTableIds = new Set(this.tables.map(t => t.id));
    Object.keys(this.arrangement).forEach(tableId => {
      if (!validTableIds.has(tableId)) {
        delete this.arrangement[tableId];
        optimized = true;
      }
    });

    return optimized;
  }
  
  return false;
};

SeatingSchema.methods.exportData = function(guests) {
  const isSeparated = this.isSeparatedSeating || false;
  
  if (isSeparated) {
    const maleGuests = guests.filter(g => g.gender === 'male');
    const femaleGuests = guests.filter(g => g.gender === 'female');
    
    return {
      event: this.event,
      isSeparatedSeating: true,
      maleTables: this.maleTables.map(table => ({
        ...table.toObject(),
        guests: (this.maleArrangement[table.id] || []).map(guestId => {
          const guest = maleGuests.find(g => g._id.toString() === guestId);
          return guest ? {
            id: guest._id,
            name: `${guest.firstName} ${guest.lastName}`,
            attendingCount: guest.attendingCount || 1,
            group: guest.customGroup || guest.group,
            gender: guest.gender,
            notes: guest.guestNotes
          } : null;
        }).filter(Boolean)
      })),
      femaleTables: this.femaleTables.map(table => ({
        ...table.toObject(),
        guests: (this.femaleArrangement[table.id] || []).map(guestId => {
          const guest = femaleGuests.find(g => g._id.toString() === guestId);
          return guest ? {
            id: guest._id,
            name: `${guest.firstName} ${guest.lastName}`,
            attendingCount: guest.attendingCount || 1,
            group: guest.customGroup || guest.group,
            gender: guest.gender,
            notes: guest.guestNotes
          } : null;
        }).filter(Boolean)
      })),
      statistics: this.getStatistics(guests),
      preferences: this.preferences,
      syncSettings: this.syncSettings,
      syncStats: this.syncStats,
      hasPendingSync: this.hasPendingSync,
      generatedAt: new Date().toISOString()
    };
  } else {
    return {
      event: this.event,
      isSeparatedSeating: false,
      tables: this.tables.map(table => ({
        ...table.toObject(),
        guests: (this.arrangement[table.id] || []).map(guestId => {
          const guest = guests.find(g => g._id.toString() === guestId);
          return guest ? {
            id: guest._id,
            name: `${guest.firstName} ${guest.lastName}`,
            attendingCount: guest.attendingCount || 1,
            group: guest.customGroup || guest.group,
            gender: guest.gender,
            notes: guest.guestNotes
          } : null;
        }).filter(Boolean)
      })),
      statistics: this.getStatistics(guests),
      preferences: this.preferences,
      syncSettings: this.syncSettings,
      syncStats: this.syncStats,
      hasPendingSync: this.hasPendingSync,
      generatedAt: new Date().toISOString()
    };
  }
};

SeatingSchema.methods.getSyncSummary = function() {
  const pendingTriggers = (this.syncTriggers || []).filter(trigger => !trigger.processed);
  
  return {
    autoSyncEnabled: this.syncSettings?.autoSyncEnabled !== false,
    pendingTriggers: pendingTriggers.length,
    lastSyncTrigger: this.lastSyncTrigger,
    lastSyncProcessed: this.lastSyncProcessed,
    syncStats: this.syncStats || {
      totalSyncs: 0,
      successfulSyncs: 0,
      failedSyncs: 0,
      lastSyncStatus: 'success'
    },
    recentTriggers: (this.syncTriggers || [])
      .slice(-5)
      .map(trigger => ({
        timestamp: trigger.timestamp,
        changeType: trigger.changeType,
        processed: trigger.processed,
        success: trigger.syncResult?.success
      }))
  };
};

module.exports = mongoose.model('Seating', SeatingSchema);