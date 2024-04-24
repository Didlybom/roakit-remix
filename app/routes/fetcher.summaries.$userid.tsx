import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchSummary } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.top-contributors' });

export interface SummariesResponse {
  error?: ErrorField;
  aiSummary?: string;
  userSummary?: string;
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
  const day = searchParams.get('day');
  if (!day) {
    return errorJsonResponse('Fetching summaries failed. Invalid params.', 400);
  }
  try {
    return jsonResponse((await fetchSummary(sessionData.customerId!, params.userid, day)) ?? {});
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Fetching summaries failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
