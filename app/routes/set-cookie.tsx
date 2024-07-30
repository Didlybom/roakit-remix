import type { ActionFunctionArgs } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import type { DateRangeValue } from '../utils/dateUtils';
import { isToday } from '../utils/dateUtils';
import { parseCookie, sessionCookie } from '../utils/sessionCookie.server';

interface ActionRequest {
  isNavOpen?: boolean;
  dateRange?: DateRangeValue;
  endDay?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const actionRequest = (await request.json()) as ActionRequest;
  const jsonReq = actionRequest ?? ((await request.json()) as ActionRequest);
  const cookie = await parseCookie(request);
  if (jsonReq.isNavOpen != null) {
    cookie.isNavOpen = jsonReq.isNavOpen;
  }
  if (jsonReq.dateRange != null) {
    cookie.dateRange = jsonReq.dateRange;
  }
  if (jsonReq.endDay != null) {
    cookie.endDay = isToday(jsonReq.endDay) ? undefined : jsonReq.endDay;
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
