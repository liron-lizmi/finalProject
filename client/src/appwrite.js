import { Client, Account } from 'appwrite';

const client = new Client();

// הגדרת הקליינט
client
    .setEndpoint('https://cloud.appwrite.io/v1') // API Endpoint
    .setProject('67e96550002c983cae42'); 

// יצירת אובייקט Account
const account = new Account(client);

// פונקציה ליצירת התחברות עם OAuth
const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {
        return account.createOAuth2Session(provider, successUrl, failureUrl);
    } catch (error) {
        console.error('OAuth error:', error);
        throw error;
    }
};

// יצא את האובייקטים והפונקציות
export { client, account, createOAuth2Session };