import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities } from '../firestore.server/fetchers.server';
import type { ActivityRecord } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.activities' });

export interface ActivityResponse {
  error?: ErrorField;
  activities?: ActivityRecord;
}

export const shouldRevalidate = () => false;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request);
  } catch (e) {
    return errorJsonResponse('Fetching activities failed. Invalid session.', 401);
  }
  if (!params.userid) {
    return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
  }
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start') ? +searchParams.get('start')! : undefined;
    if (!startDate) {
      return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
    }
    const endDate = searchParams.get('end') ? +searchParams.get('end')! : undefined;
    const userIds = params.userid === '*' ? undefined : params.userid.split(',');
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      endDate,
      userIds,
      options: { includesMetadata: true, findPriority: true },
    });
    const activityRecord: ActivityRecord = {};
    [...activities].forEach(([activityId, activity]) => {
      activityRecord[activityId] = activity;
    });
    return json({ activities: activityRecord });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
