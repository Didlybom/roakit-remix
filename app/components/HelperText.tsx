import { Info as InfoIcon } from '@mui/icons-material';
import { Box, Stack, Typography, type SxProps } from '@mui/material';
import type { ReactNode } from 'react';
import theme from '../utils/theme';

export default function HelperText({
  children,
  infoIcon,
  sx,
}: {
  children: ReactNode;
  infoIcon?: boolean;
  sx?: SxProps;
}) {
  return (
    <Typography
      variant="caption"
      fontStyle="italic"
      display="flex"
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
        ...sx,
      }}
    >
      <Stack direction="row" spacing="4px">
        {infoIcon && <InfoIcon sx={{ width: 18, height: 18 }} />}
        <Box>{children}</Box>
      </Stack>
    </Typography>
  );
}
