import { json } from '@remix-run/server-runtime';
import { sessionCookie } from './cookies.server';
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

  return null;
};
