import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { ReactNode } from 'react';
import Copyright from './Copyright';

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 2 }}>
        {children}
        <Copyright />
      </Box>
    </Container>
  );
}
