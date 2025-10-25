// server/controllers/venueController.js
const googlePlacesService = require('../services/googlePlacesService');
const CacheManager = require('../services/CacheManager');

const getVenueStyle = (venue, language = 'en') => {
  const venueText = (
    venue.name + ' ' + 
    (venue.vicinity || '') + ' ' + 
    (venue.formatted_address || '') + ' ' + 
    (venue.types ? venue.types.join(' ') : '')
  ).toLowerCase();
  
  const styleKeywords = {
    modern: language === 'he' ? 
      ['מודרני', 'עכשווי', 'חדש'] : 
      ['modern', 'contemporary', 'new'],
    classic: language === 'he' ? 
      ['קלאסי', 'מסורתי', 'עתיק'] : 
      ['classic', 'traditional', 'antique', 'historic'],
    luxury: language === 'he' ? 
      ['יוקרתי', 'מפואר', 'יוקרה'] : 
      ['luxury', 'luxurious', 'upscale', 'premium'],
    urban: language === 'he' ? 
      ['עירוני', 'חוץ', 'גן'] : 
      ['urban', 'outdoor', 'garden']
  };
  
  const styles = [];
  
  Object.keys(styleKeywords).forEach(style => {
    const keywords = styleKeywords[style];
    const hasStyleKeyword = keywords.some(keyword => 
      venueText.includes(keyword.toLowerCase())
    );
    
    if (hasStyleKeyword) {
      styles.push(style);
    }
  });
  
  if (venue.price_level >= 3 || venue.rating >= 4.5) {
    if (!styles.includes('luxury')) styles.push('luxury');
  }
  
  const hotelKeywords = language === 'he' ? ['מלון'] : ['hotel'];
  if (hotelKeywords.some(kw => venueText.includes(kw.toLowerCase()))) {
    if (!styles.includes('modern')) styles.push('modern');
    if (!styles.includes('luxury')) styles.push('luxury');
  }
  
  const museumKeywords = language === 'he' ? ['מוזיאון'] : ['museum'];
  if (museumKeywords.some(kw => venueText.includes(kw.toLowerCase()))) {
    if (!styles.includes('classic')) styles.push('classic');
  }
  
  const parkKeywords = language === 'he' ? ['גן', 'פארק'] : ['park', 'garden'];
  if (parkKeywords.some(kw => venueText.includes(kw.toLowerCase())) || 
      venue.types?.some(type => type.includes('park') || type.includes('garden'))) {
    if (!styles.includes('urban')) styles.push('urban');
  }
  
  return styles.length > 0 ? styles : ['modern'];
};

