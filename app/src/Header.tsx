import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Button, Stack, Typography } from '@mui/material';

export default function Heaader({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <Box sx={{ flexGrow: 1 }}>
      <Stack direction="row" spacing={2}>
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          ROAKIT
        </Typography>
        <Button
          href="/settings"
          disabled={!isLoggedIn}
          variant="contained"
          startIcon={<SettingsIcon />}
        >
          Settings
        </Button>
        {!isLoggedIn && (
          <Button href="/login" variant="outlined" startIcon={<LoginIcon />}>
            Login
          </Button>
        )}
        {isLoggedIn && (
          <Button href="/logout" variant="outlined" startIcon={<LogoutIcon />}>
            Logout
          </Button>
        )}
      </Stack>
    </Box>
  );
}
