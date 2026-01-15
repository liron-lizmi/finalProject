export const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

export const apiFetch = async (endpoint, options = {}) => {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`;
  return fetch(url, options);
};
