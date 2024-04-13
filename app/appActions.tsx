import { SubmitOptions } from '@remix-run/react';
import { json } from '@remix-run/server-runtime';
import { sessionCookie } from './cookies.server';
import { DateRangeValue } from './utils/dateUtils';
import { parseCookie } from './utils/sessionCookie.server';

export const postJsonOptions: SubmitOptions = {
  method: 'POST',
  encType: 'application/json',
};

export const deleteJsonOptions: SubmitOptions = {
  method: 'DELETE',
  encType: 'application/json',
};

export interface AppJsonRequest {
  app?: { isNavOpen?: boolean; dateRange?: DateRangeValue };
}

export const appActions = async (request: Request, jsonRequest?: AppJsonRequest) => {
  const jsonReq = jsonRequest ?? ((await request.json()) as AppJsonRequest);
  const isNavOpen = jsonReq.app?.isNavOpen;
  if (isNavOpen != null) {
    const cookie = await parseCookie(request);
    cookie.isNavOpen = isNavOpen;
    return json(null, {
      headers: {
        'Set-Cookie': await sessionCookie.serialize(
          cookie,
          cookie.expires ? { expires: new Date(cookie.expires) } : undefined
        ),
      },
    });
  }

  const dateRange = jsonReq.app?.dateRange;
  if (dateRange != null) {
    const cookie = await parseCookie(request);
    cookie.dateRange = dateRange;
    return json(null, {
      headers: {
        'Set-Cookie': await sessionCookie.serialize(
          cookie,
          cookie.expires ? { expires: new Date(cookie.expires) } : undefined
        ),
      },
    });
  }

  return null;
};
