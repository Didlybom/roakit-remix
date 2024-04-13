import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import packageJson from '../../package.json';
import { appActions } from '../appActions';
import App from '../components/App';
import { loadSession } from '../utils/authUtils.server';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const meta = () => [{ title: 'Version Info | ROAKIT' }];

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return await appActions(request);
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
