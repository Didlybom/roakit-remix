import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities, fetchIdentities } from '../firestore.server/fetchers.server';
import { TopActorsMap, getTopActors, identifyActivities } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';

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
  let sessionData;
  try {
    sessionData = await loadSession(request);
  } catch (e) {
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
    return json({ topActors });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching top contributors failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
