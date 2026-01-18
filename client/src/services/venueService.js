// client/src/services/venueService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/venues`
  : 'http://localhost:5000/api/venues';

class VenueService {
  
  async searchVenues(filters = {}, searchQuery = '', page = 1, language = 'en') {
    try {

      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: {
            query: searchQuery,
            area: filters.area || 'all',
            venueType: filters.venueType || 'all',
            venueStyle: filters.venueStyle || 'all',
            parking: filters.amenities?.parking || false,
            accessibility: filters.amenities?.accessibility || false,
            outdoorSpace: filters.amenities?.outdoorSpace || false,
            catering: filters.amenities?.catering || false,
            page: page,
            language: language
        },
        timeout: 30000 
      });
      
      return {
        venues: response.data.results || [],
        hasMore: response.data.hasMore || false,
        currentPage: response.data.currentPage || page,
        totalResults: response.data.totalResults || 0
      };

    } catch (error) {
      console.error('  Error searching venues:', error);
      
      if (error.response) {
        throw new Error(error.response.data.message || 'Failed to search venues');
      } else if (error.request) {
        throw new Error('Server not responding. Please try again.');
      } else {
        throw new Error('Failed to search venues');
      }
    }
  }

  async getVenueDetails(placeId, language = 'en') {
    try {

      const response = await axios.get(`${API_BASE_URL}/details/${placeId}`, {
        params: { language },
        timeout: 15000
      });

      return response.data;

    } catch (error) {
      console.error('  Error fetching venue details:', error);
      throw new Error('Failed to load venue details');
    }
  }

  async getCacheStats() {
    try {
      const response = await axios.get(`${API_BASE_URL}/cache/stats`);
      return response.data;
    } catch (error) {
      console.error('  Error fetching cache stats:', error);
      return null;
    }
  }

  async clearCache() {
    try {
      await axios.delete(`${API_BASE_URL}/cache`);
      return true;
    } catch (error) {
      console.error('  Error clearing cache:', error);
      return false;
    }
  }


  getPhotoUrl(photo) {
    if (!photo || !photo.photo_reference) return null;
    
    if (typeof photo === 'string' && photo.startsWith('http')) {
      return photo;
    }
    
    const photoReference = photo.photo_reference || photo;
    const maxWidth = 400;
    const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
    
    return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${apiKey}`;
  }
}

const venueService = new VenueService();

export default venueService;

