import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import dayjs from 'dayjs';
import {
  fetchActivities,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { groupActivities, type GroupedActivities } from '../processors/activityGrouper';
import { identifyActivities } from '../processors/activityIdentifier';
import { compileActivityMappers, mapActivity } from '../processors/activityMapper';
import { loadAndValidateSession } from '../utils/authUtils.server';
import type { DateRange } from '../utils/dateUtils';
import { dateFilterToStartDate, endOfDay, isValidDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export type GroupedActivitiesResponse = { error?: ErrorField } & GroupedActivities;

export const shouldRevalidate = () => false;

const VIEW = View.FetcherGroupedActivities;

const SEARCH_PARAM_DATERANGE = 'dateRange';
const SEARCH_PARAM_ENDDAY = 'endDay';

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<GroupedActivitiesResponse>> => {
  let sessionData;
  try {
    sessionData = await loadAndValidateSession(request, VIEW);
  } catch (e) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid session.', 401);
  }

  const { searchParams } = new URL(request.url);
  if (
    searchParams.get(SEARCH_PARAM_DATERANGE) == null ||
    searchParams.get(SEARCH_PARAM_ENDDAY) == null
  ) {
    return errorJsonResponse('Fetching grouped activities failed. Missing params.', 400);
  }
  const dateRange = searchParams.get(SEARCH_PARAM_DATERANGE) as DateRange;
  const endDay = dayjs(searchParams.get(SEARCH_PARAM_ENDDAY));
  if (!isValidDate(endDay)) {
    return errorJsonResponse('Fetching grouped activities failed. Invalid endDay param.', 400);
  }
  try {
    const startDate = dateFilterToStartDate(dateRange, endDay);
    if (!startDate) {
      return errorJsonResponse('Fetching grouped activities failed. Invalid params.', 400);
    }

    const [initiatives, identities, activities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchActivities({
        customerId: sessionData.customerId!,
        startDate,
        endDate: endOfDay(endDay),
        options: { findPriority: true, includeMetadata: true },
      }),
    ]);

    compileActivityMappers(initiatives);
    activities.forEach(activity => {
      if (activity.initiativeId == null) {
        activity.initiativeId = mapActivity(activity)[0] ?? '';
      }
    });

    const groupedActivities = groupActivities(
      identifyActivities(activities, identities.accountMap)
    );
    return json({ ...groupedActivities });
  } catch (e) {
    getLogger('route:fetcher.grouped-activities').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching grouped activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
