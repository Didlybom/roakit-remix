import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities, fetchIdentities } from '../firestore.server/fetchers.server';
import { TopActorsMap, getTopActors, identifyActivities } from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';

const logger = pino({ name: 'route:fetcher.top-contributors' });

export interface TopActorsResponse {
  error?: { message: string };
  topActors?: TopActorsMap;
}

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<TopActorsResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return json(
      { error: { message: 'Fetching top contributors failed. Invalid session.' } },
      { status: 401 }
    );
  }
  if (!params.daterange) {
    return json(
      { error: { message: 'Fetching top contributors failed. Invalid params.' } },
      { status: 400 }
    );
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    let topActors = null;
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return json(
        { error: { message: 'Fetching top contributors failed. Invalid params.' } },
        { status: 400 }
      );
    }
    const activities = await fetchActivities({ customerId: sessionData.customerId!, startDate });
    topActors = getTopActors(identifyActivities(activities, identities.accountMap));
    return json({ topActors });
  } catch (e) {
    logger.error(e);
    return json(
      { error: { message: errMsg(e, 'Fetching top contributors failed') } },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
