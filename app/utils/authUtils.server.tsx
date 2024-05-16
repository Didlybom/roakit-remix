import { redirect } from '@remix-run/server-runtime';
import pino from 'pino';
import { getSessionData } from './sessionCookie.server';

const logger = pino({ name: 'authUtils' });

export const loadSession = async (request: Request) => {
  try {
    const sessionData = await getSessionData(request);
    if (sessionData.isLoggedIn && sessionData.customerId) {
      return sessionData;
    }
  } catch (e) {
    logger.error(e);
    throw redirect('/logout');
  }
  throw redirect('/login');
};
