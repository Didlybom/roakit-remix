import {
  Science as ScienceIcon,
  EditCalendar as StatusIcon,
  EditNote as SummaryIcon,
} from '@mui/icons-material';
import {
  Alert,
  FormControl,
  FormControlLabel,
  FormLabel,
  Link,
  List,
  ListItem,
  ListItemText,
  Radio,
  RadioGroup,
} from '@mui/material';
import { useLoaderData } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import { useState } from 'react';
import App from '../components/App';
import SmallButton from '../components/SmallButton';
import { fetchIdentities } from '../firestore.server/fetchers.server';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { HEADER_HEIGHT, loaderErrorResponse } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';

export const meta = () => [{ title: 'Impersonation | ROAKIT' }];

const VIEW = View.Impersonation;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW);
  try {
    const identities = await fetchIdentities(sessionData.customerId!);
    return { ...sessionData, identities };
  } catch (e) {
    getLogger('route:impersonation').error(e);
    throw loaderErrorResponse(e);
  }
};

export default function Impersonation() {
  const loaderData = useLoaderData<typeof loader>();
  const [route, setRoute] = useState('status');

  return (
    <App view={VIEW} isLoggedIn={true} role={loaderData.role} isNavOpen={loaderData.isNavOpen}>
      <Alert severity="info" icon={<ScienceIcon />} sx={{ m: 3 }}>
        This page is for experimenting by letting admins impersonate contributors. Logged-in
        contributors will land directly on their{' '}
        <SmallButton href="/status/" label="Status" icon={<StatusIcon fontSize="small" />} /> or{' '}
        <SmallButton href="/summary/" label="Summary" icon={<SummaryIcon fontSize="small" />} />, as
        when you click on a name here.
      </Alert>
      <FormControl sx={{ mx: 3, mt: 2, mb: 1 }}>
        <FormLabel sx={{ fontSize: 'small' }}>Links go to:</FormLabel>
        <RadioGroup
          row
          value={route}
          onChange={e => setRoute(e.target.value)}
          sx={{ '& .MuiFormControlLabel-label': { fontSize: 'small' } }}
        >
          <FormControlLabel value="status" control={<Radio />} label="Status Form" />
          <FormControlLabel value="summary" control={<Radio />} label="Summary Form" />
        </RadioGroup>
      </FormControl>
      <List
        sx={{
          mx: 2,
          maxHeight: `calc(100vh - ${HEADER_HEIGHT + 170}px)`,
          display: 'flex',
          flexFlow: 'column wrap',
          '& .MuiListItem-root': { py: 0, width: 'auto' },
        }}
      >
        {loaderData.identities.list.map((identity, i) => (
          <ListItem key={i}>
            <ListItemText>
              <Link href={`/${route}/${encodeURI(identity.id)}`} fontSize="small">
                {identity.displayName}
              </Link>
            </ListItemText>
          </ListItem>
        ))}
      </List>
    </App>
  );
}
