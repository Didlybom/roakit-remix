import { Box, Stack } from '@mui/material';
import { ReactNode } from 'react';
import Copyright from './Copyright';

export default function Layout({
  showCopyright,
  children,
}: {
  showCopyright: boolean;
  children: ReactNode;
}) {
  return showCopyright ?
      <Stack direction="column" minHeight="100vh">
        <Box>{children}</Box>
        <Box flexGrow={1} />
        <Copyright />
      </Stack>
    : children;
}
