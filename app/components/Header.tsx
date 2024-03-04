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
  useMediaQuery,
  useTheme,
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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down('md'), { noSsr: true });

  return (
    <AppBar position="static">
      <Toolbar variant="dense">
        <Typography variant="h6">{isSmallScreen ? 'RKT' : 'ROAKIT'}</Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Stack direction="row" alignItems="center" sx={{ flexGrow: 1, ml: 2 }}>
              {isSmallScreen ?
                <IconButton
                  href="/github"
                  title="GitHub capture"
                  disabled={!isLoggedIn || view === 'github'}
                  color="inherit"
                  sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                >
                  <GitHubIcon />
                </IconButton>
              : <Button
                  href="/github"
                  title="GitHub capture"
                  disabled={!isLoggedIn || view === 'github'}
                  variant="text"
                  color="inherit"
                  sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                  startIcon={<GitHubIcon />}
                >
                  GitHub
                </Button>
              }
              {isSmallScreen ?
                <IconButton
                  href="/jira"
                  title="Jira capture"
                  disabled={!isLoggedIn || view === 'jira'}
                  color="inherit"
                  sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                >
                  <SvgIcon component={JiraIcon} />
                </IconButton>
              : <Button
                  href="/jira"
                  title="Jira capture"
                  disabled={!isLoggedIn || view === 'jira'}
                  variant="text"
                  color="inherit"
                  sx={isLoggedIn ? { ...disabledSelectedSx } : undefined}
                  startIcon={<SvgIcon component={JiraIcon} />}
                >
                  Jira
                </Button>
              }
              {dateRange && onDateRangeSelect && (
                <DateRangePicker dateRange={dateRange} onDateRangeSelect={onDateRangeSelect} />
              )}
            </Stack>
            {isSmallScreen ?
              <IconButton
                href="/settings"
                title="Settings"
                disabled={!isLoggedIn || view === 'settings'}
                color="inherit"
                sx={{
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
              >
                <SettingsIcon />
              </IconButton>
            : <Button
                href="/settings"
                title="Settings"
                disabled={!isLoggedIn || view === 'settings'}
                color="inherit"
                startIcon={<SettingsIcon />}
                sx={{
                  mx: 2,
                  ...(isLoggedIn && { ...disabledSelectedSx }),
                }}
              >
                Settings
              </Button>
            }
            {!isLoggedIn && isSmallScreen && (
              <IconButton href="/login" title="Login" color="inherit">
                <LoginIcon />
              </IconButton>
            )}
            {!isLoggedIn && !isSmallScreen && (
              <Button href="/login" title="Login" color="inherit" startIcon={<LoginIcon />}>
                Login
              </Button>
            )}
            {isLoggedIn && isSmallScreen && (
              <IconButton href="/logout" title="Logout" color="inherit">
                <LogoutIcon />
              </IconButton>
            )}
            {isLoggedIn && !isSmallScreen && (
              <Button href="/logout" title="Logout" color="inherit" startIcon={<LogoutIcon />}>
                Logout
              </Button>
            )}
          </>
        )}
      </Toolbar>
      {showProgress && <LinearProgress sx={{ mt: '-4px' }} />}
    </AppBar>
  );
}
