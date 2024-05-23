import type { Params } from '@remix-run/react';
import { redirect } from '@remix-run/server-runtime';
import pino from 'pino';
import { checkAccess, type View } from './rbac';
import { getSessionData } from './sessionCookie.server';

const logger = pino({ name: 'authUtils' });

export const loadSession = async (request: Request, view: View, params?: Params<string>) => {
  let sessionData;
  try {
    sessionData = await getSessionData(request);
  } catch (e) {
    logger.error(e);
    throw redirect('/logout');
  }
  if (sessionData.isLoggedIn && sessionData.customerId) {
    checkAccess(view, sessionData, request, params);
    return sessionData;
  } else {
    throw redirect('/login');
  }
};
