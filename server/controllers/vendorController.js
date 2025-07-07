// controllers/vendorController.js
const Event = require('../models/Event');
const i18next = require('i18next');

const getEventVendors = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ msg: i18next.t('events.notFound') });
    }

    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: i18next.t('auth.invalidToken') });
    }

    res.json(event.vendors || []);
  } catch (err) {
    console.error(err.message);
    if (err.kind === 'ObjectId') {
      return res.status(404).json({ msg: i18next.t('events.notFound') });
    }
    res.status(500).send(i18next.t('errors.serverError'));
  }
};

const addVendor = async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
  
      if (!event) {
        return res.status(404).json({ msg: i18next.t('events.notFound') });
      }
  
      if (event.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: i18next.t('auth.invalidToken') });
      }
  
      const newVendor = {
        name: req.body.name,
        category: req.body.category,
        phone: req.body.phone,
        notes: req.body.notes || ''
      };
  
      if (event.vendors && event.vendors.some(vendor => vendor.name === newVendor.name)) {
        return res.status(400).json({ msg: i18next.t('errors.vendorExistingName') });
      }
  
      if (!event.vendors) {
        event.vendors = [];
      }
      
      event.vendors.push(newVendor);
      await event.save();
  
      res.json({ 
        vendors: event.vendors,
        msg: i18next.t('events.vendors.addSuccess')
      });
    } catch (err) {
      console.error(err.message);
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => error.message);
        return res.status(400).json({ errors });
      }
      res.status(500).send(i18next.t('errors.serverError'));
    }
};

const updateVendor = async (req, res) => {
    try {
      const event = await Event.findById(req.params.eventId);
  
      if (!event) {
        return res.status(404).json({ msg: i18next.t('events.notFound') });
      }
  
      if (event.user.toString() !== req.user.id) {
        return res.status(401).json({ msg: i18next.t('auth.invalidToken') });
      }
  
      const vendorIndex = event.vendors.findIndex(v => v._id.toString() === req.params.vendorId);
      
      if (vendorIndex === -1) {
        return res.status(404).json({ msg: i18next.t('events.vendors.notFound') });
      }
  
      if (req.body.name) event.vendors[vendorIndex].name = req.body.name;
      if (req.body.category) event.vendors[vendorIndex].category = req.body.category;
      if (req.body.phone !== undefined) event.vendors[vendorIndex].phone = req.body.phone;
      if (req.body.notes !== undefined) event.vendors[vendorIndex].notes = req.body.notes;
  
      await event.save();
  
      res.json({ 
        vendors: event.vendors,
        msg: i18next.t('events.vendors.updateSuccess')
      });
    } catch (err) {
      console.error(err.message);
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(error => error.message);
        return res.status(400).json({ errors });
      }
      res.status(500).send(i18next.t('errors.serverError'));
    }
};

const deleteVendor = async (req, res) => {
  try {
    const event = await Event.findById(req.params.eventId);

    if (!event) {
      return res.status(404).json({ msg: i18next.t('events.notFound') });
    }

    if (event.user.toString() !== req.user.id) {
      return res.status(401).json({ msg: i18next.t('auth.invalidToken') });
    }

    const vendorIndex = event.vendors.findIndex(v => v._id.toString() === req.params.vendorId);
    
    if (vendorIndex === -1) {
      return res.status(404).json({ msg: i18next.t('events.vendors.notFound') });
    }
    
    event.vendors.splice(vendorIndex, 1);
    await event.save();

    res.json({ 
      vendors: event.vendors,
      msg: i18next.t('events.vendors.deleteSuccess')
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send(i18next.t('errors.serverError'));
  }
};

module.exports = {
  getEventVendors,
  addVendor,
  updateVendor,
  deleteVendor
};