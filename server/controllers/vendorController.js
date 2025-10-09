const Event = require('../models/Event');
const i18next = require('i18next');
const vendorCacheManager = require('../services/vendorCacheManager');
const googleVendorService = require('../services/googleVendorService');

// Filters vendors by excluding venues and applying geographic area restrictions using Haversine formula
const applyServerFilters = (vendors, filters) => {
  return vendors.filter(vendor => {
    const vendorText = (
      vendor.name + ' ' + 
      (vendor.vicinity || '') + ' ' + 
      (vendor.formatted_address || '')
    ).toLowerCase();
    
    const venueKeywords = ['hotel', 'hall', 'venue', 'event center', 'convention', 'resort', 'banquet'];
    const isVenue = venueKeywords.some(keyword => vendorText.includes(keyword));
    if (isVenue) return false;

    if (filters.area && filters.area !== 'all') {
      if (!vendor.geometry || !vendor.geometry.location) return false;
      
      const vendorLat = vendor.geometry.location.lat;
      const vendorLng = vendor.geometry.location.lng;
      
      const areaLocations = {
        'ירושלים': { lat: 31.7683, lng: 35.2137, radius: 30000 },
        'מרכז': { lat: 32.0853, lng: 34.7818, radius: 25000 },
        'דרום': { lat: 31.2518, lng: 34.7915, radius: 50000 },
        'צפון': { lat: 32.7940, lng: 35.0423, radius: 50000 }
      };
      
      const areaData = areaLocations[filters.area];
      if (areaData) {
        const R = 6371000;
        const dLat = (areaData.lat - vendorLat) * Math.PI / 180;
        const dLng = (areaData.lng - vendorLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(vendorLat * Math.PI / 180) * Math.cos(areaData.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        if (distance > areaData.radius) return false;
      }
    }

    return true;
  });
};

// Converts photo references to full URLs using Google Places Photo API and filters out invalid photos
  const processVendorsWithPhotos = (vendors) => {
  return vendors.map(vendor => {
    if (vendor.photos && vendor.photos.length > 0) {
      vendor.photos = vendor.photos.map(photo => {
        if (!photo) {
          console.warn('Empty photo object found');
          return null;
        }
        
        if (typeof photo === 'string') {
          if (photo.startsWith('http')) {
            return { url: photo };
          } else {
            console.warn('Invalid photo URL string:', photo);
            return null;
          }
        }
        
        if (photo.photo_reference) {
          const url = googleVendorService.getPhotoUrl(photo.photo_reference, 400, 300);
          if (url && url.startsWith('http')) {
            return {
              photo_reference: photo.photo_reference,
              url: url,
              height: photo.height,
              width: photo.width
            };
          } else {
            console.warn('Failed to generate URL for photo_reference:', photo.photo_reference);
            return null;
          }
        }
        
        if (photo.url) {
          if (typeof photo.url === 'string' && photo.url.startsWith('http')) {
            return photo;
          } else {
            console.warn('Invalid URL in photo object:', photo.url);
            return null;
          }
        }
        
        console.warn('Photo without valid reference or URL:', photo);
        return null;
      }).filter(Boolean); 
      
    }
    
    return vendor;
  });
};

// Searches vendors using Google Places API with caching and server-side filtering
const searchVendors = async (req, res) => {
  try {
    const { 
      query = '', 
      area = 'all', 
      vendorType = 'all',
      specificFilters = '',
      kashrutLevel = 'all',
      page = 1,
      language = 'he'
    } = req.query;

    const pageNum = parseInt(page);
    const filters = { 
      area, 
      vendorType, 
      specificFilters: specificFilters ? specificFilters.split(',') : [],
      kashrutLevel
    };

    const hasFilters = area !== 'all' || 
                      vendorType !== 'all' || 
                      specificFilters !== '' ||
                      kashrutLevel !== 'all';

    const cacheKey = vendorCacheManager.generateKey(query, filters, pageNum);
    const cachedData = vendorCacheManager.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    let filteredResults = [];
    let currentPageToken = null;
    let hasMore = true;
    const TARGET = 20;
    let apiCallCount = 0;
    const MAX_API_CALLS = 5;

    if (pageNum > 1) {
      const tokenKey = vendorCacheManager.generateKey(query, filters, `token_page${pageNum - 1}`);
      currentPageToken = vendorCacheManager.get(tokenKey);
      
      if (!currentPageToken) {        
        const location = googleVendorService.getLocationForArea(area);
        const alternativeQuery = googleVendorService.buildAlternativeSearchQuery(
          vendorType, query, filters, pageNum
        );
      
        const result = await googleVendorService.textSearch(
          alternativeQuery, location, location.radius, language
        );
        
        let newVendors = processVendorsWithPhotos(result.results);
        
        if (hasFilters) {
          const beforeFilter = newVendors.length;
          newVendors = applyServerFilters(newVendors, filters);
        }
        
        filteredResults = newVendors;
        currentPageToken = result.nextPageToken;
        hasMore = result.hasMore;
        
      } else {
        
        while (filteredResults.length < TARGET && currentPageToken && apiCallCount < MAX_API_CALLS) {
          apiCallCount++;
          
          const result = await googleVendorService.getNextPage(currentPageToken);
          
          let newVendors = processVendorsWithPhotos(result.results);

          if (hasFilters) {
            const beforeFilter = newVendors.length;
            newVendors = applyServerFilters(newVendors, filters);
          }

          filteredResults = [...filteredResults, ...newVendors];
          currentPageToken = result.nextPageToken;
          hasMore = result.hasMore;
          
          
          if (!currentPageToken || !hasMore) {
            break;
          }
          
          if (filteredResults.length >= TARGET) {
            break;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if ((filteredResults.length < TARGET || !currentPageToken) && apiCallCount < MAX_API_CALLS) {
        
        const location = googleVendorService.getLocationForArea(area);
        const alternativeQuery = googleVendorService.buildAlternativeSearchQuery(
          vendorType, query, filters, pageNum
        );
                
        const result = await googleVendorService.textSearch(
          alternativeQuery, location, location.radius, language
        );
        
        let newVendors = processVendorsWithPhotos(result.results);
        
        if (hasFilters) {
          const beforeFilter = newVendors.length;
          newVendors = applyServerFilters(newVendors, filters);
        }
        
        const existingIds = new Set(filteredResults.map(v => v.place_id));
        newVendors = newVendors.filter(v => !existingIds.has(v.place_id));
        
        filteredResults = [...filteredResults, ...newVendors];
        
        if (result.nextPageToken) {
          currentPageToken = result.nextPageToken;
          hasMore = result.hasMore;
        }
        
      }
      
    } else {
      const searchQuery = googleVendorService.buildSearchQuery(
        vendorType, query, filters
      );
      const location = googleVendorService.getLocationForArea(area);


      let result = await googleVendorService.textSearch(
        searchQuery, location, location.radius, language
      );

      let newVendors = processVendorsWithPhotos(result.results);

      if (hasFilters) {
        const beforeFilter = newVendors.length;
        newVendors = applyServerFilters(newVendors, filters);
      }

      filteredResults = [...filteredResults, ...newVendors];
      currentPageToken = result.nextPageToken;
      hasMore = result.hasMore;

      while (hasFilters && 
            filteredResults.length < TARGET && 
            currentPageToken && 
            apiCallCount < MAX_API_CALLS) {

        await new Promise(resolve => setTimeout(resolve, 1000));
        
        result = await googleVendorService.getNextPage(currentPageToken);
        
        newVendors = processVendorsWithPhotos(result.results);
        
        const beforeFilter = newVendors.length;
        newVendors = applyServerFilters(newVendors, filters);
        
        filteredResults = [...filteredResults, ...newVendors];
        currentPageToken = result.nextPageToken;
        hasMore = result.hasMore;
        
        
        if (!currentPageToken || !hasMore) {
          break;
        }
      }
      
      if (filteredResults.length < TARGET && apiCallCount < MAX_API_CALLS) {
        
        const alternativeQuery = googleVendorService.buildAlternativeSearchQuery(
          vendorType, query, filters, pageNum
        );
                
        result = await googleVendorService.textSearch(
          alternativeQuery, location, location.radius, language
        );
        
        newVendors = processVendorsWithPhotos(result.results);
        
        if (hasFilters) {
          const beforeFilter = newVendors.length;
          newVendors = applyServerFilters(newVendors, filters);
        }
        
        const existingIds = new Set(filteredResults.map(v => v.place_id));
        newVendors = newVendors.filter(v => !existingIds.has(v.place_id));
        
        filteredResults = [...filteredResults, ...newVendors];
        
        if (result.nextPageToken && !currentPageToken) {
          currentPageToken = result.nextPageToken;
          hasMore = result.hasMore;
        }
        
      }
    }

    if (currentPageToken) {
      const tokenKey = vendorCacheManager.generateKey(query, filters, `token_page${pageNum}`);
      vendorCacheManager.set(tokenKey, currentPageToken);
    }

    const response = {
      results: filteredResults.slice(0, 20),
      hasMore: filteredResults.length > 20 || (hasMore && !!currentPageToken),
      currentPage: pageNum,
      totalResults: Math.min(filteredResults.length, 20)
    };

    vendorCacheManager.set(cacheKey, response);
    return res.json(response);

  } catch (error) {
    console.error('❌ Error in search route:', error);
    res.status(500).json({ 
      error: 'Failed to search vendors',
      message: error.message 
    });
  }
};

// Retrieves all vendors associated with a specific event
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

// Adds a new vendor to an event with validation for duplicate names
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

// Updates an existing vendor's details by vendorId
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

// Deletes a vendor from an event by vendorId
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

// Returns cache statistics from vendorCacheManager
const getCacheStats = (req, res) => {
  try {
    const stats = vendorCacheManager.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ msg: 'Server error' });
  }
};

module.exports = {
  getEventVendors,
  addVendor,
  updateVendor,
  deleteVendor,
  searchVendors,
  getCacheStats
};