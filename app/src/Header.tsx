import GitHubIcon from '@mui/icons-material/GitHub';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { AppBar, Box, Button, SvgIcon, Toolbar, Typography } from '@mui/material';
import JiraIcon from '../icons/Jira';
import { disabledSelectedSx } from './theme';

type View = 'github' | 'jira' | 'settings' | 'login' | 'logout';

export default function Heaader({ isLoggedIn, view }: { isLoggedIn: boolean; view: View }) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          ROAKIT
        </Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Button
              href="/github"
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
              disabled={!isLoggedIn || view === 'jira'}
              variant="text"
              color="inherit"
              sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
              startIcon={<SvgIcon component={JiraIcon} />}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>Jira</Box>
            </Button>
            <Button
              href="/settings"
              disabled={!isLoggedIn || view === 'settings'}
              color="inherit"
              startIcon={<SettingsIcon />}
              sx={{ ml: 2, mr: 2, ...(isLoggedIn && { ...disabledSelectedSx }) }}
            >
              <Box sx={{ display: { xs: 'none', md: 'block' } }}>Settings</Box>
            </Button>
            {!isLoggedIn && (
              <Button href="/login" color="inherit" startIcon={<LoginIcon />}>
                Login
              </Button>
            )}
            {isLoggedIn && (
              <Button href="/logout" color="inherit" startIcon={<LogoutIcon />}>
                Logout
              </Button>
            )}
          </>
        )}
      </Toolbar>
    </AppBar>
  );
}
