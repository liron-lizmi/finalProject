/**
 * vendorService.js - Vendor API Service
 *
 * Client-side service for searching vendors via Google Places API
 * and managing event vendors.
 *
 * Search Methods:
 * - searchVendors(filters, searchQuery, page, language): Search vendors
 * - getVendorDetails(placeId, language): Get detailed vendor info
 *
 * Event Vendor CRUD:
 * - getEventVendors(eventId): Get all vendors for an event
 * - addVendorToEvent(eventId, vendorData): Add vendor to event
 * - updateEventVendor(eventId, vendorId, vendorData): Update vendor
 * - deleteEventVendor(eventId, vendorId): Remove vendor from event
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/vendors`
  : 'http://localhost:5000/api/vendors';

const EVENTS_API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/events`
  : 'http://localhost:5000/api/events';

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

  // Gets all vendors saved to an event
  async getEventVendors(eventId) {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${EVENTS_API_URL}/${eventId}/vendors`, {
      headers: { 'x-auth-token': token },
      timeout: 15000
    });
    return response.data;
  }

  // Adds a vendor to an event
  async addVendorToEvent(eventId, vendorData) {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${EVENTS_API_URL}/${eventId}/vendors`, vendorData, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      timeout: 15000
    });
    return response.data;
  }

  // Updates a vendor in an event
  async updateEventVendor(eventId, vendorId, vendorData) {
    const token = localStorage.getItem('token');
    const response = await axios.put(`${EVENTS_API_URL}/${eventId}/vendors/${vendorId}`, vendorData, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      timeout: 15000
    });
    return response.data;
  }

  // Removes a vendor from an event
  async deleteEventVendor(eventId, vendorId) {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${EVENTS_API_URL}/${eventId}/vendors/${vendorId}`, {
      headers: { 'x-auth-token': token },
      timeout: 15000
    });
    return response.data;
  }

}

const vendorService = new VendorService();

export default vendorService;