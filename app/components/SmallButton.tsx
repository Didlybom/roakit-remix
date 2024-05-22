import { Button } from '@mui/material';
import type { ReactElement } from 'react';

export default function SmallButton({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactElement;
}) {
  return (
    <Button
      href={href}
      variant="outlined"
      startIcon={icon}
      sx={{
        mx: '2px',
        px: 1,
        py: 0,
        fontSize: '.75rem',
        fontWeight: 400,
        textTransform: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Button>
  );
}
