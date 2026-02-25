/**
 * venueService.js - Venue API Service
 *
 * Client-side service for searching event venues via Google Places API
 * and managing event venues.
 *
 * Search Methods:
 * - searchVenues(filters, searchQuery, page, language): Search venues
 * - getVenueDetails(placeId, language): Get detailed venue info
 *
 * Event Venue CRUD:
 * - getEventVenue(eventId): Get venue for an event
 * - setEventVenue(eventId, venueData): Set/update venue for event
 * - deleteEventVenue(eventId): Remove venue from event
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/venues`
  : 'http://localhost:5000/api/venues';

const EVENTS_API_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api/events`
  : 'http://localhost:5000/api/events';

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
      throw new Error('Failed to load venue details');
    }
  }

  async clearCache() {
    try {
      await axios.delete(`${API_BASE_URL}/cache`);
      return true;
    } catch (error) {
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

  // Gets venue saved to an event
  async getEventVenue(eventId) {
    const token = localStorage.getItem('token');
    const response = await axios.get(`${EVENTS_API_URL}/${eventId}/venue`, {
      headers: { 'x-auth-token': token },
      timeout: 15000
    });
    return response.data;
  }

  // Sets or updates venue for an event
  async setEventVenue(eventId, venueData) {
    const token = localStorage.getItem('token');
    const response = await axios.post(`${EVENTS_API_URL}/${eventId}/venue`, venueData, {
      headers: {
        'Content-Type': 'application/json',
        'x-auth-token': token
      },
      timeout: 15000
    });
    return response.data;
  }

  // Removes venue from an event
  async deleteEventVenue(eventId) {
    const token = localStorage.getItem('token');
    const response = await axios.delete(`${EVENTS_API_URL}/${eventId}/venue`, {
      headers: { 'x-auth-token': token },
      timeout: 15000
    });
    return response.data;
  }
}

const venueService = new VenueService();

export default venueService;

