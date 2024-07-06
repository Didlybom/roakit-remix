import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchEvent } from '../cloudstore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:event.view' });

const VIEW = View.RawEvent;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadSession(request, VIEW);
  try {
    const eventJsonString = await fetchEvent(params['*']!);
    return new Response(eventJsonString, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    logger.error(e);
    return json(
      { error: { message: errMsg(e, 'An error occurred') } },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
