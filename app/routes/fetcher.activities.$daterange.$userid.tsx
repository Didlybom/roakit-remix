import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities } from '../firestore.server/fetchers.server';
import { ActivityRecord } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.activities' });

export interface ActivityResponse {
  error?: ErrorField;
  activities?: ActivityRecord;
}

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return errorJsonResponse('Fetching activities failed. Invalid session.', 401);
  }
  if (!params.daterange || !params.userid) {
    return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
  }
  try {
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
    }
    const userIds = params.userid === '*' ? undefined : params.userid.split(',');
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      userIds,
      options: { includesMetadata: true, findPriority: true },
    });
    const activityRecord: ActivityRecord = {};
    [...activities].forEach(([activityId, activity]) => {
      activityRecord[activityId] = activity;
    });
    return jsonResponse({ activities: activityRecord });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
