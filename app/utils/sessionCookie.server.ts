import pino from 'pino';
import { sessionCookie } from '../cookies.server';
import { auth, queryCustomerId } from '../firebase.server';
import { DateRange, DateRangeValue } from './dateUtils';

const logger = pino({ name: 'utils:session-cookie' });

export interface SessionData {
  redirect?: string;
  isLoggedIn: boolean;
  email?: string;
  customerId?: number;
  isNavOpen?: boolean;
  dateFilter?: DateRange;
}

export interface CookieData {
  expires?: number;
  jwt?: string;
  isNavOpen?: boolean;
  dateRange?: DateRangeValue;
}

export const parseCookie = async (request: Request) => {
  const cookie = (await sessionCookie.parse(request.headers.get('Cookie'))) as CookieData;
  return cookie ?? { jwt: null };
};

export const getCookieExpiration = async (request: Request) => {
  const cookie = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  return (cookie as CookieData) ?? { jwt: null };
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
    sessionData = { isLoggedIn: true, email: token.email, isNavOpen, dateFilter: dateRange };
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
