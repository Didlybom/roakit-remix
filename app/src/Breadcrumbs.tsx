import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import HomeIcon from '@mui/icons-material/Home';
import { Link, Stack, Typography } from '@mui/material';
import { Link as RemixLink } from '@remix-run/react';

export default function Breadcrumbs({ title }: { title: string }) {
  return (
    <Stack direction={'row'} sx={{ alignItems: 'center' }}>
      <Link variant="h6" underline="none" to="/" component={RemixLink}>
        <Stack direction={'row'} sx={{ alignItems: 'center' }}>
          <HomeIcon sx={{ mb: '2px', mr: '3px' }} /> ROAKIT
        </Stack>
      </Link>
      <ChevronRightIcon />
      <Typography variant="h6"> {title}</Typography>
    </Stack>
  );
}
