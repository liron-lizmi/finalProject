// client/src/appwrite.js
import { Client, Account } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67e96550002c983cae42'); 

const account = new Account(client);

const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {

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
                await account.createOAuth2Session(provider, successUrl, failureUrl);
            } catch (oauthError) {
                console.error('OAuth creation failed:', oauthError);
                
                const oauthUrl = `https://cloud.appwrite.io/v1/account/sessions/oauth2/${provider}` +
                    `?project=67e96550002c983cae42` +
                    `&success=${encodeURIComponent(successUrl)}` +
                    `&failure=${encodeURIComponent(failureUrl)}`;
                
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