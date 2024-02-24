import pino from 'pino';
import { SessionData, getSessionData } from './sessionCookie.server';

const logger = pino({ name: 'authUtils' });

export const loadSession = async (request: Request) => {
  let sessionData: SessionData;
  try {
    sessionData = await getSessionData(request);
    if (!sessionData.isLoggedIn || !sessionData.customerId) {
      return { ...sessionData, redirect: '/login' };
    }
    return sessionData;
  } catch (e) {
    logger.error(e);
    return { isLoggedIn: false, redirect: '/logout' };
  }
};
