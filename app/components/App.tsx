import { Box, styled } from '@mui/material';
import { ReactNode, useState } from 'react';
import { DateRange } from '../utils/dateUtils';
import { postJson } from '../utils/httpUtils';
import Header from './Header';
import NavDrawer from './NavDrawer';
import DrawerHeader from './NavDrawerHeader';

const navbarWidth = 170;

export type View =
  | 'dashboard'
  | 'activity'
  | 'activity.user'
  | 'summary.user'
  | 'github'
  | 'jira'
  | 'initiatives'
  | 'users'
  | 'settings'
  | 'login'
  | 'logout'
  | 'info';

const Main = styled('main', { shouldForwardProp: prop => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  minWidth: 0,
  // padding: theme.spacing(3),
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${navbarWidth}px`,
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

export default function App({
  isLoggedIn,
  view,
  dateRange,
  onDateRangeSelect,
  showProgress,
  showPulse,
  isNavOpen,
  children,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  onDateRangeSelect?: (dateRange: DateRange) => void;
  showProgress?: boolean;
  showPulse?: boolean;
  isNavOpen?: boolean;
  children?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(isLoggedIn ? isNavOpen ?? true : false);

  const toggleNavBar = async (isNavOpen: boolean) => {
    setIsOpen(isNavOpen);
    await postJson('/set-cookie', { isNavOpen });
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Header
        isLoggedIn={isLoggedIn}
        view={view}
        dateRange={dateRange}
        onDateRangeSelect={onDateRangeSelect}
        showProgress={showProgress}
        navbarWidth={navbarWidth}
        navbarOpen={isOpen}
        onNavBarOpen={() => toggleNavBar(true)}
      />
      <NavDrawer
        view={view}
        width={navbarWidth}
        showPulse={showPulse}
        open={isOpen}
        onClose={() => toggleNavBar(false)}
      />
      <Main open={isOpen}>
        <DrawerHeader />
        {children}
      </Main>
    </Box>
  );
}
