import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { fetchTickets } from '../firestore.server/fetchers.server';
import type { Ticket } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export type TicketsResponse = { error?: ErrorField; tickets?: Ticket[] };

export const shouldRevalidate = () => false;

const VIEW = View.FetcherTickets;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<TicketsResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching tickets failed. Invalid session.', 401);
  }
  const { searchParams } = new URL(request.url);
  const ticketKeys = searchParams.get('keys')?.split(',') ?? undefined;
  try {
    const tickets = await fetchTickets(sessionData.customerId!, ticketKeys);
    return json({ tickets });
  } catch (e) {
    getLogger('route:fetcher.tickets').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching tickets failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
