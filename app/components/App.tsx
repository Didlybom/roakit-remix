import { Box, styled } from '@mui/material';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { type DateRangeEnding } from '../utils/dateUtils';
import { postJson } from '../utils/httpUtils';
import { DEFAULT_ROLE, type Role, type View } from '../utils/rbac';
import Header from './navigation/Header';
import NavDrawer from './navigation/NavDrawer';
import DrawerHeader from './navigation/NavDrawerHeader';

export const navbarWidth = 200;

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
  identityId,
  userName,
  role = DEFAULT_ROLE,
  dateRange,
  onDateRangeSelect,
  onDateRangeRefresh,
  showProgress,
  showPulse,
  isNavOpen,
  children,
}: {
  isLoggedIn: boolean;
  identityId?: string;
  userName?: string;
  role?: Role;
  view: View;
  dateRange?: DateRangeEnding;
  onDateRangeSelect?: (dateRangeEnding: DateRangeEnding) => void;
  onDateRangeRefresh?: () => void;
  showProgress?: boolean;
  showPulse?: boolean;
  isNavOpen?: boolean;
  children?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(isLoggedIn ? (isNavOpen ?? true) : false);

  const toggleNavBar = async (isNavOpen: boolean) => {
    setIsOpen(isNavOpen);
    await postJson('/set-cookie', { isNavOpen });
  };

  return (
    <Box display="flex">
      <Header
        isLoggedIn={isLoggedIn}
        identityId={identityId}
        userName={userName}
        role={role}
        view={view}
        dateRange={dateRange}
        onDateRangeSelect={onDateRangeSelect}
        onDateRangeRefresh={onDateRangeRefresh}
        showProgress={showProgress}
        navbarWidth={navbarWidth}
        navbarOpen={isOpen}
        onNavBarOpen={() => toggleNavBar(true)}
      />
      <NavDrawer
        role={role}
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
