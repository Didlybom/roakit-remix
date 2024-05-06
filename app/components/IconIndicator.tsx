import { Box, Chip } from '@mui/material';
import type { ReactElement } from 'react';

export default function IconIndicator({
  icon,
  label,
  top,
  right,
}: {
  icon: ReactElement;
  label?: string;
  top?: number;
  right?: number;
}) {
  return (
    <Box>
      <Chip
        variant="outlined"
        size="small"
        icon={icon}
        sx={{
          border: 'none',
          position: 'absolute',
          top: top ?? 0,
          right: right ?? 0,
          opacity: 0.4,
        }}
        label={label}
      />
    </Box>
  );
}
