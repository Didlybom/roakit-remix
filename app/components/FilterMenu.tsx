import { FilterList as FilterListIcon } from '@mui/icons-material';
import {
  Box,
  Checkbox,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';
import type { ReactElement } from 'react';

export default function FilterMenu({
  multiple = false,
  items,
  selectedValue,
  onChange,
  label,
  icon,
  sx,
}: {
  multiple?: boolean;
  items: { value: string; label: string; color?: string }[];
  selectedValue: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  icon?: ReactElement;
  sx?: SxProps<Theme>;
}) {
  const isArrayValue = Array.isArray(selectedValue);
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      <FormControl size="small">
        <InputLabel>{label ?? 'Filter'}</InputLabel>
        <Select
          multiple={multiple}
          value={selectedValue}
          label={label ?? 'Filter'}
          size="small"
          sx={{ minWidth: 120 }}
          startAdornment={
            (isArrayValue && !selectedValue.length) || (!isArrayValue && !selectedValue) ?
              <InputAdornment position="start">
                {icon ?? <FilterListIcon fontSize="small" />}
              </InputAdornment>
            : undefined
          }
          renderValue={
            isArrayValue ?
              selectedValues => (
                <Box fontSize="small">
                  {(selectedValues as string[])
                    .map(v => items.find(i => i.value === v)?.label)
                    .join(', ')}
                </Box>
              )
            : value => <Box fontSize="small">{items.find(i => i.value === value)?.label}</Box>
          }
          onChange={(event: SelectChangeEvent<string | string[]>) => {
            const value = event.target.value;
            onChange(multiple && typeof value === 'string' ? value.split(',') : value);
          }}
        >
          {items.map((item, i) => (
            <MenuItem key={i} value={item.value} dense sx={{ color: item.color, py: 0 }}>
              {multiple && <Checkbox size="small" checked={selectedValue.includes(item.value)} />}
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
