const axios = require('axios');

class GoogleVendorService {
  constructor() {
    this.apiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.baseUrl = 'https://maps.googleapis.com/maps/api/place';
    
  }

  // Builds a search query string based on vendor type, search term, and filters
  buildSearchQuery(vendorType, searchTerm = '', filters = {}) {
    if (searchTerm && searchTerm.trim() !== '') {
        return searchTerm;
    }

    if (!vendorType || vendorType === 'all') {
        return 'event services wedding party vendors Israel';
    }

    const queryMap = {
        catering: 'catering service kosher food Israel',
        photographer: 'photographer photography wedding Israel',
        florist: 'florist flowers wedding Israel',
        musician: 'musician band entertainment Israel',
        dj: 'dj sound system entertainment Israel',
        decorator: 'event planner decorator design Israel',
        makeup: 'makeup artist beauty bridal Israel',
        transport: 'transportation rental wedding Israel'
    };

    let query = queryMap[vendorType] || 'event services Israel';

    if (vendorType === 'catering' && filters.kashrutLevel && filters.kashrutLevel !== 'all') {
        const kashrutMap = {
        'mehadrin': ' mehadrin',
        'regular-kosher': ' kosher',
        'rabbinate': ' rabbinate',
        'badatz': ' badatz',
        'non-kosher': ''
        };
        query += kashrutMap[filters.kashrutLevel] || '';
    }

    // Add specific filter keywords to search query
    if (filters.specificFilters && filters.specificFilters.length > 0) {
        const filterQueryMap = {
            // Catering
            'pareve': 'pareve fish sushi seafood',
            'gluten-free': 'gluten free celiac',
            'dairy': 'dairy milk cheese',
            'meat': 'meat grill steak',
            'vegan': 'vegan plant based',
            'vegetarian': 'vegetarian salad vegetables',
            // Florist
            'bridal': 'bridal bouquet wedding',
            'arrangements': 'flower arrangements floral design',
            'plants': 'plants houseplants pots',
            // Musician
            'classical': 'classical violin piano orchestra chamber music',
            'modern': 'modern pop rock band',
            'solo': 'solo singer musician',
            'band': 'band orchestra ensemble',
            // Decorator
            'backdrops': 'backdrop photo wall design studio',
            'balloons': 'balloons balloon arch',
            'lighting': 'lighting led event lights',
            // Transport
            'classic-cars': 'classic car vintage retro antique',
            'luxury-cars': 'luxury car premium',
            'limousines': 'limousine limo stretch',
            'buses': 'bus minibus transportation',
            // Photographer
            'wedding': 'wedding photography',
            'event': 'event photography party',
            'portrait': 'portrait studio photography',
            'commercial': 'commercial advertising product',
            // Makeup
            'with-hairstyling': 'makeup hair styling'
        };

        filters.specificFilters.forEach(filter => {
            if (filterQueryMap[filter]) {
                query += ' ' + filterQueryMap[filter];
            }
        });
    }

    return query;
    }

  // Returns location coordinates and search radius for a given area
  getLocationForArea(area) {
    const locations = {
        'ירושלים': { lat: 31.7683, lng: 35.2137, radius: 30000 }, 
        'מרכז': { lat: 32.0853, lng: 34.7818, radius: 25000 },   
        'דרום': { lat: 31.2518, lng: 34.7915, radius: 50000 },    
        'צפון': { lat: 32.7940, lng: 35.0423, radius: 50000 }    
    };
    
    if (area === 'all') {
      return { lat: 31.5, lng: 34.75, radius: 50000 };
    }
    
    return locations[area] || { lat: 31.5, lng: 34.75, radius: 50000 };
  }

  // Performs a text search using Google Places API with query, location, and radius parameters
  async textSearch(query, location, radius, language = 'he') {
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
        params: params,
        timeout: 15000
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        return { results: [], nextPageToken: null, hasMore: false };
      }

      const results = response.data.results || [];
      const nextPageToken = response.data.next_page_token || null;

