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
    max: 20
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
  }]
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
  preferences: {
    type: PreferenceSchema,
    default: {
      groupTogether: [],
      keepSeparate: [],
      specialRequests: []
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

SeatingSchema.methods.validateArrangement = function(guests) {
  const errors = [];
  
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

  return errors;
};

SeatingSchema.methods.getStatistics = function(guests) {
  const stats = {
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
    tableUtilization: []
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

    stats.tableUtilization.push({
      tableId: table.id,
      tableName: table.name,
      capacity: table.capacity,
      occupancy,
      utilizationRate: (occupancy / table.capacity) * 100,
      isOvercapacity: occupancy > table.capacity
    });
  });

  return stats;
};

SeatingSchema.methods.exportData = function(guests) {
  const exportData = {
    event: this.event,
    tables: this.tables.map(table => ({
      ...table.toObject(),
      guests: (this.arrangement[table.id] || []).map(guestId => {
        const guest = guests.find(g => g._id.toString() === guestId);
        return guest ? {
          id: guest._id,
          name: `${guest.firstName} ${guest.lastName}`,
          attendingCount: guest.attendingCount || 1,
          group: guest.customGroup || guest.group,
          notes: guest.guestNotes
        } : null;
      }).filter(Boolean)
    })),
    statistics: this.getStatistics(guests),
    preferences: this.preferences,
    generatedAt: new Date().toISOString()
  };

  return exportData;
};

module.exports = mongoose.model('Seating', SeatingSchema);