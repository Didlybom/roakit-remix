import { Unstable_Grid2 as Grid } from '@mui/material';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import packageJson from '../../package.json';
import App from '../components/App';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const meta = () => [{ title: 'Version Info | ROAKIT' }];

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Info() {
  const sessionData = useLoaderData<typeof loader>();

  return (
    <App view="info" isLoggedIn={sessionData.isLoggedIn} isNavOpen={sessionData.isNavOpen}>
      <Grid container spacing={2} sx={{ display: 'flex', flex: 1, minWidth: 0, m: 4 }}>
        <Grid>
          <Grid>
            <strong>Version</strong>
          </Grid>
          <Grid>
            <strong>Email</strong>
          </Grid>
          <Grid>
            <strong>Customer ID</strong>
          </Grid>
          <Grid>
            <strong>Date Filter</strong>
          </Grid>
          <Grid>
            <strong>IsNavOpen</strong>
          </Grid>
        </Grid>
        <Grid>
          <Grid>{packageJson.version}</Grid>
          <Grid>{sessionData.email}</Grid>
          <Grid>{sessionData.customerId}</Grid>
          <Grid>{sessionData.dateFilter}</Grid>
          <Grid>{`${sessionData.isNavOpen}`}</Grid>
        </Grid>
      </Grid>
    </App>
  );
}
