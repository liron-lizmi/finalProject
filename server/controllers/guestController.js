const Guest = require('../models/Guest');
const Event = require('../models/Event');
const Seating = require('../models/Seating');

const getEventGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId })
      .sort({ lastName: 1, firstName: 1 });
    
    res.json(guests);
  } catch (err) {
    console.error('Error fetching guests:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, phone, group, customGroup } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    let finalGroup = group || 'other';
    let finalCustomGroup = undefined;

    if (group === 'custom' || !['family', 'friends', 'work', 'other'].includes(group)) {
      if (customGroup && customGroup.trim()) {
        finalGroup = customGroup.trim();
        finalCustomGroup = customGroup.trim();
      } else if (!['family', 'friends', 'work', 'other'].includes(group)) {
        finalGroup = group;
        finalCustomGroup = group;
      } else {
        finalGroup = 'other';
      }
    }

    const guestData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      group: finalGroup,
      event: eventId,
      user: req.userId,
      attendingCount: 1 
    };

    if (finalCustomGroup) {
      guestData.customGroup = finalCustomGroup;
    }

    const newGuest = new Guest(guestData);
    const savedGuest = await newGuest.save();
    
    if (savedGuest.rsvpStatus === 'confirmed') {
      await triggerSeatingSync(eventId, req.userId, 'guest_added', {
        guestId: savedGuest._id,
        guest: savedGuest
      });
    }
    
    res.status(201).json(savedGuest);
  } catch (err) {
    console.error('Error adding guest:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }
    
    if (err.code === 11000) {
      return res.status(400).json({ 
        message: req.t('guests.errors.duplicateGuest')
      });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const bulkImportGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guests } = req.body;
    
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ 
        message: req.t('import.errors.noData'),
        imported: 0,
        failed: 0,
        errors: []
      });
    }

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ 
        message: req.t('events.notFound'),
        imported: 0,
        failed: 0,
        errors: []
      });
    }

    const results = {
      imported: 0,
      failed: 0,
      errors: []
    };

    const guestsToInsert = [];
    const errors = [];

    for (let i = 0; i < guests.length; i++) {
      const guest = guests[i];
      
      if (!guest.firstName || !guest.firstName.trim()) {
        errors.push(`שם פרטי נדרש - שורה ${i + 1}`);
        continue;
      }

      if (!guest.lastName || !guest.lastName.trim()) {
        errors.push(`שם משפחה נדרש - שורה ${i + 1}`);
        continue;
      }

      if (guest.phone && guest.phone.trim()) {
        const phoneToCheck = guest.phone.trim();
        if (!/^05\d-\d{7}$/.test(phoneToCheck)) {
          errors.push(`פורמט טלפון לא תקין - ${guest.firstName} ${guest.lastName}`);
          continue;
        }
      }

      let finalGroup = guest.group || 'other';
      let finalCustomGroup = undefined;

      if (guest.group && !['family', 'friends', 'work', 'other'].includes(guest.group)) {
        finalGroup = guest.group;
        finalCustomGroup = guest.group;
      }

      const guestData = {
        firstName: guest.firstName.trim(),
        lastName: guest.lastName.trim(),
        phone: guest.phone ? guest.phone.trim() : '',
        group: finalGroup,
        customGroup: finalCustomGroup,
        event: eventId,
        user: req.userId,
        attendingCount: 1,
        rsvpStatus: 'pending',
        invitationSent: false,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      guestsToInsert.push(guestData);
    }

    if (guestsToInsert.length > 0) {
      try {
        const insertResult = await Guest.insertMany(guestsToInsert, { 
          ordered: false 
        });

        results.imported = insertResult.length;

        const confirmedGuests = insertResult.filter(guest => guest.rsvpStatus === 'confirmed');
        if (confirmedGuests.length > 0) {
          await triggerSeatingSync(eventId, req.userId, 'bulk_guests_added', {
            confirmedGuestsCount: confirmedGuests.length
          });
        }

      } catch (insertError) {
        console.error('Bulk insert error:', insertError);
        
        if (insertError.insertedDocs) {
          results.imported = insertError.insertedDocs.length;
        }

        if (results.imported === 0) {
          for (const guestData of guestsToInsert) {
            try {
              const newGuest = new Guest(guestData);
              await newGuest.save();
              results.imported++;
            } catch (individualError) {
              results.failed++;
              errors.push(`${guestData.firstName} ${guestData.lastName}: ${individualError.message}`);
              console.error(`Failed to insert ${guestData.firstName} ${guestData.lastName}:`, individualError);
            }
          }
        }
      }
    }

    results.failed += errors.length;
    results.errors = errors;

    const statusCode = results.imported > 0 ? 200 : 400;
    
    res.status(statusCode).json({
      message: results.imported > 0 
        ? `יובאו בהצלחה ${results.imported} מוזמנים`
        : 'הייבוא נכשל',
      ...results
    });

  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ 
      message: req.t('errors.serverError'),
      imported: 0,
      failed: 0,
      errors: [err.message]
    });
  }
};

const deleteGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';

    await Guest.findByIdAndDelete(guestId);

    if (wasConfirmed) {
      await triggerSeatingSync(eventId, req.userId, 'guest_deleted', {
        guestId,
        guest: {
          firstName: guest.firstName,
          lastName: guest.lastName,
          attendingCount: guest.attendingCount
        }
      });
    }

    res.json({ message: req.t('guests.deleteSuccess') });
  } catch (err) {
    console.error('Error deleting guest:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { firstName, lastName, phone, group, customGroup } = req.body;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';
    const oldAttendingCount = guest.attendingCount || 1;

    if (firstName !== undefined) guest.firstName = firstName.trim();
    if (lastName !== undefined) guest.lastName = lastName.trim();
    if (phone !== undefined) guest.phone = phone.trim();
    
    if (group !== undefined) {
      let finalGroup = group || 'other';
      let finalCustomGroup = undefined;

      if (group === 'custom' || !['family', 'friends', 'work', 'other'].includes(group)) {
        if (customGroup && customGroup.trim()) {
          finalGroup = customGroup.trim();
          finalCustomGroup = customGroup.trim();
        } else if (!['family', 'friends', 'work', 'other'].includes(group)) {
          finalGroup = group;
          finalCustomGroup = group;
        } else {
          finalGroup = 'other';
        }
      }

      guest.group = finalGroup;
      guest.customGroup = finalCustomGroup;
    }

    const updatedGuest = await guest.save();

    if (wasConfirmed && (firstName || lastName || group || customGroup)) {
      await triggerSeatingSync(eventId, req.userId, 'guest_details_updated', {
        guestId,
        guest: updatedGuest,
        oldAttendingCount,
        newAttendingCount: updatedGuest.attendingCount
      });
    }

    res.json(updatedGuest);
  } catch (err) {
    console.error('Error updating guest:', err);
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(error => error.message);
      return res.status(400).json({ 
        message: req.t('errors.validationError'),
        errors 
      });
    }
    
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuestRSVP = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { rsvpStatus, guestNotes, attendingCount } = req.body;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const oldStatus = guest.rsvpStatus;
    const oldAttendingCount = guest.attendingCount || 1;
    let syncTriggerData = null;

    if (rsvpStatus !== undefined) {
      guest.rsvpStatus = rsvpStatus;
      guest.rsvpReceivedAt = Date.now();
    }
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    if (attendingCount !== undefined) {
      const count = parseInt(attendingCount);
      if (!isNaN(count) && count >= 0) {
        guest.attendingCount = count;
      }
    } else if (rsvpStatus === 'declined') {
      guest.attendingCount = 0;
    } else if (rsvpStatus === 'confirmed' && (!guest.attendingCount || guest.attendingCount < 1)) {
      guest.attendingCount = 1;
    }

    const updatedGuest = await guest.save();
    const newAttendingCount = updatedGuest.attendingCount || 1;

    if (oldStatus !== rsvpStatus) {
      if (rsvpStatus === 'confirmed' && oldStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_became_confirmed',
          guestId,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus
        };
      } else if (oldStatus === 'confirmed' && rsvpStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_no_longer_confirmed',
          guestId,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus
        };
      }
    } else if (rsvpStatus === 'confirmed' && oldAttendingCount !== newAttendingCount) {
      syncTriggerData = {
        type: 'attending_count_changed',
        guestId,
        guest: updatedGuest,
        oldCount: oldAttendingCount,
        newCount: newAttendingCount
      };
    }

    if (syncTriggerData) {
      await triggerSeatingSync(eventId, req.userId, 'rsvp_updated', syncTriggerData);
    }

    res.json({
      message: req.t('guests.rsvpUpdateSuccess'),
      guest: updatedGuest
    });
  } catch (err) {
    console.error('Error updating guest RSVP:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getEventGroups = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId }, 'group customGroup');
    
    const groups = new Set();
    guests.forEach(guest => {
      if (['family', 'friends', 'work', 'other'].includes(guest.group)) {
        groups.add(guest.group);
      } else if (guest.customGroup) {
        groups.add(guest.customGroup);
      } else {
        groups.add(guest.group);
      }
    });

    res.json(Array.from(groups));
  } catch (err) {
    console.error('Error fetching event groups:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const getGuestStats = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const guests = await Guest.find({ event: eventId, user: req.userId });
    
    const stats = {
      total: guests.length,
      confirmed: guests.filter(g => g.rsvpStatus === 'confirmed').length,
      declined: guests.filter(g => g.rsvpStatus === 'declined').length,
      pending: guests.filter(g => g.rsvpStatus === 'pending').length,
      no_response: guests.filter(g => g.rsvpStatus === 'no_response').length,
      byGroup: {}
    };

    guests.forEach(guest => {
      const group = guest.customGroup || guest.group;
      if (!stats.byGroup[group]) {
        stats.byGroup[group] = {
          total: 0,
          confirmed: 0,
          declined: 0,
          pending: 0,
          no_response: 0
        };
      }
      stats.byGroup[group].total++;
      stats.byGroup[group][guest.rsvpStatus]++;
    });

    res.json(stats);
  } catch (err) {
    console.error('Error fetching guest stats:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuestRSVPPublic = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, rsvpStatus, guestNotes, attendingCount } = req.body;
    
    const guest = await Guest.findOne({ 
      phone: phone.trim(), 
      event: eventId 
    });
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound')
      });
    }

    const oldStatus = guest.rsvpStatus;
    const oldAttendingCount = guest.attendingCount || 1;
    let syncTriggerData = null;

    guest.rsvpStatus = rsvpStatus;
    guest.rsvpReceivedAt = Date.now();
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }
    
    if (attendingCount !== undefined && attendingCount >= 0) {
      guest.attendingCount = attendingCount;
    } else if (rsvpStatus === 'confirmed' && attendingCount === undefined) {
      guest.attendingCount = guest.attendingCount || 1;
    } else if (rsvpStatus === 'declined') {
      guest.attendingCount = 0;
    }

    const updatedGuest = await guest.save();
    const newAttendingCount = updatedGuest.attendingCount || 1;

    if (oldStatus !== rsvpStatus) {
      if (rsvpStatus === 'confirmed' && oldStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_became_confirmed',
          guestId: updatedGuest._id,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus
        };
      } else if (oldStatus === 'confirmed' && rsvpStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_no_longer_confirmed',
          guestId: updatedGuest._id,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus
        };
      }
    } else if (rsvpStatus === 'confirmed' && oldAttendingCount !== newAttendingCount) {
      syncTriggerData = {
        type: 'attending_count_changed',
        guestId: updatedGuest._id,
        guest: updatedGuest,
        oldCount: oldAttendingCount,
        newCount: newAttendingCount
      };
    }

    if (syncTriggerData) {
      await triggerSeatingSync(eventId, updatedGuest.user, 'public_rsvp_updated', syncTriggerData);
    }
    
    res.json({
      message: req.t('guests.rsvpUpdateSuccess'),
      guest: {
        firstName: updatedGuest.firstName,
        lastName: updatedGuest.lastName,
        rsvpStatus: updatedGuest.rsvpStatus,
        attendingCount: updatedGuest.attendingCount
      }
    });
  } catch (err) {
    console.error('Error updating guest RSVP (public):', err);
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

const getEventForRSVP = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId, 'title date');
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound')});
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event for RSVP:', err);
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

