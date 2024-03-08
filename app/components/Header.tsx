import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
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
import { View } from './App';
import DateRangePicker from './DateRangePicker';

interface AppBarProps extends MuiAppBarProps {
  navbarWidth: number;
  navbarOpen?: boolean;
}

// see https://mui.com/material-ui/react-drawer/#persistent-drawer
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

export default function Header({
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
        {isLoggedIn && (
          <IconButton
            color="inherit"
            onClick={onNavBarOpen}
            edge="start"
            sx={{ mr: 2, ...(isNavBarOpen && { display: 'none' }) }}
          >
            <MenuIcon />
          </IconButton>
        )}
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
              href="/settings"
              title="Settings"
              color="inherit"
              sx={{ display: { xs: 'flex', sm: 'none' } }}
            >
              <SettingsIcon />
            </IconButton>
            <Button
              href="/settings"
              onClick={e => {
                if (view === 'settings') {
                  e.preventDefault();
                }
              }}
              title="Settings"
              color="inherit"
              startIcon={<SettingsIcon />}
              sx={{ mx: 2, display: { xs: 'none', sm: 'flex' } }}
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
