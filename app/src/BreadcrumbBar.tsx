import HomeIcon from '@mui/icons-material/Home';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { Link, Typography } from '@mui/material';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import { Link as RemixLink } from '@remix-run/react';

export default function BreadcrumbBar({ title }: { title: string }) {
  return (
    <div role="presentation">
      <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb">
        <Link
          key="1"
          underline="hover"
          variant="h6"
          sx={{ display: 'flex', alignItems: 'center' }}
          to="/"
          component={RemixLink}
        >
          <HomeIcon sx={{ mr: 0.5 }} fontSize="inherit" />
          ROAKIT
        </Link>
        <Typography key="2" variant="h6">
          {title}
        </Typography>
      </Breadcrumbs>
    </div>
  );
}