const checkGuestByPhone = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body;
    
    const guest = await Guest.findOne({ 
      phone: phone.trim(), 
      event: eventId 
    }, 'firstName lastName rsvpStatus attendingCount guestNotes');
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound') 
      });
    }

    res.json({
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        rsvpStatus: guest.rsvpStatus,
        attendingCount: guest.attendingCount || 1,
        guestNotes: guest.guestNotes || ''
      }
    });
  } catch (err) {
    console.error('Error checking guest by phone:', err);
    res.status(500).json({ message: req.t('errors.serverError') || 'שגיאת שרת' });
  }
};

const generateRSVPLink = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') || 'אירוע לא נמצא' });
    }

    const rsvpLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/rsvp/${eventId}`;
    
    res.json({ 
      rsvpLink,
      eventName: event.eventName 
    });
  } catch (err) {
    console.error('Error generating RSVP link:', err);
    res.status(500).json({ message: req.t('errors.serverError') || 'שגיאת שרת' });
  }
};

const updateGuestGift = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { hasGift, giftDescription, giftValue } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    if (new Date() <= new Date(event.date)) {
      return res.status(400).json({ 
        message: req.t('guests.gifts.eventNotPassed') 
      });
    }
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId, 
      user: req.userId 
    });
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    guest.gift = {
      hasGift: hasGift,
      description: hasGift ? (giftDescription || '') : '',
      value: hasGift ? (giftValue || 0) : 0
    };

    const updatedGuest = await guest.save();
    res.json(updatedGuest);
  } catch (err) {
    console.error('Error updating guest gift:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const triggerSeatingSync = async (eventId, userId, changeType, changeData) => {
  try {
    const seating = await Seating.findOne({ event: eventId, user: userId });
    
    if (!seating) {
      return;
    }

    const recentTriggers = (seating.syncTriggers || []).filter(trigger => 
      !trigger.processed && 
      (new Date() - trigger.timestamp) < 30000 &&
      trigger.changeType === changeType &&
      JSON.stringify(trigger.changeData) === JSON.stringify(changeData)
    );

    if (recentTriggers.length > 0) {
      console.log(`Duplicate sync trigger ignored for event ${eventId}:`, changeType);
      return;
    }

    const syncTrigger = {
      timestamp: new Date(),
      changeType,
      changeData,
      processed: false
    };

    await Seating.findOneAndUpdate(
      { event: eventId, user: userId },
      { 
        $push: { 
          syncTriggers: {
            $each: [syncTrigger],
            $slice: -10
          }
        },
        $set: { lastSyncTrigger: new Date() }
      },
      { upsert: false }
    );

    console.log(`Seating sync triggered for event ${eventId}:`, changeType, changeData);
  } catch (error) {
    console.error('Error triggering seating sync:', error);
  }
};

const getSeatingSync = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const seating = await Seating.findOne({ event: eventId, user: req.userId });
    
    if (!seating) {
      return res.json({
        syncRequired: false,
        lastSync: null,
        pendingTriggers: []
      });
    }

    const pendingTriggers = (seating.syncTriggers || []).filter(trigger => !trigger.processed);
    
    res.json({
      syncRequired: pendingTriggers.length > 0,
      lastSync: seating.lastSyncTrigger || null,
      pendingTriggers: pendingTriggers.map(trigger => ({
        timestamp: trigger.timestamp,
        changeType: trigger.changeType,
        changeData: trigger.changeData
      }))
    });
  } catch (err) {
    console.error('Error getting seating sync status:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const markSyncProcessed = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { triggerTimestamps } = req.body;
    
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    await Seating.findOneAndUpdate(
      { event: eventId, user: req.userId },
      { 
        $set: { 
          "syncTriggers.$[elem].processed": true 
        }
      },
      { 
        arrayFilters: [{ 
          "elem.timestamp": { $in: triggerTimestamps.map(ts => new Date(ts)) } 
        }]
      }
    );

    res.json({ message: req.t('seating.sync.triggersProcessed') });
  } catch (err) {
    console.error('Error marking sync as processed:', err);
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

module.exports = {
  getEventGuests,
  addGuest,
  bulkImportGuests,
  updateGuest,
  deleteGuest,
  updateGuestRSVP,
  getEventGroups,
  getGuestStats,
  updateGuestRSVPPublic,
  getEventForRSVP,
  checkGuestByPhone,
  generateRSVPLink,
  updateGuestGift,
  getSeatingSync,
  markSyncProcessed,
  triggerSeatingSync
};