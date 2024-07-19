import { ArrowDropDown as ArrowDropDownIcon, Edit as EditIcon } from '@mui/icons-material';
import { Box, Button } from '@mui/material';
import type { ReactNode } from 'react';

export default function EditableCellField({
  layout,
  tabIndex,
  label,
  hovered,
}: {
  layout: 'text' | 'dropdown';
  tabIndex?: number;
  label?: string | ReactNode | null;
  hovered?: boolean;
}) {
  return hovered ?
      <Box height="100%" display="flex" alignItems="center">
        <Button
          tabIndex={tabIndex}
          color="inherit"
          size="small"
          endIcon={
            layout === 'dropdown' ?
              <ArrowDropDownIcon />
            : <EditIcon style={{ width: '12px', height: '12px' }} />
          }
          sx={{
            p: 0,
            pr: 1,
            fontWeight: 'inherit',
            textTransform: 'none',
            letterSpacing: 'normal',
            textAlign: 'start',
            justifyContent: 'start',
          }}
        >
          {label || '⋯'}
        </Button>
      </Box>
    : <Box
        height="100%"
        display="flex"
        alignItems="center"
        textAlign="start"
        letterSpacing="normal"
      >
        {label || '⋯'}
      </Box>;
}
