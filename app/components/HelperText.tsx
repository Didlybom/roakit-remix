import { Box, Typography, type SxProps } from '@mui/material';
import type { ReactNode } from 'react';
import theme from '../utils/theme';

export default function HelperText({ children, sx }: { children: ReactNode; sx?: SxProps }) {
  return (
    <Typography
      variant="caption"
      fontStyle="italic"
      display="flex"
      justifyContent="center"
      color={theme.palette.grey[400]}
      sx={{
        code: {
          backgroundColor: theme.palette.grey[100],
          border: '1px solid',
          borderColor: theme.palette.grey[400],
          borderRadius: '5px',
          p: '1px 4px',
          mt: '-2px',
          mx: '1px',
        },
        justifyContent: 'center',
        ...sx,
      }}
    >
      <Box>{children}</Box>
    </Typography>
  );
}
