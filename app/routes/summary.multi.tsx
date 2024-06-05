import { Science as ScienceIcon, EditNote as SummaryIcon } from '@mui/icons-material';
import { Alert, Link, List, ListItem, ListItemText } from '@mui/material';
import { useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import pino from 'pino';
import App from '../components/App';
import SmallButton from '../components/SmallButton';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { loadSession } from '../utils/authUtils.server';
import { View } from '../utils/rbac';

const logger = pino({ name: 'route:summaries.edit' });

export const meta = () => [{ title: 'Summaries | ROAKIT' }];

const VIEW = View.SummaryMulti;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
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
    <App view={VIEW} isLoggedIn={true} role={loaderData.role} isNavOpen={loaderData.isNavOpen}>
      <Alert severity="info" icon={<ScienceIcon />}>
        This entry page is for experimenting by impersonating contributors. Logged-in contributors
        will land directly on their{' '}
        <SmallButton
          href="/summary/"
          label="Summary Form"
          icon={<SummaryIcon fontSize="small" />}
        />
        , as when you click on a user here.
      </Alert>
      <List
        sx={{
          m: 2,
          maxHeight: 'calc(100vh - 200px)',
          display: 'flex',
          flexFlow: 'column wrap',
          '& .MuiListItem-root': { py: 0, width: 'auto' },
        }}
      >
        {loaderData.identities.list.map((identity, i) => (
          <ListItem key={i}>
            <ListItemText>
              <Link href={`/summary/${encodeURI(identity.id)}`} fontSize="small">
                {identity.displayName}
              </Link>
            </ListItemText>
          </ListItem>
        ))}
      </List>
    </App>
  );
}
