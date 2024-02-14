import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Button, Stack, Typography } from '@mui/material';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { SessionData, getSessionData } from '~/utils/session-cookie.server';

// verify session
export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

export default function Heaader() {
  const sessionData = useLoaderData<typeof loader>();
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Stack direction="row" spacing={2}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          ROAKIT
        </Typography>
        <Button
          href="/settings"
          disabled={!sessionData.isLoggedIn}
          variant="contained"
          startIcon={<SettingsIcon />}
        >
          Settings
        </Button>
        {!sessionData.isLoggedIn && (
          <Button href="/login" variant="outlined" startIcon={<LoginIcon />}>
            Login
          </Button>
        )}
        {sessionData.isLoggedIn && (
          <Button href="/logout" variant="outlined" startIcon={<LogoutIcon />}>
            Logout
          </Button>
        )}
      </Stack>
    </Box>
  );
}
