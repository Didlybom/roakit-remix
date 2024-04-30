import { Science as ScienceIcon } from '@mui/icons-material';
import { Alert, Box, Link, List, ListItem, ListItemText } from '@mui/material';
import { redirect, useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import App from '../components/App';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';

const logger = pino({ name: 'route:summaries.edit' });

export const meta = () => [{ title: 'Summaries | ROAKIT' }];

// verify JWT, load identities
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    return { ...sessionData, identities };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function SummariesEdit() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <App isLoggedIn={true} isNavOpen={loaderData.isNavOpen} view="summary.user">
      <Box sx={{ m: 3 }}>
        <Alert severity="info" icon={<ScienceIcon />}>
          This page is for experimenting. Logged-in users will land directly on their Summary page,
          as when you click on a user here.
        </Alert>
        <List
          sx={{
            maxHeight: 'calc(100vh - 200px)',
            display: 'flex',
            flexFlow: 'column wrap',
            '& .MuiListItem-root': { py: 0, width: 'auto' },
          }}
        >
          {loaderData.identities.list.map((identity, i) => (
            <ListItem key={i}>
              <ListItemText>
                <Link href={`/summary/user/${encodeURI(identity.id)}`}>{identity.displayName}</Link>
              </ListItemText>
            </ListItem>
          ))}
        </List>
      </Box>
    </App>
  );
}
