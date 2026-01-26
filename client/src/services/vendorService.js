import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/vendors`
  : 'http://localhost:5000/api/vendors';

class VendorService {

   // Searches vendors with filters, query, pagination, and language preference
  async searchVendors(filters = {}, searchQuery = '', page = 1, language = 'he') {
    try {
      const response = await axios.get(`${API_BASE_URL}/search`, {
        params: {
          query: searchQuery,
          area: filters.area || 'all',
          vendorType: filters.vendorType || 'all',
          specificFilters: filters.specificFilters?.join(',') || '',
          kashrutLevel: filters.kashrutLevel || 'all',
          page: page,
          language: language
        },
        timeout: 30000 
      });

      return {
        vendors: response.data.results || [],
        hasMore: response.data.hasMore || false,
        currentPage: response.data.currentPage || page,
        totalResults: response.data.totalResults || 0
      };

    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.message || 'Failed to search vendors');
      } else if (error.request) {
        throw new Error('Server not responding. Please try again.');
      } else {
        throw new Error('Failed to search vendors');
      }
    }
  }

  // Fetches detailed information for a specific vendor using Google Place ID
  async getVendorDetails(placeId, language = 'he') {
    try {
      const response = await axios.get(`${API_BASE_URL}/details/${placeId}`, {
        params: { language },
        timeout: 15000
      });

      return response.data;
    } catch (error) {
      throw new Error('Failed to load vendor details');
    }
  }

  // Placeholder method for clearing filters cache
  clearFiltersCache(filters, searchQuery) {
    return Promise.resolve();
  }
}

const vendorService = new VendorService();

export default vendorService;