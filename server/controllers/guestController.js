/**
 * guestController.js
 *
 * Controller for managing event guests. Handles all guest-related operations including
 * CRUD, bulk import, RSVP management (private and public), gift tracking, and
 * seating synchronization.
 *
 * Main features:
 * - Guest CRUD operations
 * - Bulk import with validation
 * - RSVP management with gender-separated seating support
 * - Custom group management
 * - Gift tracking with budget sync
 * - Automatic seating sync on guest changes
 */

const Guest = require('../models/Guest');
const Event = require('../models/Event');
const Seating = require('../models/Seating');
const { fetchContacts } = require('../services/googleContactsService');

/**
 * Retrieves all guests for a specific event, sorted by last name then first name.
 * @route GET /api/events/:eventId/guests
 */
const getEventGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const guests = await Guest.find({ event: eventId })
      .sort({ lastName: 1, firstName: 1 });
        
    res.json(guests);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Adds a new guest to an event.
 * Handles custom group logic: if group is 'custom' or not a predefined value,
 * uses customGroup field. Supports gender field for separated seating events.
 * Triggers seating sync if guest is confirmed.
 * @route POST /api/events/:eventId/guests
 */
const addGuest = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { firstName, lastName, phone, group, customGroup, gender } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    // Group assignment logic:
    // - Predefined groups: 'family', 'friends', 'work', 'other'
    // - If 'custom' is selected, use customGroup value
    // - If group is not predefined, treat it as a custom group name
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

    if (event.isSeparatedSeating && gender && ['male', 'female'].includes(gender)) {
      guestData.gender = gender;
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

/**
 * Imports multiple guests at once from an array (e.g., from Excel/CSV).
 * Validates each guest (firstName, lastName required, phone format).
 * Uses insertMany with ordered:false for partial success on duplicates.
 * Falls back to individual inserts if bulk insert fails completely.
 * @route POST /api/events/:eventId/guests/import
 */
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
        errors.push(`First name required - row${i + 1}`);
        continue;
      }

      if (!guest.lastName || !guest.lastName.trim()) {
        errors.push(`Last name required - row ${i + 1}`);
        continue;
      }

      if (guest.phone && guest.phone.trim()) {
        const phoneToCheck = guest.phone.trim();
        if (!/^05\d-\d{7}$/.test(phoneToCheck)) {
          errors.push(`Invalid phone format  - ${guest.firstName} ${guest.lastName}`);
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
        // Bulk insert with ordered:false allows partial success
        // (continues inserting even if some fail due to duplicates)
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
        // Partial success: some documents may have been inserted
        if (insertError.insertedDocs) {
          results.imported = insertError.insertedDocs.length;
        }

        // Fallback: if bulk insert completely failed, try individual inserts
        // This provides better error messages per guest
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
        ? `Successfully imported ${results.imported} guests`
        : 'Import failed',
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

/**
 * Deletes a guest from an event.
 * Triggers seating sync if the guest was confirmed (to remove from seating).
 * @route DELETE /api/events/:eventId/guests/:guestId
 */
const deleteGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;

    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId 
    });

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';

    await Guest.findByIdAndDelete(guestId);

    if (wasConfirmed) {
      await triggerSeatingSync(eventId, req.userId, 'guest_deleted', {
        guestId: guestId
      });
    }

    res.json({ message: req.t('guests.deleteSuccess') });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Updates guest details (name, phone, group, gender).
 * Handles custom group logic similar to addGuest.
 * Triggers seating sync if guest was confirmed.
 * @route PUT /api/events/:eventId/guests/:guestId
 */
