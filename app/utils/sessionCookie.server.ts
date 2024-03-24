import pino from 'pino';
import { sessionCookie } from '../cookies.server';
import { auth, queryCustomerId } from '../firebase.server';

const logger = pino({ name: 'utils:session-cookie' });

export interface SessionData {
  redirect?: string;
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
  let token;
  try {
    token = await auth.verifySessionCookie(jwt);
    sessionData = { isLoggedIn: true, email: token.email };
  } catch (e) {
    logger.error(e, 'Error verifying session');
    throw e;
  }

  if (sessionData.isLoggedIn && sessionData.email) {
    sessionData.customerId = await queryCustomerId(sessionData.email);
    if (sessionData.customerId != +token.customerId) {
      sessionData.isLoggedIn = false; // force user to re-login if customerId is not there or wrong
    }
  }
  return sessionData;
};
