import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import Header from '~/components/Header';
import packageJson from '../../package.json';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Info() {
  const sessionData = useLoaderData<typeof loader>();

  return (
    <>
      <Header isLoggedIn={sessionData.isLoggedIn} view="info" />
      <Grid container spacing={2} sx={{ m: 4 }}>
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
        </Grid>
        <Grid>
          <Grid>{packageJson.version}</Grid>
          <Grid>{sessionData.email}</Grid>
          <Grid>{sessionData.customerId}</Grid>
        </Grid>
      </Grid>
    </>
  );
}
