import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import {
  fetchActivities,
  queryIdentity,
  queryTeamIdentities,
} from '../firestore.server/fetchers.server';
import type { ActivityRecord } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:fetcher.activities' });

export interface ActivityResponse {
  error?: ErrorField;
  activities?: ActivityRecord;
}

export const shouldRevalidate = () => false;

const VIEW = View.FetcherActivities;
const ALL = '*';

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching activities failed. Invalid session.', 401);
  }
  try {
    const { searchParams } = new URL(request.url);
    const includeTeam = searchParams.get('includeTeam') === 'true';
    const startDate = searchParams.get('start') ? +searchParams.get('start')! : undefined;
    if (!startDate) {
      return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
    }
    const endDate = searchParams.get('end') ? +searchParams.get('end')! : undefined;
    const isUserList = searchParams.get('userList') === 'true';
    let userIds;
    if (params.userid === ALL) {
      userIds = undefined;
    } else if (isUserList) {
      if (!params.userid) {
        return errorJsonResponse('Fetching activities failed. Invalid params.', 400);
      }
      userIds = params.userid.split(',');
    } else {
      const userIdSet = new Set<string>();
      if (params.userid) {
        userIdSet.add(params.userid); // impersonification
      }
      const identity = await queryIdentity(sessionData.customerId!, {
        identityId: params.userid,
        email: sessionData.email,
      });
      userIdSet.add(identity.id);
      identity.accounts.filter(a => a.id).forEach(a => userIdSet.add(a.id));

      if (includeTeam) {
        const teamIdentities = await queryTeamIdentities(sessionData.customerId!, identity.id);
        teamIdentities
          .flatMap(i => i.accounts)
          .filter(a => a.id)
          .forEach(a => userIdSet.add(a.id));
      }
      userIds = [...userIdSet];
    }
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      endDate,
      userIds,
      options: { includeMetadata: true, findPriority: true, combine: true },
    });
    const activityRecord: ActivityRecord = {};
    activities.forEach(activity => (activityRecord[activity.id] = activity));
    return json({ activities: activityRecord });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
