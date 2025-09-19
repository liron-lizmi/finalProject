// client/src/appwrite.js
import { Client, Account } from 'appwrite';

const client = new Client();

client
    .setEndpoint('https://cloud.appwrite.io/v1')
    .setProject('67e96550002c983cae42'); 

const account = new Account(client);

const createOAuth2Session = async (provider, successUrl, failureUrl) => {
    try {
        console.log('Creating OAuth2 session with:', {
            provider,
            successUrl,
            failureUrl
        });
        
        if (typeof window !== 'undefined') {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            
            try {
                const sessions = await account.listSessions();
                console.log('Found existing sessions:', sessions.sessions.length);
                
                for (const session of sessions.sessions) {
                    try {
                        await account.deleteSession(session.$id);
                        console.log('Deleted session:', session.$id);
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
            
            console.log('Creating new OAuth session...');
            
            try {
                await account.createOAuth2Session(provider, successUrl, failureUrl);
            } catch (oauthError) {
                console.error('OAuth creation failed:', oauthError);
                
                const oauthUrl = `https://cloud.appwrite.io/v1/account/sessions/oauth2/${provider}` +
                    `?project=67e96550002c983cae42` +
                    `&success=${encodeURIComponent(successUrl)}` +
                    `&failure=${encodeURIComponent(failureUrl)}`;
                
                console.log("Using manual OAuth URL:", oauthUrl);
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
        console.log('Current Appwrite session:', {
            provider: session.provider,
            userId: session.userId,
            expire: session.expire,
            providerUid: session.providerUid
        });
        return session;
    } catch (error) {
        console.log('No current Appwrite session');
        return null;
    }
};

const getCurrentUser = async () => {
    try {
        const user = await account.get();
        console.log('Current Appwrite user:', {
            id: user.$id,
            email: user.email,
            name: user.name,
            providerUid: user.providerUid,
            provider: user.provider,
            registration: user.registration,
            status: user.status,
            prefs: user.prefs
        });
        return user;
    } catch (error) {
        console.log('No current Appwrite user:', error.message);
        return null;
    }
};

const clearAllSessions = async () => {
    try {
        const sessions = await account.listSessions();
        console.log('Clearing all sessions, found:', sessions.sessions.length);
        
        const deletePromises = sessions.sessions.map(session => 
            account.deleteSession(session.$id).catch(err => 
                console.log('Failed to delete session:', session.$id, err.message)
            )
        );
        
        await Promise.all(deletePromises);
        console.log('All sessions cleared successfully');
        return true;
    } catch (error) {
        console.log('Error clearing sessions:', error.message);
        return false;
    }
};

export { client, account, createOAuth2Session, getCurrentSession, getCurrentUser, clearAllSessions };