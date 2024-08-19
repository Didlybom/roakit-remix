import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { fetchEvent } from '../cloudstore.server/fetchers.server';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

const VIEW = View.RawEvent;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  await loadAndValidateSession(request, VIEW);
  try {
    const eventJsonString = await fetchEvent(params['*']!);
    return new Response(eventJsonString, { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    getLogger('route:event.view').error(e);
    return json(
      { error: { message: errMsg(e, 'An error occurred') } },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
