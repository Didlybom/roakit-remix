import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchAllSummaries, fetchSummaries } from '../firestore.server/fetchers.server';
import type { DaySummaries, Summary } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.summaries' });

const ALL = '*';

export interface SummariesResponse {
  error?: ErrorField;
  summaries?: DaySummaries;
  allSummaries?: Summary[];
}

export const shouldRevalidate = () => false;

export const loader = async ({
  params,
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<SummariesResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return errorJsonResponse('Fetching summaries failed. Invalid session.', 401);
  }
  if (!params.userid) {
    return errorJsonResponse('Fetching summaries failed. Invalid params.', 400);
  }
  const { searchParams } = new URL(request.url);
  const day = searchParams.get('day') ?? undefined;
  const month = searchParams.get('month') ?? undefined;
  if ((!day && !month) || (day && month) || (params.userId === ALL && !day)) {
    return errorJsonResponse('Fetching summaries failed. Invalid params.', 400);
  }
  try {
    return jsonResponse(
      params.userid === ALL ?
        { allSummaries: await fetchAllSummaries(sessionData.customerId!, day!) }
      : { summaries: await fetchSummaries(sessionData.customerId!, params.userid, { day, month }) }
    );
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching summaries failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
