import { LoaderFunctionArgs, TypedResponse } from '@remix-run/server-runtime';
import pino from 'pino';
import {
  fetchAccountMap,
  fetchActivities,
  fetchIdentities,
} from '../firestore.server/fetchers.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts } from '../schemas/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { RoakitError, errMsg } from '../utils/errorUtils';
import { ErrorField, errorJsonResponse, jsonResponse } from '../utils/httpUtils';

const logger = pino({ name: 'route:fetcher.summary' });

export interface SummaryResponse {
  error?: ErrorField;
  summary?: string;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<SummaryResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return errorJsonResponse('Summary failed. Invalid session', 401);
  }
  try {
    // retrieve initiatives and users
    const [accounts, identities] = await Promise.all([
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate: dateFilterToStartDate(DateRange.OneDay)!,
      includesMetadata: true,
    });
    const prompt =
      DEFAULT_PROMPT +
      '\n\n' +
      buildActivitySummaryPrompt(
        [...activities].map(([, activity]) => activity),
        actors,
        100,
        true,
        true,
        true
      );
    const content = await generateContent({ prompt });
    if (!content) {
      return errorJsonResponse('Summary failed. Empty response', 500);
    }
    const summary = getSummaryResult(content);
    return jsonResponse({ summary });
  } catch (e) {
    logger.error(e);
    return errorJsonResponse(
      errMsg(e, 'Summary failed'),
      e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500
    );
  }
};
