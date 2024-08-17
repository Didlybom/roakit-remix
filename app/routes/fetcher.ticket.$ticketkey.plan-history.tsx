import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { fetchTicketPlanHistory } from '../firestore.server/fetchers.server';
import type { TicketPlanHistory } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export type TicketPlanHistoryResponse = { error?: ErrorField; planHistory?: TicketPlanHistory };

export const shouldRevalidate = () => false;

const VIEW = View.FetcherTicketPlanHistory;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<TicketPlanHistoryResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching ticket plan history failed. Invalid session.', 401);
  }
  try {
    const planHistory = await fetchTicketPlanHistory(sessionData.customerId!, params.ticketkey!);
    return json({ planHistory });
  } catch (e) {
    getLogger('route:fetcher.ticket.plan-history').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching ticket plan history failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
