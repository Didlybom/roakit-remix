import { json } from '@remix-run/server-runtime';
import { sessionCookie } from './cookies.server';
import { DateRangeValue } from './utils/dateUtils';
import { parseCookie } from './utils/sessionCookie.server';

export const appActions = async (request: Request, formData: FormData) => {
  const isNavOpen = formData.get('isNavOpen');
  if (isNavOpen !== null) {
    const cookie = await parseCookie(request);
    cookie.isNavOpen = isNavOpen === 'true';
    return json(null, {
      headers: {
        'Set-Cookie': await sessionCookie.serialize(cookie),
      },
    });
  }

  const dateRange = formData.get('dateRange');
  if (dateRange !== null) {
    const cookie = await parseCookie(request);
    cookie.dateRange = dateRange as DateRangeValue;
    return json(null, {
      headers: {
        'Set-Cookie': await sessionCookie.serialize(cookie),
      },
    });
  }

  return null;
};
