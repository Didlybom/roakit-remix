import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchActivitiesPage } from '../firestore.server/fetchers.server';
import type { ActivityData } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse } from '../utils/httpUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:fetcher.activities.page' });

export interface ActivityPageResponse {
  error?: ErrorField;
  activities?: ActivityData[];
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
  const limit = searchParams.get('limit') ? +searchParams.get('limit')! : undefined;
  const withInitiatives =
    searchParams.get('withInitiatives') ?
      searchParams.get('withInitiatives') === 'true'
    : undefined;
  if (!limit) {
    return errorJsonResponse('Fetching activities page failed. Invalid params.', 400);
  }
  try {
    const { activities, activityTotal } = await fetchActivitiesPage({
      customerId: sessionData.customerId!,
      startAfter,
      endBefore,
      limit,
      withInitiatives,
    });
    return json({ activities, activityTotal });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching activities page failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};