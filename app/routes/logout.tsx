import { redirect } from '@remix-run/node';
import { sessionCookie } from '~/cookies.server';

export const loader = async () => {
  return redirect('/', {
    headers: {
      'Set-Cookie': await sessionCookie.serialize('', {
        expires: new Date(0),
      }),
    },
  });
};
