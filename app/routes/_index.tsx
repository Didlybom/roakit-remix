import * as React from 'react';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Button, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth } from '~/firebase.server';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

// verify jwt
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const jwt = await sessionCookie.parse(request.headers.get('Cookie'));
  if (!jwt) {
    return { isLoggedIn: false };
  }
  try {
    await serverAuth.verifySessionCookie(jwt);
    return { isLoggedIn: true };
  } catch (e) {
    return { isLoggedIn: false };
  }
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const data = useLoaderData<typeof loader>();
  return (
    <React.Fragment>
      <Box sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={2}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ROAKIT
          </Typography>
          <Button
            href="/settings"
            disabled={!data.isLoggedIn}
            variant="contained"
            startIcon={<SettingsIcon />}
          >
            Liaison
          </Button>
          {!data.isLoggedIn && (
            <Button href="/login" variant="outlined" startIcon={<LoginIcon />}>
              Login
            </Button>
          )}
          {data.isLoggedIn && (
            <Button href="/logout" variant="outlined" startIcon={<LogoutIcon />}>
              logout
            </Button>
          )}
        </Stack>
      </Box>
      <Typography variant="h6" component="div" sx={{ mt: 10, mb: 10 }}>
        Under construction...
      </Typography>
    </React.Fragment>
  );
}
