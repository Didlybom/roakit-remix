import type { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import {
  fetchAllSummaries,
  fetchSummaries,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import type { DaySummaries, Summary } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import type { ErrorField } from '../utils/httpUtils';
import { errorJsonResponse } from '../utils/httpUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

const logger = getLogger('route:fetcher.summaries');

const ALL = '*';

export interface SummariesResponse {
  error?: ErrorField;
  summaries?: DaySummaries;
  allSummaries?: Summary[];
}

export const shouldRevalidate = () => false;

const VIEW = View.FetcherSummaries;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<SummariesResponse>> => {
  let sessionData;
  try {
    sessionData = await loadSession(request, VIEW, params);
  } catch (e) {
    return errorJsonResponse('Fetching summaries failed. Invalid session.', 401);
  }
  let userId = params.userid; // impersonification, or ALL
  if (!userId) {
    const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
    userId = identity.id;
  }
  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day') ?? undefined;
  const month = searchParams.get('month') ?? undefined;
  if ((!day && !month) || (day && month) || (userId === ALL && !day)) {
    return errorJsonResponse('Fetching summaries failed. Invalid params.', 400);
  }
  try {
    return json(
      userId === ALL ?
        { allSummaries: await fetchAllSummaries(sessionData.customerId!, day!) }
      : { summaries: await fetchSummaries(sessionData.customerId!, userId, { day, month }) }
    );
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching summaries failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
