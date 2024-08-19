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
  const cookie = await parseCookie(request);
  if (actionRequest.isNavOpen != null) {
    cookie.isNavOpen = actionRequest.isNavOpen;
  }
  if (actionRequest.dateRange != null) {
    cookie.dateRange = actionRequest.dateRange;
  }
  if (actionRequest.endDay != null) {
    cookie.endDay = isToday(actionRequest.endDay) ? undefined : actionRequest.endDay;
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
