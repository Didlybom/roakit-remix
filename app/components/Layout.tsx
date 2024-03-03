import { Stack } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { ReactNode } from 'react';
import Copyright from './Copyright';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Container maxWidth="xl" disableGutters>
      <Stack direction="column" sx={{ minHeight: '100vh' }}>
        <Box>{children}</Box>
        <Box sx={{ flexGrow: 1 }} />
        <Copyright />
      </Stack>
    </Container>
  );
}
