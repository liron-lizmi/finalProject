import { Client, Account } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67e96550002c983cae42'); 

const account = new Account(client);

const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {
        return account.createOAuth2Session(provider, successUrl, failureUrl);
    } catch (error) {
        console.error('OAuth error:', error);
        throw error;
    }
};

export { client, account, createOAuth2Session };