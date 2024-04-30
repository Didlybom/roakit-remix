import { Typography } from '@mui/material';
import { redirect, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import App from '../components/App';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { identifyAccounts } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import type { SessionData } from '../utils/sessionCookie.server';

const logger = pino({ name: 'route:summaries' });

export const meta = () => [{ title: 'Summaries | ROAKIT' }];

// verify JWT, load users
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errorResponse = (sessionData: SessionData, error: string) => ({
    ...sessionData,
    error,
    actors: null,
  });
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve  users
    const [accounts, identities] = await Promise.all([
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    return {
      ...sessionData,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
    };
  } catch (e) {
    logger.error(e);
    return errorResponse(sessionData, 'Failed to fetch users');
  }
};

export default function Summaries() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <App isLoggedIn={true} isNavOpen={loaderData.isNavOpen} view="summaries">
      <Typography sx={{ m: 3 }}>Under construction</Typography>
    </App>
  );
}
