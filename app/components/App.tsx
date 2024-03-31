import { Box, styled } from '@mui/material';
import { useFetcher } from '@remix-run/react';
import { ReactNode } from 'react';
import { DateRange } from '../utils/dateUtils';
import Header from './Header';
import NavDrawer from './NavDrawer';
import DrawerHeader from './NavDrawerHeader';

const navbarWidth = 180;

export type View =
  | 'dashboard'
  | 'activity.review'
  | 'activity.user'
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
  isNavOpen,
  children,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  onDateRangeSelect?: (dateRange: DateRange) => void;
  showProgress?: boolean;
  isNavOpen?: boolean;
  children?: ReactNode;
}) {
  const fetcher = useFetcher();
  let isOpen = !!isNavOpen;
  if (fetcher.formData?.has('isNavOpen')) {
    isOpen = fetcher.formData.get('isNavOpen') === 'true';
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Header
        isLoggedIn={isLoggedIn}
        view={view}
        dateRange={dateRange}
        onDateRangeSelect={onDateRangeSelect}
        showProgress={showProgress}
        navbarWidth={navbarWidth}
        open={isLoggedIn ? isOpen : false}
        onNavBarOpen={() => fetcher.submit({ isNavOpen: true }, { method: 'post' })}
      />
      <NavDrawer
        view={view}
        width={navbarWidth}
        open={isOpen}
        onClose={() => fetcher.submit({ isNavOpen: false }, { method: 'post' })}
      />
      <Main open={isOpen}>
        <DrawerHeader />
        {children}
      </Main>
    </Box>
  );
}
