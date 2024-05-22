import { createCookie } from '@remix-run/node';
import pino from 'pino';
import { getSelectorsByUserAgent } from 'react-device-detect';
import { auth } from '../firebase.server';
import { queryUser } from '../firestore.server/fetchers.server';
import { DateRange, DateRangeValue } from './dateUtils';
import type { Role } from './userUtils';

const logger = pino({ name: 'utils:session-cookie' });

export interface SessionData {
  redirect?: string;
  isLoggedIn: boolean;
  email?: string;
  customerId?: number;
  role?: Role;
  isNavOpen?: boolean;
  dateFilter?: DateRange;
}

export interface CookieData {
  expires?: number;
  jwt?: string;
  isNavOpen?: boolean;
  dateRange?: DateRangeValue;
}

export const sessionCookie = createCookie('__session', {
  // WARNING: Firebase Hosting + Cloud Functions strip any cookie not named __session  https://stackoverflow.com/a/44935288
  secrets: ['roakit cookie secret'],
  path: '/',
});

export const parseCookie = async (request: Request) => {
  const cookie = (await sessionCookie.parse(request.headers.get('Cookie'))) as CookieData;
  return cookie ?? { jwt: null };
};

export const getSessionData = async (request: Request): Promise<SessionData> => {
  const { jwt, isNavOpen, dateRange } = await parseCookie(request);
  if (!jwt) {
    return { isLoggedIn: false };
  }

  let sessionData: SessionData;
  let token;
  try {
    token = await auth.verifySessionCookie(jwt);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { isMobile } = getSelectorsByUserAgent(request.headers.get('User-Agent') ?? '');
    sessionData = {
      isLoggedIn: true,
      email: token.email,
      isNavOpen: isMobile ? false : isNavOpen,
      dateFilter: dateRange,
    };
  } catch (e) {
    logger.error(e, 'Error verifying session');
    throw e;
  }

  if (sessionData.isLoggedIn && sessionData.email) {
    const userData = await queryUser(sessionData.email);
    sessionData.customerId = userData.customerId;
    sessionData.role = userData.role;
    if (sessionData.customerId != +token.customerId) {
      sessionData.isLoggedIn = false; // force user to re-login if customerId is not there or wrong
    }
  }
  return sessionData;
};