      return {
        results: results,
        nextPageToken: nextPageToken,
        hasMore: !!nextPageToken
      };

    } catch (error) {
      return { results: [], nextPageToken: null, hasMore: false };
    }
  }

  // Fetches the next page of search results using a page token
  async getNextPage(pageToken) {
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await axios.get(`${this.baseUrl}/textsearch/json`, {
        params: {
          pagetoken: pageToken,
          key: this.apiKey
        },
        timeout: 15000
      });

      if (response.data.status !== 'OK' && response.data.status !== 'ZERO_RESULTS') {
        return { results: [], nextPageToken: null, hasMore: false };
      }

      const results = response.data.results || [];
      const nextPageToken = response.data.next_page_token || null;

      return {
        results: results,
        nextPageToken: nextPageToken,
        hasMore: !!nextPageToken
      };

    } catch (error) {
      return { results: [], nextPageToken: null, hasMore: false };
    }
  }

  // Retrieves detailed information for a specific place using its place_id
  async getPlaceDetails(placeId, language = 'he') {
    try {
      const response = await axios.get(`${this.baseUrl}/details/json`, {
        params: {
          place_id: placeId,
          fields: 'name,formatted_address,formatted_phone_number,website,photos,rating,reviews,opening_hours,price_level,user_ratings_total,geometry,vicinity,url,types',
          language: language,
          key: this.apiKey
        }
      });

      if (response.data.status !== 'OK') {
        throw new Error(`Google Places API error: ${response.data.status}`);
      }

      return response.data.result;

    } catch (error) {
      throw error;
    }
  }

  // Generates a Google Places photo URL from a photo reference with specified dimensions
  getPhotoUrl(photoReference, maxWidth = 400, maxHeight = 300) {
  if (!photoReference) {
    return null;
  }

  if (!this.apiKey) {
    return null;
  }

  const url = `${this.baseUrl}/photo?maxwidth=${maxWidth}&maxheight=${maxHeight}&photoreference=${photoReference}&key=${this.apiKey}`;

  return url;
}


  // Builds alternative search queries for diversity, cycling through different query variations based on page number
  buildAlternativeSearchQuery(vendorType, searchTerm = '', filters = {}, page = 1) {
    if (searchTerm && searchTerm.trim() !== '') {
        return searchTerm;
    }
    
    const alternativeQueries = [
        'wedding vendors Israel services',
        'event planning Israel party services',
        'Israeli event suppliers wedding',
        'celebration services Israel vendors',
        'wedding party suppliers Israel'
    ];
    
    const vendorSpecificQueries = {
        catering: [
        'Israeli catering kosher food wedding events',
        'event catering services Israel',
        'wedding food catering Israel'
        ],
        photographer: [
        'wedding photographer Israel event photography',
        'Israeli photography services events',
        'event photographer Israel professional'
        ],
        florist: [
        'wedding florist Israel flowers arrangements',
        'Israeli flower shop wedding events',
        'event florist Israel decorations'
        ],
        musician: [
        'live music band Israel wedding entertainment',
        'Israeli musicians wedding events',
        'wedding entertainment Israel music'
        ],
        dj: [
        'wedding DJ Israel party music',
        'Israeli DJ services events',
        'event DJ Israel entertainment'
        ],
        decorator: [
        'event decoration Israel wedding design',
        'Israeli event design services',
        'wedding decorator Israel planning'
        ],
        makeup: [
        'bridal makeup Israel beauty artist',
        'Israeli makeup artist wedding',
        'wedding beauty services Israel'
        ],
        transport: [
        'luxury car rental Israel wedding transportation',
        'Israeli wedding transportation services',
        'event transportation Israel cars'
        ]
    };
    
    let queries = alternativeQueries;
    if (vendorType && vendorType !== 'all' && vendorSpecificQueries[vendorType]) {
        queries = vendorSpecificQueries[vendorType];
    }
    
    const queryIndex = (page - 1) % queries.length;
    let query = queries[queryIndex];
    
    if (filters.area && filters.area !== 'all') {
        const areaNames = {
        'ירושלים': 'Jerusalem',
        'מרכז': 'Tel Aviv center',
        'דרום': 'south Israel',
        'צפון': 'north Israel Galilee'
        };
        query += ' ' + (areaNames[filters.area] || '');
    }
    
    return query;
    }

}


const googleVendorService = new GoogleVendorService();

module.exports = googleVendorService;