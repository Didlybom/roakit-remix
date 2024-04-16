import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivities } from '../firestore.server/fetchers.server';
import { ActivityRecord } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.activities' });

export interface ActivityResponse {
  error?: { message: string };
  activities?: ActivityRecord;
}

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return json(
      { error: { message: 'Fetching activities failed. Invalid session.' } },
      { status: 401 }
    );
  }
  if (!params.daterange || !params.userid) {
    return json(
      { error: { message: 'Fetching activities failed. Invalid params.' } },
      { status: 400 }
    );
  }
  try {
    const startDate = dateFilterToStartDate(params.daterange as DateRange);
    if (!startDate) {
      return json(
        { error: { message: 'Fetching activities failed. Invalid params.' } },
        { status: 400 }
      );
    }
    const userIds = params.userid === '*' ? undefined : params.userid.split(',');
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      userIds,
      includesMetadata: true,
    });
    const activityRecord: ActivityRecord = {};
    [...activities].forEach(([id, activity]) => {
      activityRecord[id] = activity;
    });
    return jsonResponse({ activities: activityRecord });
  } catch (e) {
    logger.error(e);
    return json(
      { error: { message: errMsg(e, 'Fetching activities failed') } },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
