// client/src/appwrite.js
import { Client, Account } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('67e96550002c983cae42'); 

const account = new Account(client);

const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {
        console.log('=== OAuth Flow Started ===');
        console.log('Provider:', provider);
        console.log('Success URL:', successUrl);
        console.log('Failure URL:', failureUrl);
        console.log('Current origin:', window.location.origin);

        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            try {
                const sessions = await account.listSessions();
                
                for (const session of sessions.sessions) {
                    try {
                        await account.deleteSession(session.$id);
                    } catch (deleteErr) {
                        console.log('Failed to delete session:', session.$id);
                    }
                }
                
                if (sessions.sessions.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
                
            } catch (sessionCheckError) {
                console.log('No sessions to check/delete');
            }
                        
            try {
                console.log('Calling Appwrite createOAuth2Session...');
                await account.createOAuth2Session(provider, successUrl, failureUrl);
                console.log('OAuth2Session created successfully');
            } catch (oauthError) {
                console.error('OAuth creation failed:', oauthError);

                const oauthUrl = `https://fra.cloud.appwrite.io/v1/account/sessions/oauth2/${provider}` +
                    `?project=67e96550002c983cae42` +
                    `&success=${encodeURIComponent(successUrl)}` +
                    `&failure=${encodeURIComponent(failureUrl)}`;

                console.log('Fallback OAuth URL:', oauthUrl);
                window.location.href = oauthUrl;
            }
        }
    } catch (error) {
        console.error('OAuth session creation error:', error);
        throw error;
    }
};

const getCurrentSession = async () => {
    try {
        const session = await account.getSession('current');

        return session;
    } catch (error) {
        return null;
    }
};

const getCurrentUser = async () => {
    try {
        const user = await account.get();

        return user;
    } catch (error) {
        return null;
    }
};

const clearAllSessions = async () => {
    try {
        const sessions = await account.listSessions();
        
        const deletePromises = sessions.sessions.map(session => 
            account.deleteSession(session.$id).catch(err => 
                console.log('Failed to delete session:', session.$id, err.message)
            )
        );
        
        await Promise.all(deletePromises);
        return true;
    } catch (error) {
        return false;
    }
};

export { client, account, createOAuth2Session, getCurrentSession, getCurrentUser, clearAllSessions };