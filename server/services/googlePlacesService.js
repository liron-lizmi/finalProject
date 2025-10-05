// server/services/googlePlacesService.js
const axios = require('axios');
const i18next = require('i18next');

class GooglePlacesService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    
    if (!this.apiKey) {
      console.error('Missing Google Maps API key!');
    }
  }

  buildSearchQuery(venueType, area, searchTerm = '', language = 'en') {
    let query = '';
    
    // If there is a free search - we will use it.
    if (searchTerm && searchTerm.trim() !== '') {
        return searchTerm;
    }
    
    // If there is no free search - a broader search
    if (venueType === 'all' || !venueType) {
        // General search - very broad
        query = language === 'he' ? 
        'אירועים ישראל' : 
        'events venues Israel';
    } else {
        // Specific search by type - still broad
        const queryMap = {
        restaurant: language === 'he' ? 'מסעדות ישראל' : 'restaurants Israel',
        event_venue: language === 'he' ? 'אולמות אירועים ישראל' : 'event venues Israel',
        banquet_hall: language === 'he' ? 'אולמות כנסים ישראל' : 'banquet halls Israel',
        hotel: language === 'he' ? 'מלונות ישראל' : 'hotels Israel',
        park: language === 'he' ? 'גנים ופארקים ישראל' : 'parks gardens Israel',
        museum: language === 'he' ? 'מוזיאונים ישראל' : 'museums Israel'
        };
        
        query = queryMap[venueType] || (language === 'he' ? 'מקומות אירועים' : 'event spaces');
    }
    
    return query;
    }

  getLocationForArea(area) {
    const locations = {
      jerusalem: { lat: 31.7683, lng: 35.2137, radius: 30000 },
      center: { lat: 32.0853, lng: 34.7818, radius: 25000 },
      south: { lat: 31.2518, lng: 34.7915, radius: 50000 },
      north: { lat: 32.7940, lng: 35.0423, radius: 50000 }
    };
    
    if (area === 'all') {
      return { lat: 31.5, lng: 34.75, radius: 50000 };
    }
    
    return locations[area] || { lat: 31.5, lng: 34.75, radius: 50000 };
  }

  async textSearch(query, location, radius, language = 'en', venueType = 'all') {
  try {
    const params = {
      query: query,
      location: `${location.lat},${location.lng}`,
      radius: radius,
      language: language,
      region: 'IL',
      key: this.apiKey
    };
    
    const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
      params: params
    });

    if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
      console.error(`Google API Error: ${response.data.status}`);
      throw new Error(`Google Places API error: ${response.data.status}`);
    }

    const results = response.data.results || [];
    const nextPageToken = response.data.next_page_token || null;

    return {
      results: results,
      nextPageToken: nextPageToken,
      hasMore: !!nextPageToken
    };

  } catch (error) {
    console.error('Error calling Google Places API:', error.message);
    throw error;
  }
}

  async getNextPage(pageToken) {
    try {
      
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
        params: {
          pagetoken: pageToken,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      const results = response.data.results || [];
      const nextPageToken = response.data.next_page_token || null;

      return {
        results: results,
        nextPageToken: nextPageToken,
        hasMore: !!nextPageToken
      };

    } catch (error) {
      console.error('  Error fetching next page:', error.message);
      throw error;
    }
  }

  async getPlaceDetails(placeId, language = 'en') {
    try {

      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,website,photos,rating,reviews,opening_hours,price_level,user_ratings_total,geometry,vicinity,url',
          language: language,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.result;

    } catch (error) {
      console.error('  Error fetching place details:', error.message);
      throw error;
    }
  }

  // Returns a URL to a place image
  getPhotoUrl(photoReference, maxWidth = 400, maxHeight = 300) {
    if (!photoReference) return null;
    
    return `${this.baseUrl}/photo?maxwidth=${maxWidth}&maxheight=${maxHeight}&photoreference=${photoReference}&key=${this.apiKey}`;
  }
}

const googlePlacesService = new GooglePlacesService();

module.exports = googlePlacesService;

