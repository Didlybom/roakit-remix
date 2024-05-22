import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities, fetchIdentities } from '../firestore.server/fetchers.server';
import { groupActivities, identifyActivities, type GroupedActivities } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';
import { Role } from '../utils/userUtils';

const logger = pino({ name: 'route:fetcher.grouped-activities' });

export type GroupedActivitiesResponse = { error?: ErrorField } & GroupedActivities;

export const shouldRevalidate = () => false;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<GroupedActivitiesResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request);
  } catch (e) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid session.', 401);
  }
  if (sessionData.role !== Role.Admin && sessionData.role !== Role.Monitor) {
    return errorJsonResponse('Fetching grouped activities failed. Unauthorized.', 403);
  }
  if (!params.daterange) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid params.', 400);
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return errorJsonResponse('Fetching grouped activities failed. Invalid params.', 400);
    }
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      options: { findPriority: true },
    });
    const groupedActivities = groupActivities(
      identifyActivities(activities, identities.accountMap)
    );
    return json({ ...groupedActivities });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching grouped activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
