const Guest = require('../models/Guest');
const Event = require('../models/Event');

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
      attendingCount: 1 // ברירת מחדל של 1
    };

    if (finalCustomGroup) {
      guestData.customGroup = finalCustomGroup;
    }

    const newGuest = new Guest(guestData);
    const savedGuest = await newGuest.save();
    
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

// פונקציה מואצת לייבוא כמויות גדולות
const bulkImportGuests = async (req, res) => {
  try {
    const { eventId } = req.params;
    const { guests } = req.body;
    
    // בדיקת תקינות
    if (!guests || !Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ 
        message: req.t('import.errors.noData') || 'אין נתונים לייבוא',
        imported: 0,
        failed: 0,
        errors: []
      });
    }

    // בדיקה שהאירוע קיים
    const event = await Event.findOne({ _id: eventId, user: req.userId });
    if (!event) {
      return res.status(404).json({ 
        message: req.t('events.notFound') || 'אירוע לא נמצא',
        imported: 0,
        failed: 0,
        errors: []
      });
    }

    console.log(`Starting optimized bulk import of ${guests.length} guests for event ${eventId}`);

    const results = {
      imported: 0,
      failed: 0,
      errors: [],
      duplicates: 0
    };

    const guestsToInsert = [];
    const errors = [];
    const phoneNumbers = [];

    // 1. וולידציה ראשונית וחילוץ מספרי טלפון
    for (let i = 0; i < guests.length; i++) {
      const guest = guests[i];
      
      // ולידציה בסיסית
      if (!guest.firstName || !guest.firstName.trim()) {
        errors.push(`שם פרטי נדרש - שורה ${i + 1}`);
        continue;
      }

      if (!guest.lastName || !guest.lastName.trim()) {
        errors.push(`שם משפחה נדרש - שורה ${i + 1}`);
        continue;
      }

      // בדיקת פורמט טלפון
      if (guest.phone && guest.phone.trim()) {
        const phoneToCheck = guest.phone.trim();
        if (!/^05\d-\d{7}$/.test(phoneToCheck)) {
          errors.push(`פורמט טלפון לא תקין - ${guest.firstName} ${guest.lastName}`);
          continue;
        }
        phoneNumbers.push(phoneToCheck);
      } else {
        phoneNumbers.push(null);
      }

      // הכנת נתוני המוזמן
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
        updatedAt: new Date(),
        originalIndex: i // לצורך מעקב אחר שגיאות
      };

      guestsToInsert.push(guestData);
    }

    // 2. בדיקת כפילויות בבקשה אחת (רק עבור מי שיש לו טלפון)
    const validPhones = phoneNumbers.filter(phone => phone !== null);
    let existingGuests = [];
    
    if (validPhones.length > 0) {
      console.log(`Checking duplicates for ${validPhones.length} phone numbers...`);
      existingGuests = await Guest.find({
        phone: { $in: validPhones },
        event: eventId,
        user: req.userId
      }, 'phone');
    }

    const existingPhoneSet = new Set(existingGuests.map(g => g.phone));

    // 3. סינון מוזמנים שאינם כפילויות
    const finalGuestsToInsert = guestsToInsert.filter(guest => {
      if (guest.phone && existingPhoneSet.has(guest.phone)) {
        results.duplicates++;
        console.log(`Duplicate found: ${guest.firstName} ${guest.lastName} - ${guest.phone}`);
        return false;
      }
      return true;
    });

    // 4. ייבוא המוזמנים באצווה
    if (finalGuestsToInsert.length > 0) {
      try {
        console.log(`Inserting ${finalGuestsToInsert.length} guests into database...`);
        
        // הסרת שדה originalIndex לפני ההכנסה למסד הנתונים
        const cleanGuestsData = finalGuestsToInsert.map(guest => {
          const { originalIndex, ...cleanGuest } = guest;
          return cleanGuest;
        });

        const insertResult = await Guest.insertMany(cleanGuestsData, { 
          ordered: false // ממשיך גם אם יש שגיאות
        });

        results.imported = insertResult.length;
        console.log(`Successfully bulk inserted ${results.imported} guests`);

      } catch (insertError) {
        console.error('Bulk insert error:', insertError);
        
        // אם יש שגיאות MongoDB, נטפל בהן
        if (insertError.insertedDocs) {
          results.imported = insertError.insertedDocs.length;
          console.log(`Partially successful: ${results.imported} guests inserted`);
        }

        // במקרה של כישלון מוחלט, fallback ל-individual inserts
        if (results.imported === 0) {
          console.log('Falling back to individual inserts...');
          
          const cleanGuestsData = finalGuestsToInsert.map(guest => {
            const { originalIndex, ...cleanGuest } = guest;
            return cleanGuest;
          });

          for (const guestData of cleanGuestsData) {
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

    // 5. חישוב תוצאות סופיות
    results.failed = guests.length - results.imported - results.duplicates - errors.length;
    results.errors = errors;

    console.log(`Optimized bulk import completed in record time:`, {
      total: guests.length,
      imported: results.imported,
      duplicates: results.duplicates,
      failed: results.failed,
      errors: errors.length
    });

    // החזרת תוצאה
    const statusCode = results.imported > 0 ? 200 : 400;
    
    res.status(statusCode).json({
      message: results.imported > 0 
        ? `בוצע ייבוא מהיר של ${results.imported} מוזמנים בהצלחה!`
        : 'הייבוא נכשל',
      ...results
    });

  } catch (err) {
    console.error('Optimized bulk import error:', err);
    res.status(500).json({ 
      message: req.t('errors.serverError') || 'שגיאת שרת',
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

    await Guest.findByIdAndDelete(guestId);
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

    if (rsvpStatus !== undefined) {
      guest.rsvpStatus = rsvpStatus;
      guest.rsvpReceivedAt = Date.now();
    }
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }

    // עדכון attendingCount
    if (attendingCount !== undefined) {
      guest.attendingCount = attendingCount;
    } else if (rsvpStatus === 'confirmed' && !guest.attendingCount) {
      // אם לא הוגדר attendingCount אבל סטטוס הוא confirmed, קבע 1
      guest.attendingCount = 1;
    } else if (rsvpStatus === 'declined') {
      // אם סטטוס הוא declined, קבע 0
      guest.attendingCount = 0;
    }

    const updatedGuest = await guest.save();
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
      invitationsSent: guests.filter(g => g.invitationSent).length,
      totalAttending: guests.filter(g => g.rsvpStatus === 'confirmed')
                          .reduce((sum, guest) => sum + (guest.attendingCount || 1), 0),
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
    
    // Find the guest by phone number and event
    const guest = await Guest.findOne({ 
      phone: phone.trim(), 
      event: eventId 
    });
    
    if (!guest) {
      return res.status(404).json({ 
        message: req.t('guests.errors.phoneNotFound') || 'מספר טלפון לא נמצא'
      });
    }

    // Update RSVP information
    guest.rsvpStatus = rsvpStatus;
    guest.rsvpReceivedAt = Date.now();
    
    if (guestNotes !== undefined) {
      guest.guestNotes = guestNotes;
    }
    
    // עדכון attendingCount
    if (attendingCount !== undefined && attendingCount >= 0) {
      guest.attendingCount = attendingCount;
    } else if (rsvpStatus === 'confirmed' && attendingCount === undefined) {
      // אם אישר הגעה אבל לא ציין כמות, השתמש בכמות הקיימת או 1
      guest.attendingCount = guest.attendingCount || 1;
    } else if (rsvpStatus === 'declined') {
      // אם סירב, קבע 0
      guest.attendingCount = 0;
    }

    const updatedGuest = await guest.save();
    
    res.json({
      message: req.t('guests.rsvpUpdateSuccess') || 'אישור הגעה עודכן בהצלחה',
      guest: {
        firstName: updatedGuest.firstName,
        lastName: updatedGuest.lastName,
        rsvpStatus: updatedGuest.rsvpStatus,
        attendingCount: updatedGuest.attendingCount
      }
    });
  } catch (err) {
    console.error('Error updating guest RSVP (public):', err);
    res.status(500).json({ message: req.t('errors.serverError') || 'שגיאת שרת' });
  }
};

const getEventForRSVP = async (req, res) => {
  try {
    const { eventId } = req.params;
    
    const event = await Event.findById(eventId, 'eventName eventDate eventLocation');
    if (!event) {
      return res.status(404).json({ message: req.t('events.notFound') || 'אירוע לא נמצא' });
    }

    res.json(event);
  } catch (err) {
    console.error('Error fetching event for RSVP:', err);
    res.status(500).json({ message: req.t('errors.serverError') || 'שגיאת שרת' });
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
        message: req.t('guests.errors.phoneNotFound') || 'מספר טלפון לא נמצא'
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
    
    // Verify event exists and belongs to user
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
  generateRSVPLink
};