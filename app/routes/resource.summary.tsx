import { LoaderFunctionArgs, TypedResponse, json } from '@remix-run/server-runtime';
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
const logger = pino({ name: 'route:event.view' });

export interface SummaryResponse {
  error?: { message: string };
  summary?: string;
}

export const loader = async ({
  request,
}: LoaderFunctionArgs): Promise<TypedResponse<SummaryResponse>> => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return json({ error: { message: 'Summary failed. Invalid session' } }, { status: 401 });
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
      return json({ error: { message: 'Summary failed. Empty response' } }, { status: 500 });
    }
    const summary = getSummaryResult(content);
    return json({ summary });
  } catch (e) {
    logger.error(e);
    return json(
      { error: { message: errMsg(e, 'Summary failed') } },
      { status: e instanceof RoakitError && e.httpStatus ? e.httpStatus : 500 }
    );
  }
};
