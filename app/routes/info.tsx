import Grid from '@mui/material/Grid';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import packageJson from '../../package.json';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';

export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Info() {
  const sessionData = useLoaderData<typeof loader>();

  return (
    <Grid container spacing={2}>
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
  );
}
