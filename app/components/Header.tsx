import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import {
  AppBar,
  AppBarProps,
  Box,
  Button,
  IconButton,
  LinearProgress,
  Toolbar,
  Typography,
  styled,
} from '@mui/material';
import { DateRange } from '../utils/dateUtils';
import { View } from './App';
import DateRangePicker from './DateRangePicker';

interface NavBarProps extends AppBarProps {
  navbarWidth: number;
  navbarOpen?: boolean;
}

// see https://mui.com/material-ui/react-drawer/#persistent-drawer
const NavBar = styled(AppBar, {
  shouldForwardProp: prop => prop !== 'navbarWidth' && prop !== 'navbarOpen',
})<NavBarProps>(({ theme, navbarWidth, navbarOpen }) => ({
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
  navbarOpen: isNavBarOpen,
  onNavBarOpen,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  onDateRangeSelect?: (dateRange: DateRange) => void;
  showProgress?: boolean;
  navbarWidth: number;
  navbarOpen?: boolean;
  onNavBarOpen: () => void;
}) {
  return (
    <NavBar
      position="fixed"
      navbarWidth={navbarWidth}
      navbarOpen={isNavBarOpen}
      sx={{ zIndex: theme => theme.zIndex.drawer + 1 }}
    >
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
        <Typography fontWeight={500} display={{ xs: 'none', sm: 'flex' }}>
          ROAKIT
        </Typography>
        <Typography fontWeight={500} display={{ xs: 'flex', sm: 'none' }}>
          RKT
        </Typography>
        {view !== 'login' && view !== 'logout' && (
          <>
            <Box flex={1} ml={2}>
              {dateRange && onDateRangeSelect && (
                <DateRangePicker dateRange={dateRange} onSelect={onDateRangeSelect} />
              )}
            </Box>
            {isLoggedIn && (
              <>
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
              </>
            )}
            {!isLoggedIn && (
              <>
                <IconButton
                  href="/login"
                  title="Login"
                  color="inherit"
                  sx={{ display: { xs: 'flex', sm: 'none' } }}
                >
                  <LoginIcon />
                </IconButton>
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
                </IconButton>
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
    </NavBar>
  );
}
