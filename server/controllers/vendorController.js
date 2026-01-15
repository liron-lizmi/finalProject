const Event = require('../models/Event');
const i18next = require('i18next');
const vendorCacheManager = require('../services/vendorCacheManager');
const googleVendorService = require('../services/googleVendorService');

// Filters vendors by excluding venues, applying geographic area restrictions, and specific filters
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

    if (filters.vendorType === 'catering' && filters.kashrutLevel && filters.kashrutLevel !== 'all') {
      const kashrutKeywords = {
        'mehadrin': ['מהדרין', 'mehadrin'],
        'regular-kosher': ['כשר', 'kosher'],
        'rabbinate': ['רבנות', 'rabbinate'],
        'badatz': ['בד"ץ', 'badatz', 'בדץ'],
        'non-kosher': ['לא כשר', 'non kosher', 'טרף', 'not kosher']
      };
      
      const levelKeywords = kashrutKeywords[filters.kashrutLevel];
      if (levelKeywords) {
        const hasKashrutMatch = levelKeywords.some(keyword => vendorText.includes(keyword));
        if (!hasKashrutMatch) return false;
      }
    }

    if (filters.specificFilters && filters.specificFilters.length > 0) {
      const filterKeywords = {
        // Catering - expanded with more relevant food terms
        'dairy': ['חלבי', 'dairy', 'חלב', 'milk', 'פיצה', 'pizza', 'פסטה', 'pasta', 'גבינות', 'cheeses', 'גבינה', 'cheese', 'מאפים', 'bakery', 'לחם', 'bread'],
        'meat': ['בשרי', 'meat', 'בשר', 'שווארמה', 'shawarma', 'סטייק', 'steak', 'גריל', 'grill', 'המבורגר', 'burger', 'צלייה', 'barbecue', 'bbq'],
        'pareve': ['פרווה', 'pareve', 'parev', 'דגים', 'fish', 'סושי', 'sushi', 'seafood', 'פירות ים', 'ים', 'sea', 'דג', 'salmon', 'סלמון', 'טונה', 'tuna', 'פלפל', 'אסייתי', 'asian', 'יפני', 'japanese'],
        'vegan': ['טבעוני', 'vegan', 'צמחי', 'plant-based', 'טבעונות', 'בריא', 'healthy', 'טבע', 'organic', 'אורגני', 'ירוק', 'green'],
        'vegetarian': ['צמחוני', 'vegetarian', 'ירקות', 'vegetables', 'סלט', 'salad', 'ירק', 'טבעוני', 'vegan', 'בריא', 'healthy'],
        'gluten-free': ['ללא גלוטן', 'gluten free', 'gluten-free', 'glutenfree', 'צליאק', 'celiac', 'בריא', 'healthy', 'אלרגיה', 'allergy', 'דיאטה', 'diet', 'טבעי', 'natural'],

        // Photographer
        'wedding': ['חתונה', 'wedding', 'כלה', 'bride', 'חתן', 'groom', 'צילומי חתונה', 'wedding photography', 'צילום', 'photo', 'photography', 'צלם', 'photographer'],
        'event': ['אירוע', 'event', 'אירועים', 'events', 'מסיבה', 'party', 'בר מצווה', 'bar mitzvah', 'בת מצווה', 'bat mitzvah', 'יום הולדת', 'birthday', 'צילום', 'photo', 'photography', 'צלם', 'photographer'],
        'portrait': ['פורטרט', 'portrait', 'צילומי סטודיו', 'studio photography', 'סטודיו', 'studio', 'הריון', 'תינוק', 'צילום', 'photo', 'photography', 'צלם', 'photographer'],
        'commercial': ['מסחרי', 'commercial', 'פרסום', 'advertising', 'מוצר', 'product', 'תדמית', 'branding', 'קטלוג', 'catalog', 'צילום', 'photo', 'photography', 'צלם', 'photographer'],

        // Florist - expanded with more flower-related terms
        'bridal': ['זר כלה', 'bridal bouquet', 'כלה', 'bridal', 'חתונה', 'wedding', 'זר לכלה', 'פרחים', 'flowers', 'florist', 'זר', 'bouquet', 'פרח', 'flower', 'חנות פרחים', 'flower shop'],
        'arrangements': ['סידורי פרחים', 'flower arrangements', 'סידור פרחים', 'floral arrangement', 'עיצוב פרחים', 'floral design', 'זרי פרחים', 'פרחים', 'flowers', 'florist', 'פרח', 'flower', 'זר', 'bouquet', 'חנות פרחים', 'flower shop'],
        'plants': ['צמחים', 'plants', 'עציצים', 'pots', 'צמחי בית', 'houseplants', 'צמחיה', 'פרחים', 'flowers', 'florist', 'משתלה', 'nursery', 'גן', 'garden', 'צמח', 'plant', 'עציץ', 'pot'],

        // Musician - expanded with more music terms
        'solo': ['סולו', 'solo', 'זמר', 'singer', 'נגן', 'musician', 'זמרת', 'מוזיקה', 'music', 'הופעה', 'performance', 'שיר', 'song', 'אמן', 'artist'],
        'band': ['להקה', 'band', 'תזמורת', 'orchestra', 'הרכב', 'ensemble', 'להקת', 'מוזיקה', 'music', 'הופעה', 'performance', 'הופעות', 'shows'],
        'classical': ['קלאסי', 'classical', 'קלאסית', 'כינור', 'violin', 'פסנתר', 'piano', 'צ\'לו', 'cello', 'קאמרית', 'chamber', 'מוזיקה', 'music', 'תזמורת', 'orchestra', 'נגן', 'musician', 'הופעה', 'performance', 'מיתרים', 'strings', 'קונצרט', 'concert', 'פילהרמונית', 'philharmonic', 'סימפונית', 'symphony', 'נבל', 'harp', 'חליל', 'flute'],
        'modern': ['מודרני', 'modern', 'פופ', 'pop', 'רוק', 'rock', 'אלקטרוני', 'electronic', 'היפ הופ', 'hip hop', 'מוזיקה', 'music', 'להקה', 'band'],

        // DJ
        'party': ['מסיבה', 'party', 'מסיבות', 'parties', 'דיג\'יי למסיבות', 'dj', 'די ג\'יי', 'דיג\'יי', 'מועדון', 'club'],

        // Decorator - expanded with more design terms
        'balloons': ['בלונים', 'balloons', 'בלון', 'balloon', 'קשת בלונים', 'balloon arch', 'עיצוב', 'design', 'קישוט', 'decoration', 'אירוע', 'event', 'מסיבה', 'party'],
        'lighting': ['תאורה', 'lighting', 'תאורת אירועים', 'event lighting', 'לד', 'led', 'הארה', 'illumination', 'עיצוב', 'design', 'קישוט', 'decoration', 'אור', 'light', 'אורות', 'lights'],
        'backdrops': ['רקע', 'backdrop', 'רקעים', 'backdrops', 'רקע לצילום', 'photo backdrop', 'קיר צילום', 'עיצוב', 'design', 'קישוט', 'decoration', 'אירוע', 'event', 'הפקה', 'production', 'סטודיו', 'studio', 'צילום', 'photo', 'פוטו', 'קיר', 'wall', 'דקורציה', 'decor'],

        // Makeup
        'with-hairstyling': ['איפור ושיער', 'makeup and hair', 'שיער ואיפור', 'תסרוקת', 'hairstyling', 'עיצוב שיער', 'איפור', 'makeup', 'beauty', 'יופי', 'מעצבת', 'stylist', 'סלון', 'salon'],

        // Transport - expanded with more vehicle terms
        'luxury-cars': ['רכב יוקרה', 'luxury car', 'מכונית יוקרה', 'luxury vehicle', 'רכב מפואר', 'פרימיום', 'premium', 'מרצדס', 'mercedes', 'bmw', 'אאודי', 'audi', 'לקסוס', 'lexus'],
        'buses': ['אוטובוס', 'bus', 'הסעות', 'transportation', 'מיניבוס', 'minibus', 'הסעה', 'transport', 'נוסעים', 'passengers'],
        'limousines': ['לימוזין', 'limousine', 'לימו', 'limo', 'stretch limo', 'הסעות', 'transportation', 'יוקרה', 'luxury', 'stretch'],
        'classic-cars': ['רכב קלאסי', 'classic car', 'וינטג\'', 'vintage', 'רטרו', 'retro', 'רכב עתיק', 'antique car', 'קלאסי', 'classic', 'ישן', 'old', 'היסטורי', 'historic', 'אספנות', 'collector', 'מכונית קלאסית', 'אוטו', 'auto']
      };

      const hasMatchingFilter = filters.specificFilters.some(filter => {
        const keywords = filterKeywords[filter];
        if (keywords) {
          return keywords.some(keyword => vendorText.includes(keyword));
        }
        return vendorText.includes(filter);
      });

      if (!hasMatchingFilter) return false;
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

// Process and filter vendors with duplicate removal
const processAndFilterVendors = (results, filters, existingIds = null) => {
  let vendors = processVendorsWithPhotos(results);
  vendors = applyServerFilters(vendors, filters);
  
  if (existingIds && existingIds.size > 0) {
    vendors = vendors.filter(v => !existingIds.has(v.place_id));
  }
  
  return vendors;
};

// Remove duplicate vendors based on place_id
const removeDuplicates = (vendors) => {
  const uniqueVendors = [];
  const seenIds = new Set();
  
  vendors.forEach(vendor => {
    if (!seenIds.has(vendor.place_id)) {
      seenIds.add(vendor.place_id);
      uniqueVendors.push(vendor);
    }
  });
  
  return uniqueVendors;
};

// Fetch more results using pagination
const fetchMoreResults = async (
  currentPageToken,
  filteredResults,
  filters,
  TARGET,
  apiCallCount,
  MAX_API_CALLS
) => {
  let hasMore = true;
  let token = currentPageToken;
  let count = apiCallCount;
  
  while (filteredResults.length < TARGET && 
         token && 
         hasMore && 
         count < MAX_API_CALLS) {
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const result = await googleVendorService.getNextPage(token);
    count++;
    
    const existingIds = new Set(filteredResults.map(v => v.place_id));
    const newVendors = processAndFilterVendors(result.results, filters, existingIds);
    
    filteredResults.push(...newVendors);
    token = result.nextPageToken;
    hasMore = result.hasMore;
    
    if (!token || !hasMore) break;
  }
  
  return { 
    filteredResults, 
    nextPageToken: token, 
    hasMore, 
    apiCallCount: count 
  };
};

// Search with alternative query
const searchWithAlternativeQuery = async (
  vendorType,
  query,
  filters,
  area,
  pageNum,
  language
) => {
  const location = googleVendorService.getLocationForArea(area);
  const alternativeQuery = googleVendorService.buildAlternativeSearchQuery(
    vendorType, query, filters, pageNum
  );
  
  return await googleVendorService.textSearch(
    alternativeQuery, location, location.radius, language
  );
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

    // Check cache
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

    // ========== CASE 1: No filters - browse all categories ==========
    if (vendorType === 'all' && !query && !hasFilters) {
      const location = googleVendorService.getLocationForArea(area);
      
      const allCategories = [
        'catering service kosher food Israel',
        'photographer photography wedding Israel',
        'florist flowers wedding Israel',
        'musician band entertainment Israel',
        'dj sound system entertainment Israel',
        'event planner decorator design Israel',
        'makeup artist beauty bridal Israel',
        'transportation rental wedding Israel'
      ];
      
      // Rotate through categories based on page number
      const startIndex = ((pageNum - 1) * 4) % allCategories.length;
      const categoriesToSearch = [];
      for (let i = 0; i < 4; i++) {
        categoriesToSearch.push(allCategories[(startIndex + i) % allCategories.length]);
      }
      
      // Search all categories in parallel
      const searchPromises = categoriesToSearch.map(categoryQuery => 
        googleVendorService.textSearch(categoryQuery, location, location.radius, language)
      );
      
      const results = await Promise.all(searchPromises);
      
      // Combine all results
      let allVendors = [];
      results.forEach(result => {
        if (result.results && result.results.length > 0) {
          const vendors = result.results.slice(0, 5);
          allVendors.push(...vendors);
        }
      });
      
      // Process and remove duplicates
      const processedVendors = processAndFilterVendors(allVendors, filters);
      filteredResults = removeDuplicates(processedVendors);
      hasMore = true;
    } 
    
    // ========== CASE 2: First page with filters ==========
    else if (pageNum === 1) {
      const searchQuery = googleVendorService.buildSearchQuery(vendorType, query, filters);
      const location = googleVendorService.getLocationForArea(area);

      // Initial search
      let result = await googleVendorService.textSearch(
        searchQuery, location, location.radius, language
      );
      apiCallCount++;

      filteredResults = processAndFilterVendors(result.results, filters);
      currentPageToken = result.nextPageToken;
      hasMore = result.hasMore;

      // Fetch more if needed
      if (filteredResults.length < TARGET && currentPageToken && hasMore && apiCallCount < MAX_API_CALLS) {
        const paginationResult = await fetchMoreResults(
          currentPageToken,
          filteredResults,
          filters,
          TARGET,
          apiCallCount,
          MAX_API_CALLS
        );
        
        filteredResults = paginationResult.filteredResults;
        currentPageToken = paginationResult.nextPageToken;
        hasMore = paginationResult.hasMore;
        apiCallCount = paginationResult.apiCallCount;
      }
      
      // Try alternative query if still not enough results
      if (filteredResults.length < TARGET && apiCallCount < MAX_API_CALLS) {
        result = await searchWithAlternativeQuery(
          vendorType, query, filters, area, pageNum, language
        );
        apiCallCount++;
        
        const existingIds = new Set(filteredResults.map(v => v.place_id));
        const newVendors = processAndFilterVendors(result.results, filters, existingIds);
        filteredResults.push(...newVendors);
        
        if (result.nextPageToken && !currentPageToken) {
          currentPageToken = result.nextPageToken;
          hasMore = result.hasMore;
        }
      }
    } 
    
    // ========== CASE 3: Subsequent pages ==========
    else {
      const tokenKey = vendorCacheManager.generateKey(query, filters, `token_page${pageNum - 1}`);
      currentPageToken = vendorCacheManager.get(tokenKey);
      
      // No cached token - use alternative query
      if (!currentPageToken) {
        const result = await searchWithAlternativeQuery(
          vendorType, query, filters, area, pageNum, language
        );
        apiCallCount++;
        
        filteredResults = processAndFilterVendors(result.results, filters);
        currentPageToken = result.nextPageToken;
        hasMore = result.hasMore;
      } 
      // Has cached token - fetch more results
      else {
        const paginationResult = await fetchMoreResults(
          currentPageToken,
          filteredResults,
          filters,
          TARGET,
          apiCallCount,
          MAX_API_CALLS
        );
        
        filteredResults = paginationResult.filteredResults;
        currentPageToken = paginationResult.nextPageToken;
        hasMore = paginationResult.hasMore;
        apiCallCount = paginationResult.apiCallCount;
      }
      
      // Try alternative query if still not enough results
      if (filteredResults.length < TARGET && apiCallCount < MAX_API_CALLS) {
        const result = await searchWithAlternativeQuery(
          vendorType, query, filters, area, pageNum + 1, language
        );
        apiCallCount++;
        
        const existingIds = new Set(filteredResults.map(v => v.place_id));
        const newVendors = processAndFilterVendors(result.results, filters, existingIds);
        filteredResults.push(...newVendors);
        
        if (result.nextPageToken) {
          currentPageToken = result.nextPageToken;
          hasMore = result.hasMore;
        }
      }
    }

    // Cache the next page token
    if (currentPageToken) {
      const tokenKey = vendorCacheManager.generateKey(query, filters, `token_page${pageNum}`);
      vendorCacheManager.set(tokenKey, currentPageToken);
    }

    // Prepare response
    const response = {
      results: filteredResults.slice(0, 20),
      hasMore: (vendorType === 'all' && !query && !hasFilters) 
        ? true 
        : (filteredResults.length > 20 || (hasMore && !!currentPageToken)),
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

// Fetches detailed vendor information from Google Places API by placeId and processes photos
const getVendorDetailsByPlaceId = async (req, res) => {
  try {
    const { placeId } = req.params;
    const { language = 'he' } = req.query;

    if (!placeId) {
      return res.status(400).json({ 
        error: 'Missing placeId parameter',
        message: 'placeId is required' 
      });
    }

    const placeDetails = await googleVendorService.getPlaceDetails(placeId, language);

    if (!placeDetails) {
      return res.status(404).json({ 
        error: 'Vendor not found',
        message: 'No details found for this placeId' 
      });
    }

    let processedVendor = processVendorsWithPhotos([placeDetails])[0];

    res.json(processedVendor);

  } catch (error) {
    console.error('❌ Error fetching vendor details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch vendor details',
      message: error.message 
    });
  }
};

module.exports = {
  getEventVendors,
  addVendor,
  updateVendor,
  deleteVendor,
  searchVendors,
  getCacheStats,
  getVendorDetailsByPlaceId  
};