import { LoaderFunctionArgs, redirect } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { GITHUB_FEED_TYPE, JIRA_FEED_TYPE } from '../utils/feedUtils';
import { contentLength } from '../utils/httpUtils';

const logger = pino({ name: 'route:users.csv' });

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    let csv = 'ID,managerID,email,jiraID,jiraName,githubUsername\n';
    identities.list.forEach(identity => {
      csv += identity.id + ',' + (identity.managerId ?? '') + ',';
      csv += (identity.email ?? '') + ',';
      const jiraAccount = identity.accounts.find(account => account.type === JIRA_FEED_TYPE);
      const githubAccount = identity.accounts.find(account => account.type === GITHUB_FEED_TYPE);
      csv += (jiraAccount?.id ?? '') + ',' + (jiraAccount?.name ?? '') + ',';
      csv += (githubAccount?.id ?? '') + '\n';
    });
    const date = new Date().toLocaleDateString().replaceAll('/', '-');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment;filename="ROAKIT_identities_' + date + '.csv"',
        'Content-Length': `${contentLength(csv)}`,
      },
    });
  } catch (e) {
    logger.error(e);
    throw e;
  }
};
