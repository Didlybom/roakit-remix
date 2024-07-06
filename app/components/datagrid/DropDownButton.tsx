import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { ReactNode } from 'react';

export default function DropDownButton({
  tabIndex,
  label,
}: {
  tabIndex?: number;
  label?: string | ReactNode | null;
}) {
  return (
    <Button
      tabIndex={tabIndex}
      color="inherit"
      size="small"
      endIcon={<ArrowDropDownIcon />}
      sx={{ ml: -1, fontWeight: 400, textTransform: 'none' }}
    >
      {label || '⋯'}
    </Button>
  );
}
