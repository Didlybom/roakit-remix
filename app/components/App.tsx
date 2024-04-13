import { Box, styled } from '@mui/material';
import { useFetcher } from '@remix-run/react';
import { ReactNode } from 'react';
import { AppJsonRequest, postJsonOptions } from '../appActions';
import { DateRange } from '../utils/dateUtils';
import Header from './Header';
import NavDrawer from './NavDrawer';
import DrawerHeader from './NavDrawerHeader';

const navbarWidth = 180;

export type View =
  | 'dashboard'
  | 'activity'
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
  showProgress,
  showPulse,
  isNavOpen,
  children,
}: {
  isLoggedIn: boolean;
  view: View;
  dateRange?: DateRange;
  showProgress?: boolean;
  showPulse?: boolean;
  isNavOpen?: boolean;
  children?: ReactNode;
}) {
  const fetcher = useFetcher();
  let isOpen = isLoggedIn ? isNavOpen ?? true : false;
  // optimistic UI optimization, the setting is stored via appActions.tsx
  const jsonRequest = fetcher.json as AppJsonRequest;
  if (jsonRequest?.app?.isNavOpen != null) {
    isOpen = jsonRequest.app.isNavOpen;
  }

  return (
    <Box sx={{ display: 'flex' }}>
      <Header
        isLoggedIn={isLoggedIn}
        view={view}
        dateRange={dateRange}
        showProgress={showProgress}
        navbarWidth={navbarWidth}
        navbarOpen={isOpen}
        onNavBarOpen={() => fetcher.submit({ app: { isNavOpen: true } }, postJsonOptions)}
      />
      <NavDrawer
        view={view}
        width={navbarWidth}
        showPulse={showPulse}
        open={isOpen}
        onClose={() => fetcher.submit({ app: { isNavOpen: false } }, postJsonOptions)}
      />
      <Main open={isOpen}>
        <DrawerHeader />
        {children}
      </Main>
    </Box>
  );
}
