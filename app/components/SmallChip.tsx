import { Chip, type SxProps } from '@mui/material';

export default function SmallChip({
  label,
  tooltip,
  sx,
}: {
  label: string;
  tooltip?: string;
  sx?: SxProps;
}) {
  return (
    <Chip
      variant="outlined"
      size="small"
      label={label}
      title={tooltip}
      sx={{
        fontSize: '9px',
        height: '15px',
        '& .MuiChip-label': { px: '4px' },
        ...sx,
      }}
    />
  );
}
