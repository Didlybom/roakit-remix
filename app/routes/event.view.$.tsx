import { LoaderFunctionArgs, redirect } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchEvent } from '../cloudstore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';

const logger = pino({ name: 'route:event.view' });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const event = await fetchEvent(params['*']!);
    return new Response(event, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