const updateGuest = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { firstName, lastName, phone, group, customGroup, gender } = req.body;

    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId 
    });

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    if (firstName !== undefined) guest.firstName = firstName.trim();
    if (lastName !== undefined) guest.lastName = lastName.trim();
    if (phone !== undefined) guest.phone = phone.trim();

    if (group !== undefined) {
      if (group === 'custom' || !['family', 'friends', 'work', 'other'].includes(group)) {
        if (customGroup && customGroup.trim()) {
          guest.group = customGroup.trim();
          guest.customGroup = customGroup.trim();
        } else if (!['family', 'friends', 'work', 'other'].includes(group)) {
          guest.group = group;
          guest.customGroup = group;
        } else {
          guest.group = 'other';
          guest.customGroup = undefined;
        }
      } else {
        guest.group = group;
        guest.customGroup = undefined;
      }
    }

    if (event.isSeparatedSeating && gender && ['male', 'female'].includes(gender)) {
      guest.gender = gender;
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';
    const updatedGuest = await guest.save();

    if (wasConfirmed) {
      await triggerSeatingSync(eventId, req.userId, 'guest_updated', {
        guestId: updatedGuest._id,
        guest: updatedGuest
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

/**
 * Updates guest RSVP status (confirmed/declined/pending).
 * For confirmed status: sets attendingCount, or maleCount/femaleCount for separated seating.
 * For non-confirmed: resets counts to 0 and clears ride info.
 * Triggers seating sync when:
 *   - Status changes to confirmed (new guests to place)
 *   - Attending count increases (more people to place)
 * @route PUT /api/events/:eventId/guests/:guestId/rsvp
 */
const updateGuestRSVP = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { rsvpStatus, attendingCount, maleCount, femaleCount, guestNotes } = req.body;

    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId 
    });

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.notFound') });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';
    const willBeConfirmed = rsvpStatus === 'confirmed';
    const oldAttendingCount = guest.attendingCount || 0;
    const oldMaleCount = guest.maleCount || 0;
    const oldFemaleCount = guest.femaleCount || 0;

    guest.rsvpStatus = rsvpStatus;

    if (rsvpStatus === 'confirmed') {
      if (event.isSeparatedSeating) {
        guest.maleCount = Math.max(0, maleCount || 0);
        guest.femaleCount = Math.max(0, femaleCount || 0);
        guest.attendingCount = guest.maleCount + guest.femaleCount;
      } else {
        guest.attendingCount = Math.max(1, attendingCount || 1);
      }
      guest.rsvpReceivedAt = new Date();
    } else {
        guest.attendingCount = 0;
        guest.maleCount = 0;
        guest.femaleCount = 0;
        
        if (guest.rideInfo && guest.rideInfo.status && guest.rideInfo.status !== 'not_set') {
          guest.rideInfo = {
            status: 'not_set',
            contactHistory: guest.rideInfo.contactHistory || [],
            lastUpdated: new Date()
          };
        }
      }

    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    const updatedGuest = await guest.save();

    const newAttendingCount = updatedGuest.attendingCount || 0;
    const newMaleCount = updatedGuest.maleCount || 0;
    const newFemaleCount = updatedGuest.femaleCount || 0;

    // Seating sync triggers:
    // 1. New confirmation: guest needs to be placed in seating
    // 2. Increased count: additional people need seats (but not for decreases)
    const attendingCountIncreased = willBeConfirmed && wasConfirmed && (
      (event.isSeparatedSeating && (newMaleCount > oldMaleCount || newFemaleCount > oldFemaleCount)) ||
      (!event.isSeparatedSeating && newAttendingCount > oldAttendingCount)
    );

    if (!wasConfirmed && willBeConfirmed) {
      // Guest just confirmed - trigger sync to add them to seating
      await triggerSeatingSync(eventId, req.userId, 'rsvp_updated', {
        guestId: updatedGuest._id.toString(),
        guest: updatedGuest,
        type: 'status_became_confirmed',
        wasConfirmed,
        willBeConfirmed
      });
    } else if (attendingCountIncreased) {
      const changedGenders = [];
      if (event.isSeparatedSeating) {
        if (newMaleCount > oldMaleCount) changedGenders.push('male');
        if (newFemaleCount > oldFemaleCount) changedGenders.push('female');
      }
      
      await triggerSeatingSync(eventId, req.userId, 'rsvp_updated', {
        guestId: updatedGuest._id.toString(),
        guest: updatedGuest,
        type: 'attending_count_increased',
        oldCount: oldAttendingCount,
        newCount: newAttendingCount,
        oldMaleCount,
        newMaleCount,
        oldFemaleCount,
        newFemaleCount,
        changedGenders
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

/**
 * Returns all unique group names used by guests in an event.
 * Includes both predefined groups (family, friends, work, other) and custom groups.
 * @route GET /api/events/:eventId/groups
 */
const getEventGroups = async (req, res) => {
  try {
    const { eventId } = req.params;

    const guests = await Guest.find({ event: eventId });

    const groupSet = new Set();

    guests.forEach(guest => {
      if (guest.customGroup) {
        groupSet.add(guest.customGroup);
      } else if (guest.group) {
        groupSet.add(guest.group);
      }
    });

    const groups = Array.from(groupSet);

    res.json({ groups });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Returns aggregated statistics for event guests.
 * Stats include: totalGuests, confirmed/declined/pending counts,
 * totalAttending, totalMale, totalFemale.
 * @route GET /api/events/:eventId/guests/stats
 */
const getGuestStats = async (req, res) => {
  try {
    const { eventId } = req.params;

    const guests = await Guest.find({ event: eventId });

    const stats = {
      totalGuests: guests.length,
      confirmed: 0,
      declined: 0,
      pending: 0,
      totalAttending: 0,
      totalMale: 0,
      totalFemale: 0
    };

    guests.forEach(guest => {
      if (guest.rsvpStatus === 'confirmed') {
        stats.confirmed++;
        stats.totalAttending += guest.attendingCount || 0;
        stats.totalMale += guest.maleCount || 0;
        stats.totalFemale += guest.femaleCount || 0;
      } else if (guest.rsvpStatus === 'declined') {
        stats.declined++;
      } else {
        stats.pending++;
      }
    });

    res.json(stats);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Public endpoint for guests to update their own RSVP via phone number.
 * No authentication required - guest identifies themselves by phone.
 * Same RSVP logic as updateGuestRSVP but uses event.user for sync.
 * @route PUT /api/public/events/:eventId/rsvp
 */
const updateGuestRSVPPublic = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone, rsvpStatus, attendingCount, maleCount, femaleCount, guestNotes } = req.body;

    if (!phone) {
      return res.status(400).json({ message: req.t('guests.errors.phoneRequired')});
    }

    const cleanPhone = phone.replace(/\s/g, '');

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound')});
    }

    const guest = await Guest.findOne({ 
      phone: cleanPhone, 
      event: eventId 
    });

    if (!guest) {
      return res.status(404).json({ message: req.t('guests.errors.phoneNotFound')});
    }

    const wasConfirmed = guest.rsvpStatus === 'confirmed';
    const willBeConfirmed = rsvpStatus === 'confirmed';
    const oldAttendingCount = guest.attendingCount || 0;
    const oldMaleCount = guest.maleCount || 0;
    const oldFemaleCount = guest.femaleCount || 0;

    guest.rsvpStatus = rsvpStatus;

    if (rsvpStatus === 'confirmed') {
      if (event.isSeparatedSeating) {
        guest.maleCount = Math.max(0, maleCount || 0);
        guest.femaleCount = Math.max(0, femaleCount || 0);
        guest.attendingCount = guest.maleCount + guest.femaleCount;
      } else {
        guest.attendingCount = Math.max(1, attendingCount || 1);
      }
      guest.rsvpReceivedAt = new Date();
    } else {
        guest.attendingCount = 0;
        guest.maleCount = 0;
        guest.femaleCount = 0;
        
        if (guest.rideInfo && guest.rideInfo.status && guest.rideInfo.status !== 'not_set') {
          guest.rideInfo = {
            status: 'not_set',
            contactHistory: guest.rideInfo.contactHistory || [],
            lastUpdated: new Date()
          };
        }
      }

    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    const updatedGuest = await guest.save();

    const newAttendingCount = updatedGuest.attendingCount || 0;
    const newMaleCount = updatedGuest.maleCount || 0;
    const newFemaleCount = updatedGuest.femaleCount || 0;
    
    const attendingCountIncreased = willBeConfirmed && wasConfirmed && (
      (event.isSeparatedSeating && (newMaleCount > oldMaleCount || newFemaleCount > oldFemaleCount)) ||
      (!event.isSeparatedSeating && newAttendingCount > oldAttendingCount)
    );
    
    if (!wasConfirmed && willBeConfirmed) {
      await triggerSeatingSync(eventId, event.user, 'rsvp_updated', {
        guestId: updatedGuest._id.toString(),
        guest: updatedGuest,
        type: 'status_became_confirmed',
        wasConfirmed,
        willBeConfirmed
      });
    } else if (attendingCountIncreased) {
      const changedGenders = [];
      if (event.isSeparatedSeating) {
        if (newMaleCount > oldMaleCount) changedGenders.push('male');
        if (newFemaleCount > oldFemaleCount) changedGenders.push('female');
      }
      
      await triggerSeatingSync(eventId, event.user, 'rsvp_updated', {
        guestId: updatedGuest._id.toString(),
        guest: updatedGuest,
        type: 'attending_count_increased',
        oldCount: oldAttendingCount,
        newCount: newAttendingCount,
        oldMaleCount,
        newMaleCount,
        oldFemaleCount,
        newFemaleCount,
        changedGenders
      });
    }

    res.json({
      message: req.t('guests.rsvp.updateSuccess'),
      guest: updatedGuest
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

/**
 * Public endpoint to get basic event info for RSVP page.
 * Returns only public-safe fields: title, date, time, isSeparatedSeating.
 * @route GET /api/public/events/:eventId/rsvp-info
 */
const getEventForRSVP = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound')});
    }

    res.json({
      eventId: event._id,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      isSeparatedSeating: event.isSeparatedSeating || false
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

/**
 * Public endpoint to verify a guest exists by phone number.
 * Returns guest name and current RSVP status if found.
 * Used in public RSVP flow to identify the guest before updating.
 * @route POST /api/public/events/:eventId/check-guest
 */
const checkGuestByPhone = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: req.t('guests.errors.phoneRequired')});
    }

    const cleanPhone = phone.replace(/\s/g, '');

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound')});
    }

    const guest = await Guest.findOne({ 
      phone: cleanPhone, 
      event: eventId 
    });
        
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
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Generates a shareable RSVP link for an event.
 * Only accessible by event owner or users with shared access.
 * Returns the public RSVP URL for distribution to guests.
 * @route GET /api/events/:eventId/rsvp-link
 */
const generateRSVPLink = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound')});
    }

    const hasAccess = event.user.toString() === req.userId || 
                     event.sharedWith.some(share => 
                       share.userId && share.userId.toString() === req.userId
                     );

    if (!hasAccess) {
      return res.status(403).json({ message: req.t('errors.accessDenied') });
    }

    const rsvpLink = `${process.env.CLIENT_URL || 'http://localhost:3000'}/rsvp/${eventId}`;
    
    res.json({ 
      rsvpLink,
      eventName: event.title 
    });
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError')});
  }
};

/**
 * Updates gift information for a guest (post-event feature).
 * Only available after event date has passed.
 * Syncs gift value to Budget model as income entry.
 * Requires edit permission (owner or shared with edit access).
 * @route PUT /api/events/:eventId/guests/:guestId/gift
 */
const updateGuestGift = async (req, res) => {
  try {
    const { eventId, guestId } = req.params;
    const { hasGift, giftDescription, giftValue } = req.body;

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') });
    }

    const hasAccess = event.user.toString() === req.userId || 
                     event.sharedWith.some(share => 
                       share.userId && share.userId.toString() === req.userId && 
                       share.permission === 'edit'
                     );

    if (!hasAccess) {
      return res.status(403).json({ message: req.t('errors.accessDenied') });
    }

    if (new Date() <= new Date(event.date)) {
      return res.status(400).json({ 
        message: req.t('guests.gifts.eventNotPassed') 
      });
    }
    
    const guest = await Guest.findOne({ 
      _id: guestId, 
      event: eventId 
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

    // Sync gift to budget as income entry
    // First remove any existing income from this guest, then add new if applicable
    try {
      const Budget = require('../models/Budget');
      const budget = await Budget.findOne({ event: eventId });

      if (budget) {
        // Remove previous gift income from this guest (if any)
        budget.incomes = budget.incomes.filter(income =>
          !income.guestId || income.guestId.toString() !== guestId
        );

        // Add new gift as income if value > 0
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
      // Non-critical: gift saved but budget sync failed
    }

    res.json(updatedGuest);
  } catch (err) {
    res.status(500).json({ message: req.t('errors.serverError') });
  }
};

/**
 * Internal function to notify seating system of guest changes.
 * Creates a sync trigger in the Seating document for the client to poll.
 * Deduplicates triggers within 30 seconds to prevent spam.
 * Keeps only last 10 triggers using $slice.
 *
 * Change types: guest_added, guest_deleted, guest_updated, rsvp_updated, bulk_guests_added
 *
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID who made the change
 * @param {string} changeType - Type of change that occurred
 * @param {object} changeData - Additional data about the change
 */
const triggerSeatingSync = async (eventId, userId, changeType, changeData) => {
  try {
    const seating = await Seating.findOne({ event: eventId });
    
    if (!seating) {
      return;
    }

    // Deduplication: skip if identical trigger exists within last 30 seconds
    // Prevents duplicate syncs from rapid repeated actions
    const recentTriggers = (seating.syncTriggers || []).filter(trigger =>
      !trigger.processed &&
      (new Date() - new Date(trigger.timestamp)) < 30000 &&
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

    const result = await Seating.findOneAndUpdate(
      { event: eventId },
      { 
        $push: { 
          syncTriggers: {
            $each: [syncTrigger],
            $slice: -10
          }
        },
        $set: { lastSyncTrigger: new Date() }
      },
      { upsert: false, new: true }
    );

  } catch (error) {
    // Error triggering seating sync
  }
};

/**
 * Returns pending seating sync triggers for an event.
 * Used by client to poll for changes that require seating updates.
 * @route GET /api/events/:eventId/seating/sync
 */
const getSeatingSync = async (req, res) => {
  try {
    const { eventId } = req.params;

    const event = await Event.findById(eventId);
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

/**
 * Marks seating sync triggers as processed after client handles them.
 * Prevents the same triggers from being returned in subsequent polls.
 * @route POST /api/events/:eventId/seating/sync/processed
 */
const markSyncProcessed = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { triggerTimestamps } = req.body;

    const event = await Event.findById(eventId);
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

/**
 * Fetches Google contacts via server-side proxy.
 * Client sends OAuth access token, server calls Google People API.
 * @route POST /api/events/:eventId/guests/google-contacts
 */
const getGoogleContacts = async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({ message: req.t('contacts.errors.tokenRequired') });
    }

    const contacts = await fetchContacts(accessToken);

    res.json({ contacts });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      return res.status(401).json({ message: req.t('contacts.errors.tokenExpired') });
    }

    res.status(500).json({ message: req.t('contacts.errors.fetchFailed') });
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
  triggerSeatingSync,
  getGoogleContacts
};