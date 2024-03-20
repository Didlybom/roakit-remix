import { Box, Stack } from '@mui/material';
import { ReactNode } from 'react';
import Copyright from './Copyright';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Stack direction="column" sx={{ minHeight: '100vh' }}>
      <Box>{children}</Box>
      <Box sx={{ flexGrow: 1 }} />
      <Copyright />
    </Stack>
  );
}
