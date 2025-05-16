import { Client, Account } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67e96550002c983cae42'); 

const account = new Account(client);

const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {
        if (typeof window !== 'undefined') {
          const url = await account.createOAuth2Session(provider, successUrl, failureUrl);
          console.log("OAuth URL:", url);
          if (url) {
            window.location.href = url;
          }
        }
      } catch (error) {
        console.error('OAuth session creation error:', error);
        throw error;
      }
};

export { client, account, createOAuth2Session };