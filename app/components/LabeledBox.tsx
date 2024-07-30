import { Box, type SxProps } from '@mui/material';
import type { ReactNode } from 'react';
import theme from '../utils/theme';

export default function LabeledBox({
  children,
  label,
  sx,
}: {
  children: ReactNode;
  label?: string;
  sx?: SxProps;
}) {
  // There are issues with <fieldset> and <legend> on Safari
  const box = (
    <Box
      // component={label ? 'fieldset' : undefined}
      p={1}
      pt={label ? '2px' : undefined}
      bgcolor={theme.palette.background.default}
      borderRadius="6px"
      border="solid 1px"
      borderColor={theme.palette.grey[200]}
      sx={sx}
    >
      {label && (
        <Box
          //component="legend"
          fontSize="12px"
          color={theme.palette.grey[400]}
          bgcolor="inherit"
          border="solid 1px"
          borderRadius="6px"
          borderColor={theme.palette.grey[200]}
          px="4px"
          width="fit-content"
          position="relative"
          top={-10}
        >
          {label}
        </Box>
      )}
      {children}
    </Box>
  );
  return label ? <Box pt={1}>{box}</Box> : box;
}
