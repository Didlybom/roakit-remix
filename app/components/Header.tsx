import GitHubIcon from '@mui/icons-material/GitHub';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  AppBar,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  SvgIcon,
  Toolbar,
  Typography,
} from '@mui/material';
import { DateRange } from '~/utils/dateUtils';
import JiraIcon from '../icons/Jira';
import { disabledSelectedSx } from '../utils/theme';
import DateRangePicker from './DateRangePicker';

type View = 'dashboard' | 'github' | 'jira' | 'settings' | 'login' | 'logout' | 'info';

export default function App({
  isLoggedIn,
  view,
  dateRange,
  onDateRangeSelect,
  showProgress,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  onDateRangeSelect?: (dateRange: DateRange) => void;
  showProgress?: boolean;
}) {
  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <Typography variant="h6" sx={{ display: { xs: 'none', sm: 'flex' } }}>
          ROAKIT
        </Typography>
        <Typography variant="h6" sx={{ display: { xs: 'flex', sm: 'none' } }}>
          RKT
        </Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Stack direction="row" alignItems="center" sx={{ flexGrow: 1, ml: 2 }}>
              <IconButton
                href="/github"
                title="GitHub capture"
                disabled={!isLoggedIn || view === 'github'}
                color="inherit"
                sx={{
                  display: { xs: 'flex', sm: 'none' },
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
              >
                <GitHubIcon />
              </IconButton>
              <Button
                href="/github"
                title="GitHub capture"
                disabled={!isLoggedIn || view === 'github'}
                variant="text"
                color="inherit"
                sx={{
                  display: { xs: 'none', sm: 'flex' },
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
                startIcon={<GitHubIcon />}
              >
                GitHub
              </Button>
              <IconButton
                href="/jira"
                title="Jira capture"
                disabled={!isLoggedIn || view === 'jira'}
                color="inherit"
                sx={{
                  display: { xs: 'flex', md: 'none' },
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
              >
                <SvgIcon component={JiraIcon} />
              </IconButton>
              <Button
                href="/jira"
                title="Jira capture"
                disabled={!isLoggedIn || view === 'jira'}
                variant="text"
                color="inherit"
                sx={{
                  display: { xs: 'none', md: 'flex' },
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
                startIcon={<SvgIcon component={JiraIcon} />}
              >
                Jira
              </Button>
              {dateRange && onDateRangeSelect && (
                <DateRangePicker dateRange={dateRange} onDateRangeSelect={onDateRangeSelect} />
              )}
            </Stack>

            <IconButton
              href="/settings"
              title="Settings"
              disabled={!isLoggedIn || view === 'settings'}
              color="inherit"
              sx={{
                display: { xs: 'flex', md: 'none' },
                ...(isLoggedIn && { ...disabledSelectedSx }),
              }}
            >
              <SettingsIcon />
            </IconButton>
            <Button
              href="/settings"
              title="Settings"
              disabled={!isLoggedIn || view === 'settings'}
              color="inherit"
              startIcon={<SettingsIcon />}
              sx={{
                mx: 2,
                display: { xs: 'none', md: 'flex' },
                ...(isLoggedIn && { ...disabledSelectedSx }),
              }}
            >
              Settings
            </Button>

            {!isLoggedIn && (
              <>
                <IconButton
                  href="/login"
                  title="Login"
                  color="inherit"
                  sx={{ display: { xs: 'flex', sm: 'none' } }}
                >
                  <LoginIcon />
                </IconButton>{' '}
                <Button
                  href="/login"
                  title="Login"
                  color="inherit"
                  startIcon={<LoginIcon />}
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                >
                  Login
                </Button>
              </>
            )}

            {isLoggedIn && (
              <>
                <IconButton
                  href="/logout"
                  title="Logout"
                  color="inherit"
                  sx={{ display: { xs: 'flex', sm: 'none' } }}
                >
                  <LogoutIcon />
                </IconButton>{' '}
                <Button
                  href="/logout"
                  title="Logout"
                  color="inherit"
                  startIcon={<LogoutIcon />}
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                >
                  Logout
                </Button>
              </>
            )}
          </>
        )}
      </Toolbar>
      {showProgress && <LinearProgress sx={{ mt: '-4px' }} />}
    </AppBar>
  );
}
