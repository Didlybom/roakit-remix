import { Box, Stack } from '@mui/material';
import type { ReactNode } from 'react';
import Copyright from './Copyright';

export default function Layout({
  showCopyright,
  children,
}: {
  showCopyright: boolean;
  children: ReactNode;
}) {
  return showCopyright ?
      <Stack height="100%">
        <Box>{children}</Box>
        <Box flexGrow={1} />
        <Copyright />
      </Stack>
    : children;
}
