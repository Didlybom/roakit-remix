import pino from 'pino';
import { sessionCookie } from '~/cookies.server';
import { auth } from '~/firebase.server';

const logger = pino({ name: 'utils:session-cookie' });

export interface SessionData {
  isLoggedIn: boolean;
  email?: string;
}

export const getSessionData = async (request: Request): Promise<SessionData> => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return { isLoggedIn: false };
  }

  try {
    const token = await auth.verifySessionCookie(jwt);
    return { isLoggedIn: true, email: token.email };
  } catch (e) {
    logger.error('Error verifying session', e);
    throw e;
  }
};
