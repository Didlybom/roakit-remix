import { FilterList as FilterListIcon } from '@mui/icons-material';
import {
  Checkbox,
  FormControl,
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
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      {icon ?? <FilterListIcon />}
      <FormControl size="small">
        <InputLabel>{label ?? 'Filter'}</InputLabel>
        <Select
          multiple={multiple}
          value={selectedValue}
          label={label ?? 'Filter'}
          size="small"
          sx={{ minWidth: 120 }}
          renderValue={
            Array.isArray(selectedValue) ?
              selectedValues =>
                (selectedValues as string[])
                  .map(v => items.find(i => i.value === v)?.label)
                  .join(', ')
            : undefined
          }
          onChange={(event: SelectChangeEvent<string | string[]>) => {
            const value = event.target.value;
            onChange(multiple && typeof value === 'string' ? value.split(',') : value);
          }}
        >
          {items.map((item, i) => (
            <MenuItem key={i} value={item.value} dense sx={{ color: item.color }}>
              {multiple && <Checkbox size="small" checked={selectedValue.includes(item.value)} />}
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
