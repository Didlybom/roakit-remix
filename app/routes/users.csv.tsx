import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { GITHUB_FEED_TYPE, JIRA_FEED_TYPE } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { contentLength } from '../utils/httpUtils';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:users.csv' });

const VIEW = View.UsersCSV;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    let csv = 'ID,email,name,managerID,jiraID,githubUsername\n';
    identities.list.forEach(identity => {
      const jiraAccount = identity.accounts.find(account => account.type === JIRA_FEED_TYPE);
      const githubAccount = identity.accounts.find(account => account.type === GITHUB_FEED_TYPE);
      csv += identity.id + ',' + (identity.email ?? '') + ',';
      csv += (identity.displayName || jiraAccount?.name || '') + ',';
      csv += (identity.managerId ?? '') + ',';
      csv += (jiraAccount?.id ?? '') + ',';
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
