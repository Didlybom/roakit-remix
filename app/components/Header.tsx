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
  styled,
} from '@mui/material';
import dayjs from 'dayjs';
import RoakitIcon from '../icons/Roakit';
import { type DateRangeEnding } from '../utils/dateUtils';
import { Role, View } from '../utils/rbac';
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
  role,
  view,
  dateRange,
  onDateRangeSelect,
  showProgress,
  navbarWidth,
  navbarOpen: isNavBarOpen,
  onNavBarOpen,
}: {
  isLoggedIn: boolean;
  role: Role;
  view: View;
  dateRange?: DateRangeEnding;
  onDateRangeSelect?: (dateRangeEnding: DateRangeEnding) => void;
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
        <Box title="Roakit" mr={2} display={{ xs: 'none', sm: 'flex' }}>
          <RoakitIcon width="50px" height="22px" />
        </Box>
        {view !== View.Login && view !== View.Logout && (
          <>
            <Box flex={1} mr={2}>
              {dateRange && onDateRangeSelect && (
                <DateRangePicker
                  dateRange={dateRange.dateRange}
                  endDay={dayjs(dateRange.endDay)}
                  onSelect={onDateRangeSelect}
                />
              )}
            </Box>
            {isLoggedIn && role === Role.Admin && (
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
                    if (view === View.Settings) {
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
