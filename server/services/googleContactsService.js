/**
 * googleContactsService.js - Google Contacts Integration Service
 *
 * Fetches and processes contacts from Google People API on the server side.
 * The client sends an OAuth access token (obtained via Google Identity Services),
 * and this service uses it to call the People API securely from the server.
 *
 * Methods:
 * - fetchContacts(accessToken): Fetches contacts from Google People API
 * - processContacts(contacts): Maps and formats contacts for the application
 */

const axios = require('axios');

const GOOGLE_CONTACTS_ID = 'https://people.googleapis.com/v1/people/me/connections';

/**
 * Fetches contacts from Google People API using the provided access token.
 * Returns processed contacts with firstName, lastName, and formatted phone.
 */
const fetchContacts = async (accessToken) => {
  const response = await axios.get(GOOGLE_CONTACTS_ID, {
    params: {
      personFields: 'names,phoneNumbers',
      pageSize: 1000
    },
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    }
  });

  const contacts = response.data.connections || [];
  return processContacts(contacts);
};

/**
 * Processes raw Google contacts into application format.
 * Filters contacts with both name and phone, formats Israeli phone numbers.
 */
const processContacts = (contacts) => {
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
};

module.exports = {
  fetchContacts
};
