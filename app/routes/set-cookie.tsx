import { ActionFunctionArgs, json } from '@remix-run/server-runtime';
import { sessionCookie } from '../cookies.server';
import { DateRangeValue } from '../utils/dateUtils';
import { parseCookie } from '../utils/sessionCookie.server';

interface JsonRequest {
  isNavOpen?: boolean;
  dateRange?: DateRangeValue;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const jsonRequest = (await request.json()) as JsonRequest;
  const jsonReq = jsonRequest ?? ((await request.json()) as JsonRequest);

  const isNavOpen = jsonReq.isNavOpen;
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

  const dateRange = jsonReq.dateRange;
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
