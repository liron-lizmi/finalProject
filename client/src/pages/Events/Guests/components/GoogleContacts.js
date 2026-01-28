/**
 * GoogleContacts.js - Google Contacts API Integration
 *
 * Service class for importing contacts from Google Contacts.
 * Uses Google Identity Services for OAuth on the client side,
 * then fetches contacts through the server-side proxy.
 *
 * Methods:
 * - init(): Initialize Google Identity Services
 * - signIn(): Authenticate with Google
 * - signOut(): Disconnect from Google
 * - getContacts(eventId): Fetch user's contacts via server
 * - isConnected(): Check connection status
 *
 * Features:
 * - OAuth 2.0 authentication
 * - Server-side People API calls for security
 * - Format phone numbers for display
 *
 * Environment:
 * - REACT_APP_GOOGLE_CONTACTS_ID: Google OAuth client ID
 *
 * Scopes:
 * - https://www.googleapis.com/auth/contacts.readonly
 */
import axios from 'axios';

class GoogleContactsAPI {
  constructor() {
    this.isSignedIn = false;
    this.accessToken = null;
    this.initialized = false;
  }

  // Initialize Google Identity Services
  async init() {
    if (this.initialized) return true;

    try {

      if (!window.google) {
        await this.loadGoogleIdentityServices();
      }

      this.initialized = true;
      return true;
    } catch (error) {
        throw new Error('שגיאה באתחול Google: ' + error.message);
    }
  }

  // Loading Google Identity Services
  async loadGoogleIdentityServices() {
    return new Promise((resolve, reject) => {
      if (window.google) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;

      script.onload = () => {
        setTimeout(resolve, 500);
      };

      script.onerror = () => {
        reject(new Error('Failed to load Google Identity Services'));
      };

      document.head.appendChild(script);
    });
  }

  // Connecting to Google
  async signIn() {
    try {

      if (!process.env.REACT_APP_GOOGLE_CONTACTS_ID) {
        throw new Error('Google Client ID לא מוגדר במשתני הסביבה');
      }

      await this.init();

      // Using Google Identity Services OAuth
      const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: process.env.REACT_APP_GOOGLE_CONTACTS_ID,
          scope: 'https://www.googleapis.com/auth/contacts.readonly',
          callback: (response) => {
            if (response.error) {
              reject(new Error(response.error));
            } else {
              resolve(response);
            }
          },
        });

        tokenClient.requestAccessToken();
      });

      this.accessToken = tokenResponse.access_token;
      this.isSignedIn = true;

      return tokenResponse;

    } catch (error) {
        throw new Error('שגיאה בהתחברות לגוגל: ' + (error.message || 'Unknown error'));
    }
  }

  // Connection test
  async checkConnection() {
    return this.isSignedIn && this.accessToken;
  }

  // disconnection
  async signOut() {
    try {
      if (this.accessToken && window.google) {
        window.google.accounts.oauth2.revoke(this.accessToken);
      }
      this.isSignedIn = false;
      this.accessToken = null;
    } catch (error) {
        // Error signing out
    }
  }

  // Receiving contacts via server-side proxy
  async getContacts(eventId) {
    try {
      if (!this.isSignedIn || !this.accessToken) {
        throw new Error('לא מחובר לגוגל');
      }

      const response = await axios.post(
        `/api/events/${eventId}/guests/google-contacts`,
        { accessToken: this.accessToken }
      );

      return response.data.contacts;

    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.isSignedIn = false;
        this.accessToken = null;
        throw new Error('Token expired - please sign in again');
      }
      throw new Error('שגיאה בקבלת אנשי קשר: ' + (error.response?.data?.message || error.message));
    }
  }
}

const googleContactsAPI = new GoogleContactsAPI();
export default googleContactsAPI;
