import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { fetchInitiativeStats } from '../firestore.server/fetchers.server';
import { groupInitiativeStats, type GroupedInitiativeStats } from '../processors/initiativeGrouper';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export type GroupedInitiativeStatsResponse = { error?: ErrorField } & GroupedInitiativeStats;

export const shouldRevalidate = () => false;

const VIEW = View.FetcherInitiativeStats;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<GroupedInitiativeStatsResponse>> => {
  let sessionData;
  try {
    sessionData = await loadAndValidateSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching initiative stats failed. Invalid session.', 401);
  }
  try {
    const { searchParams } = new URL(request.url);
    const startDay = searchParams.get('start') ? +searchParams.get('start')! : undefined;
    if (!startDay) {
      return errorJsonResponse('Fetching initiative stats failed. Invalid params.', 400);
    }
    const endDay = searchParams.get('end') ? +searchParams.get('end')! : undefined;
    const stats = await fetchInitiativeStats({
      customerId: sessionData.customerId!,
      startDay,
      endDay,
    });
    return json(groupInitiativeStats(stats));
  } catch (e) {
    getLogger('route:fetcher.initiative-stats').error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching initiative stats failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
