import GitHubIcon from '@mui/icons-material/GitHub';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, Box, Button, Stack, SvgIcon, Toolbar, Typography } from '@mui/material';
import JiraIcon from '../icons/Jira';
import { disabledSelectedSx } from './theme';

type View = 'github' | 'jira' | 'settings' | 'login' | 'logout';

export default function Heaader({ isLoggedIn, view }: { isLoggedIn: boolean; view: View }) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ display: { xs: 'none', md: 'flex' } }}>
          ROAKIT
        </Typography>
        <Typography variant="h6" sx={{ display: { xs: 'flex', md: 'none' } }}>
          RKT
        </Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Stack direction="row" sx={{ flexGrow: 1, ml: 2 }}>
              <Button
                href="/github"
                title="GitHub capture"
                disabled={!isLoggedIn || view === 'github'}
                variant="text"
                color="inherit"
                sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                startIcon={<GitHubIcon />}
              >
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>GitHub</Box>
              </Button>
              <Button
                href="/jira"
                title="Jira capture"
                disabled={!isLoggedIn || view === 'jira'}
                variant="text"
                color="inherit"
                sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                startIcon={<SvgIcon component={JiraIcon} />}
              >
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>Jira</Box>
              </Button>
            </Stack>
            <Button
              href="/settings"
              title="Settings"
              disabled={!isLoggedIn || view === 'settings'}
              color="inherit"
              startIcon={<SettingsIcon />}
              sx={{ ml: 2, mr: 2, ...(isLoggedIn && { ...disabledSelectedSx }) }}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>Settings</Box>
            </Button>
            {!isLoggedIn && (
              <Button href="/login" title=":Login" color="inherit" startIcon={<LoginIcon />}>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>Login</Box>
              </Button>
            )}
            {isLoggedIn && (
              <Button href="/logout" title="Logout" color="inherit" startIcon={<LogoutIcon />}>
                <Box sx={{ display: { xs: 'none', md: 'block' } }}>Logout</Box>
              </Button>
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
