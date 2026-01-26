// src/pages/components/GoogleContacts.js
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
      
      if (!process.env.REACT_APP_GOOGLE_CONTACTS_CLIENT_ID) {
        throw new Error('Google Client ID לא מוגדר במשתני הסביבה');
      }

      await this.init();
      
      // Using Google Identity Services OAuth
      const tokenResponse = await new Promise((resolve, reject) => {
        const tokenClient = window.google.accounts.oauth2.initTokenClient({
          client_id: process.env.REACT_APP_GOOGLE_CONTACTS_CLIENT_ID,
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

  // Receiving contacts
  async getContacts() {
    try {
      if (!this.isSignedIn || !this.accessToken) {
        throw new Error('לא מחובר לגוגל');
      }
      
      // Using fetch directly to the People API
      const response = await fetch(
        'https://people.googleapis.com/v1/people/me/connections?personFields=names,phoneNumbers&pageSize=1000',
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          this.isSignedIn = false;
          this.accessToken = null;
          throw new Error('Token expired - please sign in again');
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const contacts = data.connections || [];
      
      return this.processContacts(contacts);

    } catch (error) {
        throw new Error('שגיאה בקבלת אנשי קשר: ' + error.message);
    }
  }

  // Processing contacts
  processContacts(contacts) {
    return contacts
      .filter(contact => contact.names && contact.phoneNumbers)
      .map(contact => {
        const name = contact.names[0];
        const phone = contact.phoneNumbers[0];
        
        let cleanPhone = phone.value || '';
        cleanPhone = cleanPhone.replace(/[^\d+\-]/g, '');
        
        if (cleanPhone.startsWith('+972')) {
          cleanPhone = '0' + cleanPhone.substring(4);
        }
        if (cleanPhone.startsWith('972')) {
          cleanPhone = '0' + cleanPhone.substring(3);
        }
        
        if (cleanPhone.startsWith('05') && cleanPhone.length === 10) {
          cleanPhone = cleanPhone.substring(0, 3) + '-' + cleanPhone.substring(3);
        }

        return {
          id: contact.resourceName,
          firstName: name.givenName || '',
          lastName: name.familyName || '',
          phone: cleanPhone,
          group: 'other',
          selected: false
        };
      })
      .filter(contact => contact.phone && contact.phone.length > 5);
  }
}

const googleContactsAPI = new GoogleContactsAPI();
export default googleContactsAPI;