import {
  Login as LoginIcon,
  Logout as LogoutIcon,
  Menu as MenuIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import type { AppBarProps } from '@mui/material';
import { AppBar, Box, IconButton, LinearProgress, Stack, Toolbar, styled } from '@mui/material';
import dayjs from 'dayjs';
import RoakitIcon from '../../icons/Roakit';
import { isToday, type DateRangeEnding } from '../../utils/dateUtils';
import { Role, View } from '../../utils/rbac';
import DateRangePicker from '../DateRangePicker';

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
  onDateRangeRefresh,
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
  onDateRangeRefresh?: () => void;
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
          <RoakitIcon width="51px" height="20px" />
        </Box>
        {view !== View.Login && view !== View.Logout && (
          <>
            <Stack direction="row" flex={1} mr={2}>
              {dateRange && onDateRangeSelect && (
                <DateRangePicker
                  dateRange={dateRange.dateRange}
                  endDay={dayjs(dateRange.endDay)}
                  onSelect={onDateRangeSelect}
                />
              )}
              {dateRange && isToday(dayjs(dateRange.endDay)) && onDateRangeRefresh && (
                <IconButton
                  color="inherit"
                  onClick={onDateRangeRefresh}
                  title="Fetch new activities"
                  sx={{ display: { xs: 'none', sm: 'flex' } }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              )}
            </Stack>
            {isLoggedIn && role === Role.Admin && (
              <IconButton
                href="/settings"
                onClick={e => {
                  if (view === View.Settings) {
                    e.preventDefault();
                  }
                }}
                title="Settings"
                color="inherit"
              >
                <SettingsIcon />
              </IconButton>
            )}
            {!isLoggedIn && (
              <IconButton href="/login" title="Login" color="inherit">
                <LoginIcon />
              </IconButton>
            )}
            {isLoggedIn && (
              <IconButton href="/logout" title="Logout" color="inherit">
                <LogoutIcon />
              </IconButton>
            )}
          </>
        )}
      </Toolbar>
      {showProgress && <LinearProgress sx={{ mt: '-4px' }} />}
    </NavBar>
  );
}
