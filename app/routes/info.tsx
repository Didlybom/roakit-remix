import { Grid2 as Grid } from '@mui/material';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import packageJson from '../../package.json';
import App from '../components/App';
import { View } from '../utils/rbac';
import type { SessionData } from '../utils/sessionCookie.server';
import { getSessionData } from '../utils/sessionCookie.server';

export const meta = () => [{ title: 'Version Info | ROAKIT' }];

const VIEW = View.Info;

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> =>
  await getSessionData(request);

export default function Info() {
  const loaderData = useLoaderData<typeof loader>();

  return (
    <App
      view={VIEW}
      isLoggedIn={loaderData.isLoggedIn}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
    >
      <Grid container spacing={2} sx={{ display: 'flex', flex: 1, minWidth: 0, m: 4 }}>
        <Grid>
          <Grid>
            <strong>Version</strong>
          </Grid>
          <Grid>
            <strong>Email</strong>
          </Grid>
          <Grid>
            <strong>Role</strong>
          </Grid>
          <Grid>
            <strong>Customer ID</strong>
          </Grid>
          <Grid>
            <strong>Date Filter</strong>
          </Grid>
        </Grid>
        <Grid>
          <Grid>{packageJson.version}</Grid>
          <Grid>{loaderData.email}</Grid>
          <Grid>{loaderData.role}</Grid>
          <Grid>{loaderData.customerId}</Grid>
          <Grid>
            {loaderData.dateFilter?.dateRange} {loaderData.dateFilter?.endDay}
          </Grid>
        </Grid>
      </Grid>
    </App>
  );
}
