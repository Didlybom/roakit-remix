import type { Params } from '@remix-run/react';
import { redirect } from '@remix-run/server-runtime';
import { getLogger } from './loggerUtils.server';
import { checkAccess, type View } from './rbac';
import { getSessionData } from './sessionCookie.server';

const logger = getLogger('authUtils');

export const loadAndValidateSession = async (
  request: Request,
  view: View,
  params?: Params<string>
) => {
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
    const requestPathname = new URL(request.url).pathname;
    if (requestPathname.length > 1) {
      throw redirect('/login?redirect=' + encodeURI(requestPathname));
    } else {
      throw redirect('/login');
    }
  }
};
