import { Box, Chip } from '@mui/material';
import type { ReactElement } from 'react';

export default function IconIndicator({
  icon,
  label,
  title,
  top,
  right,
}: {
  icon: ReactElement;
  label?: string;
  title?: string;
  top?: number;
  right?: number;
}) {
  return (
    <Box>
      <Chip
        variant="outlined"
        size="small"
        icon={icon}
        title={title}
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
