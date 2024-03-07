import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import NotificationImportantIcon from '@mui/icons-material/NotificationImportant';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Toolbar,
  Typography,
  styled,
} from '@mui/material';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import { DateRange } from '~/utils/dateUtils';
import { disabledSelectedSx } from '../utils/theme';
import { View } from './App';
import DateRangePicker from './DateRangePicker';

interface AppBarProps extends MuiAppBarProps {
  navbarWidth: number;
  navbarOpen?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: prop => prop !== 'navbarWidth' && prop !== 'navbarOpen',
})<AppBarProps>(({ theme, navbarWidth, navbarOpen }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(navbarOpen && {
    width: `calc(100% - ${navbarWidth}px)`,
    marginLeft: `${navbarWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

export default function App({
  isLoggedIn,
  view,
  dateRange,
  onDateRangeSelect,
  showProgress,
  navbarWidth,
  open: isNavBarOpen,
  onNavBarOpen,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  onDateRangeSelect?: (dateRange: DateRange) => void;
  showProgress?: boolean;
  navbarWidth: number;
  open?: boolean;
  onNavBarOpen: () => void;
}) {
  return (
    <AppBar position="fixed" navbarWidth={navbarWidth} navbarOpen={isNavBarOpen}>
      <Toolbar variant="dense">
        <IconButton
          color="inherit"
          onClick={onNavBarOpen}
          edge="start"
          sx={{ mr: 2, ...(isNavBarOpen && { display: 'none' }) }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" sx={{ display: { xs: 'none', sm: 'flex' } }}>
          ROAKIT
        </Typography>
        <Typography variant="h6" sx={{ display: { xs: 'flex', sm: 'none' } }}>
          RKT
        </Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Box sx={{ flex: 1, ml: 2 }}>
              {dateRange && onDateRangeSelect && (
                <DateRangePicker dateRange={dateRange} onDateRangeSelect={onDateRangeSelect} />
              )}
            </Box>
            <IconButton
              href="/activity/review"
              title="Review Activity"
              disabled={!isLoggedIn || view === 'activity.review'}
              color="inherit"
              sx={{
                display: { xs: 'flex', sm: 'none' },
                ...(isLoggedIn && { ...disabledSelectedSx }),
              }}
            >
              <NotificationImportantIcon />
            </IconButton>
            <Button
              href="/activity/review"
              title="Review Activity"
              disabled={!isLoggedIn || view === 'activity.review'}
              color="inherit"
              startIcon={<NotificationImportantIcon />}
              sx={{
                mx: 2,
                display: { xs: 'none', sm: 'flex' },
                ...(isLoggedIn && { ...disabledSelectedSx }),
              }}
            >
              Review
            </Button>

            <IconButton
              href="/settings"
              title="Settings"
              disabled={!isLoggedIn || view === 'settings'}
              color="inherit"
              sx={{
                display: { xs: 'flex', sm: 'none' },
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
                display: { xs: 'none', sm: 'flex' },
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
