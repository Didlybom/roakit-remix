import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import {
  fetchActivities,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { compileInitiativeMappers, mapActivity } from '../initiativeMapper/initiativeMapper';
import { groupActivities, identifyActivities, type GroupedActivities } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:fetcher.grouped-activities' });

export type GroupedActivitiesResponse = { error?: ErrorField } & GroupedActivities;

export const shouldRevalidate = () => false;

const VIEW = View.FetcherGroupedActivities;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<GroupedActivitiesResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW);
  } catch (e) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid session.', 401);
  }
  if (!params.daterange) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid params.', 400);
  }
  try {
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return errorJsonResponse('Fetching grouped activities failed. Invalid params.', 400);
    }

    const [initiatives, identities, activities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchActivities({
        customerId: sessionData.customerId!,
        startDate,
        options: { findPriority: true, includesMetadata: true },
      }),
    ]);

    compileInitiativeMappers(initiatives);
    activities.forEach(activity => {
      if (!activity.initiativeId) {
        activity.initiativeId = mapActivity(activity)?.[0] ?? '';
      }
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
