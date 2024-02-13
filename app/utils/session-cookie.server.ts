import pino from 'pino';
import { sessionCookie } from '~/cookies.server';
import { auth, firestore } from '~/firebase.server';

const logger = pino({ name: 'utils:session-cookie' });

export interface SessionData {
  isLoggedIn: boolean;
  email?: string;
  customerId?: number;
}

export const getSessionData = async (request: Request): Promise<SessionData> => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return { isLoggedIn: false };
  }

  let sessionData: SessionData;
  try {
    const token = await auth.verifySessionCookie(jwt);
    sessionData = { isLoggedIn: true, email: token.email };
  } catch (e) {
    logger.error('Error verifying session', e);
    throw e;
  }

  if (sessionData.isLoggedIn) {
    const userDocs = (
      await firestore.collection('users').where('email', '==', sessionData.email).get()
    ).docs;
    if (userDocs.length === 0) {
      throw Error('User not found');
    }
    if (userDocs.length > 1) {
      throw Error('More than one User found');
    }
    sessionData.customerId = +userDocs[0].id;
  }
  return sessionData;
};
