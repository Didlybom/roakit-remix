import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities, fetchIdentities } from '../firestore.server/fetchers.server';
import { TopActorsMap, getTopActors, identifyActivities } from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.top-contributors' });

export interface TopActorsResponse {
  error?: ErrorField;
  topActors?: TopActorsMap;
}

export const shouldRevalidate = () => false;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<TopActorsResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return errorJsonResponse('Fetching top contributors failed. Invalid session.', 401);
  }
  if (!params.daterange) {
    return errorJsonResponse('Fetching top contributors failed. Invalid params.', 400);
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    let topActors = null;
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return errorJsonResponse('Fetching top contributors failed. Invalid params.', 400);
    }
    const activities = await fetchActivities({ customerId: sessionData.customerId!, startDate });
    topActors = getTopActors(identifyActivities(activities, identities.accountMap));
    return jsonResponse({ topActors });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching top contributors failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
