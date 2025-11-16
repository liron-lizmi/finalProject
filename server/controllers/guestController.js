// server/controllers/guestController.js
const Guest = require('../models/Guest');
const Event = require('../models/Event');
const Seating = require('../models/Seating');

const getEventGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    let guestsToReturn = [];
    
    const currentEventGuests = await Guest.find({ event: eventId })
      .sort({ lastName: 1, firstName: 1 });
    guestsToReturn = [...currentEventGuests];
        
    const currentEvent = await Event.findById(eventId);
    
    if (currentEvent) {
      if (currentEvent.originalEvent) {
        const originalEventGuests = await Guest.find({ event: currentEvent.originalEvent })
          .sort({ lastName: 1, firstName: 1 });
        guestsToReturn = [...guestsToReturn, ...originalEventGuests];
      }
      else {
        const sharedCopies = await Event.find({ originalEvent: eventId });
        
        for (let copy of sharedCopies) {
          const copyGuests = await Guest.find({ event: copy._id })
            .sort({ lastName: 1, firstName: 1 });
          guestsToReturn = [...guestsToReturn, ...copyGuests];
        }
      }
    }
    
    const uniqueGuests = [];
    const seenPhones = new Set();
    
    for (let guest of guestsToReturn) {
      if (guest.phone && !seenPhones.has(guest.phone)) {
        seenPhones.add(guest.phone);
        uniqueGuests.push(guest);
      } else if (!guest.phone) {
        uniqueGuests.push(guest);
      }
    }
        
    res.json(uniqueGuests.sort((a, b) => {
      const lastNameCompare = a.lastName.localeCompare(b.lastName);
      return lastNameCompare !== 0 ? lastNameCompare : a.firstName.localeCompare(b.firstName);
    }));
    

  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const addGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, phone, group, customGroup, gender } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const targetEventId = event.originalEvent || eventId;

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
      event: targetEventId,
      user: req.userId,
      attendingCount: 1
    };

    if (finalCustomGroup) {
      guestData.customGroup = finalCustomGroup;
    }

    const targetEvent = await Event.findById(targetEventId);
    if (targetEvent && targetEvent.isSeparatedSeating && gender && ['male', 'female'].includes(gender)) {
      guestData.gender = gender;
    }

    const newGuest = new Guest(guestData);
    const savedGuest = await newGuest.save();
    
    if (savedGuest.rsvpStatus === 'confirmed') {
      await triggerSeatingSync(targetEventId, req.userId, 'guest_added', {
        guestId: savedGuest._id,
        guest: savedGuest
      });
    }
    
    res.status(201).json(savedGuest);
  } catch (err) {
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

    let guest = await Guest.findById(guestId);

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const currentEvent = await Event.findById(eventId);
    let isAuthorized = false;
    
    if (guest.event.toString() === eventId) {
      isAuthorized = true;
    } else if (currentEvent) {
      if (currentEvent.originalEvent && guest.event.toString() === currentEvent.originalEvent.toString()) {
        isAuthorized = true;
      } else if (!currentEvent.originalEvent) {
        const sharedCopies = await Event.find({ originalEvent: eventId });
        isAuthorized = sharedCopies.some(copy => guest.event.toString() === copy._id.toString());
      }
    }
    
    if (!isAuthorized) {
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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const event = await Event.findById(eventId);
    const targetEventId = event?.originalEvent || eventId;
    const { firstName, lastName, phone, group, customGroup } = req.body;
    
    let guest = await Guest.findById(guestId);

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

     const currentEvent = await Event.findById(eventId);
    let isAuthorized = false;
    
    if (guest.event.toString() === eventId) {
      isAuthorized = true;
    } else if (currentEvent) {
      if (currentEvent.originalEvent && guest.event.toString() === currentEvent.originalEvent.toString()) {
        isAuthorized = true;
      } else if (!currentEvent.originalEvent) {
        const sharedCopies = await Event.find({ originalEvent: eventId });
        isAuthorized = sharedCopies.some(copy => guest.event.toString() === copy._id.toString());
      }
    }
    
    if (!isAuthorized) {
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
    const { rsvpStatus, guestNotes, attendingCount, maleCount, femaleCount } = req.body;

    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event && !(await Event.findOne({ _id: eventId, 'sharedWith.userId': req.userId }))) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }
    
    let guest = await Guest.findOne({ _id: guestId, event: eventId });
    
    if (!guest && event && event.originalEvent) {
      guest = await Guest.findOne({ _id: guestId, event: event.originalEvent });
    }
    
    if (!guest) {
      const sharedCopies = await Event.find({ 
        $or: [
          { originalEvent: eventId },
          { _id: event?.originalEvent }
        ]
      });
      
      for (let copy of sharedCopies) {
        guest = await Guest.findOne({ _id: guestId, event: copy._id });
        if (guest) break;
      }
    }
    
    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const oldStatus = guest.rsvpStatus;
    const oldAttendingCount = guest.attendingCount || 1;
    const oldMaleCount = guest.maleCount || 0;
    const oldFemaleCount = guest.femaleCount || 0;
    let syncTriggerData = null;

    if (rsvpStatus !== undefined) {
      guest.rsvpStatus = rsvpStatus;
      guest.rsvpReceivedAt = Date.now();
    }
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    if (event.isSeparatedSeating) {
      if (maleCount !== undefined) {
        guest.maleCount = rsvpStatus === 'confirmed' ? Math.max(0, parseInt(maleCount)) : 0;
      }
      if (femaleCount !== undefined) {
        guest.femaleCount = rsvpStatus === 'confirmed' ? Math.max(0, parseInt(femaleCount)) : 0;
      }
      guest.attendingCount = (guest.maleCount || 0) + (guest.femaleCount || 0);
    } else {
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
    }

    const updatedGuest = await guest.save();
    const newAttendingCount = updatedGuest.attendingCount || 1;
    const newMaleCount = updatedGuest.maleCount || 0;
    const newFemaleCount = updatedGuest.femaleCount || 0;

    if (oldStatus !== rsvpStatus) {
      if (rsvpStatus === 'confirmed' && oldStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_became_confirmed',
          guestId,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus,
          isSeparated: event.isSeparatedSeating,
          maleCount: newMaleCount,
          femaleCount: newFemaleCount
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
    } else if (rsvpStatus === 'confirmed') {
      if (currentEvent.isSeparatedSeating) {
        if (oldMaleCount !== newMaleCount || oldFemaleCount !== newFemaleCount) {
          const changedGenders = [];
          if (oldMaleCount !== newMaleCount) {
            changedGenders.push('male');
          }
          if (oldFemaleCount !== newFemaleCount) {
            changedGenders.push('female');
          }
          
          syncTriggerData = {
            type: 'attending_count_changed',
            guestId,
            guest: updatedGuest,
            oldCount: oldAttendingCount,
            newCount: newAttendingCount,
            oldMaleCount,
            newMaleCount,
            oldFemaleCount,
            newFemaleCount,
            isSeparated: true,
            changedGenders
          };
        }
      } else if (oldAttendingCount !== newAttendingCount) {
        syncTriggerData = {
          type: 'attending_count_changed',
          guestId,
          guest: updatedGuest,
          oldCount: oldAttendingCount,
          newCount: newAttendingCount
        };
      }
    }

    if (syncTriggerData) {
      await triggerSeatingSync(guest.event, guest.user, 'rsvp_updated', syncTriggerData);
    }

    res.json({
      message: req.t('guests.rsvp.updateSuccess'),
      guest: updatedGuest
    });
  } catch (err) {
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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

const updateGuestRSVPPublic = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, rsvpStatus, guestNotes, attendingCount, maleCount, femaleCount } = req.body;

    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'נדרש מספר טלפון' });
    }

    const cleanPhone = phone.trim();
    
    const currentEvent = await Event.findById(eventId);
    let guest = null;
    
    guest = await Guest.findOne({ phone: cleanPhone, event: eventId });
    
    if (!guest && currentEvent) {
      if (currentEvent.originalEvent) {
        guest = await Guest.findOne({ 
          phone: cleanPhone, 
          event: currentEvent.originalEvent 
        });
      }
      
      if (!guest && !currentEvent.originalEvent) {
        const sharedCopies = await Event.find({ originalEvent: eventId });
        for (let copy of sharedCopies) {
          guest = await Guest.findOne({ 
            phone: cleanPhone, 
            event: copy._id 
          });
          if (guest) break;
        }
      }
      
      if (!guest) {
        const relatedUserIds = [currentEvent.user];
        if (currentEvent.sharedWith && currentEvent.sharedWith.length > 0) {
          currentEvent.sharedWith.forEach(share => {
            if (share.userId) {
              relatedUserIds.push(share.userId);
            }
          });
        }
        
        guest = await Guest.findOne({ 
          phone: cleanPhone,
          user: { $in: relatedUserIds }
        });
      }
    }
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound')
      });
    }

    const oldStatus = guest.rsvpStatus;
    const oldAttendingCount = guest.attendingCount || 1;
    const oldMaleCount = guest.maleCount || 0;
    const oldFemaleCount = guest.femaleCount || 0;
    let syncTriggerData = null;

    guest.rsvpStatus = rsvpStatus;
    guest.rsvpReceivedAt = new Date();
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }
    
    if (currentEvent.isSeparatedSeating) {
      if (rsvpStatus === 'confirmed') {
        guest.maleCount = maleCount >= 0 ? maleCount : 0;
        guest.femaleCount = femaleCount >= 0 ? femaleCount : 0;
        guest.attendingCount = guest.maleCount + guest.femaleCount;
      } else if (rsvpStatus === 'declined') {
        guest.maleCount = 0;
        guest.femaleCount = 0;
        guest.attendingCount = 0;
      }
    } else {
      if (rsvpStatus === 'confirmed') {
        guest.attendingCount = attendingCount && attendingCount >= 1 ? attendingCount : 1;
      } else if (rsvpStatus === 'declined') {
        guest.attendingCount = 0;
      }
    }

    const updatedGuest = await guest.save();
    const newAttendingCount = updatedGuest.attendingCount || 1;
    const newMaleCount = updatedGuest.maleCount || 0;
    const newFemaleCount = updatedGuest.femaleCount || 0;

    if (oldStatus !== rsvpStatus) {
      if (rsvpStatus === 'confirmed' && oldStatus !== 'confirmed') {
        syncTriggerData = {
          type: 'status_became_confirmed',
          guestId: updatedGuest._id,
          guest: updatedGuest,
          oldStatus,
          newStatus: rsvpStatus,
          isSeparated: currentEvent.isSeparatedSeating,
          maleCount: newMaleCount,
          femaleCount: newFemaleCount
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
    } else if (rsvpStatus === 'confirmed') {
      if (currentEvent.isSeparatedSeating) {
        if (oldMaleCount !== newMaleCount || oldFemaleCount !== newFemaleCount) {
          const changedGenders = [];
          if (oldMaleCount !== newMaleCount) {
            changedGenders.push('male');
          }
          if (oldFemaleCount !== newFemaleCount) {
            changedGenders.push('female');
          }
          
          syncTriggerData = {
            type: 'attending_count_changed',
            guestId,
            guest: updatedGuest,
            oldCount: oldAttendingCount,
            newCount: newAttendingCount,
            oldMaleCount,
            newMaleCount,
            oldFemaleCount,
            newFemaleCount,
            isSeparated: true,
            changedGenders
          };
        }
      } else if (oldAttendingCount !== newAttendingCount) {
        syncTriggerData = {
          type: 'attending_count_changed',
          guestId: updatedGuest._id,
          guest: updatedGuest,
          oldCount: oldAttendingCount,
          newCount: newAttendingCount
        };
      }
    }

    if (syncTriggerData) {
      await triggerSeatingSync(eventId, updatedGuest.user, 'public_rsvp_updated', syncTriggerData);
    }
    
    res.json({
      message: req.t('guests.rsvp.updateSuccess'),
      guest: {
        firstName: updatedGuest.firstName,
        lastName: updatedGuest.lastName,
        rsvpStatus: updatedGuest.rsvpStatus,
        attendingCount: updatedGuest.attendingCount,
        maleCount: updatedGuest.maleCount,
        femaleCount: updatedGuest.femaleCount
      }
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

const getEventForRSVP = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    let event = await Event.findById(eventId, 'eventName date location originalEvent isSeparatedSeating');

    if (!event) {
      return res.status(404).json({ message: 'אירוע לא נמצא' });
    }

    if (event.originalEvent) {
      const originalEvent = await Event.findById(event.originalEvent, 'eventName date location isSeparatedSeating');
      if (originalEvent) {
        event = originalEvent;
      }
    }

    res.json({
      eventName: event.eventName,
      eventDate: event.date,
      eventLocation: event.location,
      isSeparatedSeating: event.isSeparatedSeating || false
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

const checkGuestByPhone = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body;
    
    if (!phone || !phone.trim()) {
      return res.status(400).json({ message: 'נדרש מספר טלפון' });
    }

    const cleanPhone = phone.trim();
    
    const currentEvent = await Event.findById(eventId);
    
    let guest = null;
    let searchedEvents = [];
    
    guest = await Guest.findOne({ phone: cleanPhone, event: eventId });
    searchedEvents.push(eventId);
    
    if (guest) {
      // Guest found
    } else {
      if (currentEvent) {
        if (currentEvent.originalEvent) {
          guest = await Guest.findOne({ 
            phone: cleanPhone, 
            event: currentEvent.originalEvent 
          });
          searchedEvents.push(currentEvent.originalEvent.toString());
        }
        
        if (!guest && !currentEvent.originalEvent) {
          const sharedCopies = await Event.find({ originalEvent: eventId });
          
          for (let copy of sharedCopies) {
            guest = await Guest.findOne({ 
              phone: cleanPhone, 
              event: copy._id 
            });
            searchedEvents.push(copy._id.toString());
            
            if (guest) {
              break;
            }
          }
        }
        
        if (!guest) {
          const relatedUserIds = [currentEvent.user];
          
          if (currentEvent.sharedWith && currentEvent.sharedWith.length > 0) {
            currentEvent.sharedWith.forEach(share => {
              if (share.userId) {
                relatedUserIds.push(share.userId);
              }
            });
          }
          
          guest = await Guest.findOne({ 
            phone: cleanPhone,
            user: { $in: relatedUserIds }
          });
        }
      }
    }
        
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
        maleCount: guest.maleCount || 0,
        femaleCount: guest.femaleCount || 0,
        guestNotes: guest.guestNotes || ''
      }
    });
  } catch (err) {
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

    const actualEventId = event.originalEvent || eventId;
    const rsvpLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/rsvp/${actualEventId}`;
    
    res.json({ 
      rsvpLink,
      eventName: event.eventName 
    });
  } catch (err) {
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

    const targetEventId = event.originalEvent || eventId;
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: targetEventId
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

    try {
      const Budget = require('../models/Budget');
      const budget = await Budget.findOne({ event: targetEventId });
      
      if (budget) {
        budget.incomes = budget.incomes.filter(income => 
          !income.guestId || income.guestId.toString() !== guestId
        );

        if (hasGift && giftValue > 0) {
          const newIncome = {
            source: 'gift',
            guestId: guestId,
            description: giftDescription || `מתנה מ${guest.firstName} ${guest.lastName}`,
            amount: giftValue,
            date: new Date(),
            notes: giftDescription || ''
          };
          budget.incomes.push(newIncome);
          await budget.save();
        } else {
          await budget.save();
        }
      }
    } catch (budgetError) {
      console.error('Error syncing gift to budget:', budgetError);
    }

    res.json(updatedGuest);
  } catch (err) {
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