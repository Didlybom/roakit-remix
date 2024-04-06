import { LoaderFunctionArgs, json, redirect } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchEvent } from '../cloudstore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';

const logger = pino({ name: 'route:event.view' });

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const eventJsonString = await fetchEvent(params['*']!);
    return new Response(eventJsonString, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    logger.error(e);
    return json(
      { error: true, message: errMsg(e, 'An error occurred') },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
