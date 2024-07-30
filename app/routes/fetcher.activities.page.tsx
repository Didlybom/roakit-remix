import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import {
  compileActivityMappers,
  mapActivity,
  MapperType,
} from '../activityProcessors/activityMapper';
import {
  fetchActivitiesPage,
  fetchLaunchItemsWithCache,
} from '../firestore.server/fetchers.server';
import type { Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { errMsg, RoakitError } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export interface ActivityPageResponse {
  error?: ErrorField;
  activities?: Activity[];
  activityTotal?: number;
}

export const shouldRevalidate = () => false;

const VIEW = View.FetcherActivitiesPage;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<ActivityPageResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching activities page failed. Invalid session.', 401);
  }
  const { searchParams } = new URL(request.url);
  const startAfter = searchParams.get('startAfter') ? +searchParams.get('startAfter')! : undefined;
  const endBefore = searchParams.get('endBefore') ? +searchParams.get('endBefore')! : undefined;
  const userIds = searchParams.get('userIds')?.split(',') ?? undefined;
  const launchIds = searchParams.get('launchIds')?.split(',') ?? undefined;
  const artifacts = searchParams.get('artifacts')?.split(',') ?? undefined;
  const limit = searchParams.get('limit') ? +searchParams.get('limit')! : undefined;
  const withInitiatives =
    searchParams.get('withInitiatives') ?
      searchParams.get('withInitiatives') === 'true'
    : undefined;
  const withTotal =
    searchParams.get('withTotal') ? searchParams.get('withTotal') === 'true' : undefined;
  const includeFuture =
    searchParams.get('includeFuture') ? searchParams.get('includeFuture') === 'true' : undefined;
  const combine = searchParams.get('combine') ? searchParams.get('combine') === 'true' : undefined;
  if (!limit) {
    return errorJsonResponse('Fetching activities page failed. Invalid params.', 400);
  }
  try {
    if (!launchIds?.length) {
      const { activities, activityTotal } = await fetchActivitiesPage({
        customerId: sessionData.customerId!,
        startAfter,
        endBefore,
        userIds,
        artifacts,
        limit,
        withInitiatives,
        withTotal,
        includeFuture,
        combine,
      });
      return json({ activities, activityTotal });
    } else {
      const launchItems = await fetchLaunchItemsWithCache(sessionData.customerId!);
      compileActivityMappers(MapperType.LaunchItem, launchItems);
      let fetchCount = 0;
      let startAfterDate = startAfter;
      while (fetchCount < 1000 / limit) {
        fetchCount++;
        const { activities } = await fetchActivitiesPage({
          customerId: sessionData.customerId!,
          startAfter: startAfterDate,
          userIds,
          artifacts,
          limit,
          includeFuture,
          combine,
        });
        const filteredActivities = activities
          .map(activity =>
            activity.launchItemId != null ?
              activity
            : { ...activity, launchItemId: mapActivity(activity)?.launchItems[0] ?? '' }
          )
          .filter(activity => activity.launchItemId && launchIds.includes(activity.launchItemId));
        if (filteredActivities.length > 0) {
          return json({ activities: filteredActivities });
        }
        if (activities.length > 0) {
          startAfterDate = activities[activities.length - 1].createdTimestamp;
        }
      }
      return json({ activities: [] });
    }
  } catch (e) {
    getLogger('route:fetcher.activities.page').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities page failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