const applyServerFilters = (venues, filters, language = 'en') => {
  return venues.filter(venue => {
    const venueText = (
      venue.name + ' ' + 
      (venue.vicinity || '') + ' ' + 
      (venue.formatted_address || '') + ' ' + 
      (venue.types ? venue.types.join(' ') : '')
    ).toLowerCase();

    if (filters.area && filters.area !== 'all') {
      if (!venue.geometry || !venue.geometry.location) return false;
      
      const venueLat = venue.geometry.location.lat;
      const venueLng = venue.geometry.location.lng;
      
      const areaLocations = {
        jerusalem: { lat: 31.7683, lng: 35.2137, radius: 30000 },
        center: { lat: 32.0853, lng: 34.7818, radius: 25000 },
        south: { lat: 31.2518, lng: 34.7915, radius: 50000 },
        north: { lat: 32.7940, lng: 35.0423, radius: 50000 }
      };
      
      const areaData = areaLocations[filters.area];
      if (areaData) {
        const R = 6371000;
        const dLat = (areaData.lat - venueLat) * Math.PI / 180;
        const dLng = (areaData.lng - venueLng) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(venueLat * Math.PI / 180) * Math.cos(areaData.lat * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distance = R * c;
        
        if (distance > areaData.radius) return false;
      }
    }

    if (filters.venueType && filters.venueType !== 'all') {
      const typeKeywords = {
        restaurant: language === 'he' ? 
          ['מסעדה', 'מסעדת', 'בית קפה', 'קפה'] : 
          ['restaurant', 'cafe', 'food', 'dining'],
        hotel: language === 'he' ? 
          ['מלון', 'בית מלון', 'אכסניה'] : 
          ['hotel', 'resort', 'lodge', 'inn'],
        event_venue: language === 'he' ? 
          ['אולם', 'אירוע', 'אירועים', 'hall'] : 
          ['event', 'hall', 'venue'],
        banquet_hall: language === 'he' ? 
          ['כנסים', 'ועידות', 'conference'] : 
          ['banquet', 'conference', 'convention'],
        park: language === 'he' ? 
          ['גן', 'פארק', 'גינה'] : 
          ['park', 'garden', 'outdoor'],
        museum: language === 'he' ? 
          ['מוזיאון', 'גלריה'] : 
          ['museum', 'gallery']
      };
      
      const keywords = typeKeywords[filters.venueType] || [];
      const matchesType = keywords.some(kw => venueText.includes(kw.toLowerCase())) ||
                         venue.types?.includes(filters.venueType);
      
      if (!matchesType) return false;
    }

    if (filters.capacity && filters.capacity !== '') {
      const capacityLimit = parseInt(filters.capacity);
      let estimatedCapacity = venue.user_ratings_total ? 
        Math.max(venue.user_ratings_total * 1.5, 30) : 30;
      
      const hotelKeywords = language === 'he' ? ['מלון'] : ['hotel'];
      const centerKeywords = language === 'he' ? ['מרכז'] : ['center'];
      
      if (hotelKeywords.some(kw => venueText.includes(kw)) || 
          centerKeywords.some(kw => venueText.includes(kw))) {
        estimatedCapacity *= 2;
      }
      
      if (estimatedCapacity < capacityLimit) return false;
    }

    if (filters.venueStyle && filters.venueStyle !== 'all') {
      const venueStyles = getVenueStyle(venue, language);
      if (!venueStyles.includes(filters.venueStyle)) {
        return false;
      }
    }

    if (filters.parking === 'true' || filters.parking === true) {
      const parkingKeywords = language === 'he' ? 
        ['חניה', 'parking'] : ['parking'];
      const hasParking = parkingKeywords.some(kw => venueText.includes(kw)) ||
                        venue.price_level >= 3;
      if (!hasParking) return false;
    }

    if (filters.accessibility === 'true' || filters.accessibility === true) {
      const hasAccessibility = venue.price_level >= 2;
      if (!hasAccessibility) return false;
    }

    if (filters.outdoorSpace === 'true' || filters.outdoorSpace === true) {
      const outdoorKeywords = language === 'he' ? 
        ['חוץ', 'גן', 'פארק'] : ['outdoor', 'garden', 'park'];
      const hasOutdoor = outdoorKeywords.some(kw => venueText.includes(kw)) ||
                        venue.types?.some(t => t.includes('park') || t.includes('garden'));
      if (!hasOutdoor) return false;
    }

    if (filters.catering === 'true' || filters.catering === true) {
      const hasCatering = venue.types?.some(t => 
        t.includes('restaurant') || t.includes('food')
      );
      if (!hasCatering) return false;
    }

    if (filters.accommodation === 'true' || filters.accommodation === true) {
      const hasAccommodation = venue.types?.includes('lodging') || 
                              venue.types?.includes('hotel') ||
                              venue.price_level >= 3;
      if (!hasAccommodation) return false;
    }

    return true;
  });
};

const processVenuesWithPhotos = (venues) => {
  return venues.map(venue => {
    if (venue.photos && venue.photos.length > 0) {
      venue.photos = venue.photos
        .map(photo => {
          if (typeof photo === 'string' && photo.startsWith('http')) {
            return { url: photo };
          }
          
          if (photo.photo_reference) {
            const url = googlePlacesService.getPhotoUrl(photo.photo_reference, 400, 300);
            if (url) {
              return {
                photo_reference: photo.photo_reference,
                url: url
              };
            }
          }
          
          return null;
        })
        .filter(Boolean); 
    }
    
    if (!venue.photos || venue.photos.length === 0) {
      venue.photos = [];
    }
    
    return venue;
  });
};

const searchVenues = async (req, res) => {
  try {
    const { 
      query = '', 
      area = 'all', 
      venueType = 'all',
      venueStyle = 'all',
      capacity = '',
      parking = false,
      accessibility = false,
      outdoorSpace = false,
      catering = false,
      accommodation = false,
      page = 1,
      language = 'en'
    } = req.query;

    const pageNum = parseInt(page);
    const filters = { 
      area, 
      venueType, 
      venueStyle, 
      capacity,
      parking,
      accessibility,
      outdoorSpace,
      catering,
      accommodation
    };

    const hasFilters = area !== 'all' || 
                      venueType !== 'all' || 
                      venueStyle !== 'all' ||
                      capacity !== '' ||
                      parking === 'true' ||
                      accessibility === 'true' ||
                      outdoorSpace === 'true' ||
                      catering === 'true' ||
                      accommodation === 'true';

    const cacheKey = CacheManager.generateKey(query, filters, pageNum);
    const cachedData = CacheManager.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    let filteredResults = [];
    let googlePage = pageNum;
    let hasMore = true;
    const TARGET = 20;

    while (filteredResults.length < TARGET && hasMore && googlePage <= pageNum + 2) {
      let result;
      
      if (googlePage === 1) {
        const searchQuery = googlePlacesService.buildSearchQuery(
          venueType, area, query, language
        );
        const location = googlePlacesService.getLocationForArea(area);
        
        result = await googlePlacesService.textSearch(
          searchQuery, location, location.radius, language, venueType
        );
      } else {
        const tokenKey = CacheManager.generateKey(query, filters, `token_page${googlePage - 1}`);
        const pageToken = CacheManager.get(tokenKey);
        
        if (!pageToken) break;
        
        result = await googlePlacesService.getNextPage(pageToken);
      }

      let newVenues = processVenuesWithPhotos(result.results);
      
      if (hasFilters) {
        newVenues = applyServerFilters(newVenues, filters, language);
      }
      
      filteredResults = [...filteredResults, ...newVenues];
      hasMore = result.hasMore;
      
      if (result.nextPageToken) {
        const tokenKey = CacheManager.generateKey(query, filters, `token_page${googlePage}`);
        CacheManager.set(tokenKey, result.nextPageToken);
      }
      
      googlePage++;
    }

    const response = {
      results: filteredResults.slice(0, 20),
      hasMore: filteredResults.length > 20 || hasMore,
      currentPage: pageNum,
      totalResults: 20
    };

    CacheManager.set(cacheKey, response);
    return res.json(response);

  } catch (error) {
    console.error('Error in search route:', error);
    res.status(500).json({ 
      error: 'Failed to search venues',
      message: error.message 
    });
  }
};

const getVenueDetails = async (req, res) => {
  try {
    const { placeId } = req.params;
    const { language = 'en' } = req.query;

    const cacheKey = `details_${placeId}_${language}`;
    const cachedData = CacheManager.get(cacheKey);
    
    if (cachedData) {
      return res.json(cachedData);
    }

    const details = await googlePlacesService.getPlaceDetails(placeId, language);

    if (details.photos && details.photos.length > 0) {
      details.photos = details.photos.map(photo => {
        if (typeof photo === 'string') {
          return photo;
        }
        return {
          photo_reference: photo.photo_reference,
          url: googlePlacesService.getPhotoUrl(photo.photo_reference, 600, 400)
        };
      });
    }

    CacheManager.set(cacheKey, details);
    return res.json(details);

  } catch (error) {
    console.error('Error in details route:', error);
    res.status(500).json({ 
      error: 'Failed to get venue details',
      message: error.message 
    });
  }
};

module.exports = {
  searchVenues,
  getVenueDetails
};