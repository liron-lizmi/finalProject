/**
 * api.js - API Configuration and Utilities
 *
 * Provides base API URL configuration and fetch wrapper for the application.
 *
 * Exports:
 * - API_URL: Base URL from REACT_APP_API_URL env var or localhost:5000
 * - apiFetch(endpoint, options): Wrapper for fetch that prepends API_URL
 *   - If endpoint starts with 'http', uses it directly
 *   - Otherwise prepends API_URL to endpoint
 */

export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, options);
};
