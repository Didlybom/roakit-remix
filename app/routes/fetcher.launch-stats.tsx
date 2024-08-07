import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { fetchLaunchStats } from '../firestore.server/fetchers.server';
import { groupLaunchStats, type GroupedLaunchStats } from '../processors/initiativeGrouper';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export type GroupedLaunchStatsResponse = { error?: ErrorField } & GroupedLaunchStats;

export const shouldRevalidate = () => false;

const VIEW = View.FetcherLaunchStats;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<GroupedLaunchStatsResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching launch stats failed. Invalid session.', 401);
  }
  try {
    const { searchParams } = new URL(request.url);
    const startDay = searchParams.get('start') ? +searchParams.get('start')! : undefined;
    if (!startDay) {
      return errorJsonResponse('Fetching launch stats failed. Invalid params.', 400);
    }
    const endDay = searchParams.get('end') ? +searchParams.get('end')! : undefined;
    const stats = await fetchLaunchStats({
      customerId: sessionData.customerId!,
      startDay,
      endDay,
    });
    return json(groupLaunchStats(stats));
  } catch (e) {
    getLogger('route:fetcher.launch-stats').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching launch stats failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
