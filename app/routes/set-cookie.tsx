import { ActionFunctionArgs, json } from '@remix-run/server-runtime';
import { DateRangeValue } from '../utils/dateUtils';
import { parseCookie, sessionCookie } from '../utils/sessionCookie.server';

interface JsonRequest {
  isNavOpen?: boolean;
  dateRange?: DateRangeValue;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const jsonRequest = (await request.json()) as JsonRequest;
  const jsonReq = jsonRequest ?? ((await request.json()) as JsonRequest);
  const cookie = await parseCookie(request);
  if (jsonReq.isNavOpen != null) {
    cookie.isNavOpen = jsonReq.isNavOpen;
  }
  if (jsonReq.dateRange != null) {
    cookie.dateRange = jsonReq.dateRange;
  }
  return cookie.isNavOpen != null || cookie.dateRange != null ?
      json(null, {
        headers: {
          'Set-Cookie': await sessionCookie.serialize(
            cookie,
            cookie.expires ? { expires: new Date(cookie.expires) } : undefined
          ),
        },
      })
    : null;
};
