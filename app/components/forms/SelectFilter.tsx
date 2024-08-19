import { FilterList as FilterListIcon } from '@mui/icons-material';
import type { SelectChangeEvent, SxProps, Theme } from '@mui/material';
import {
  Box,
  Checkbox,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import type { ReactElement } from 'react';
import { ellipsisSx } from '../../utils/jsxUtils';

export default function SelectFilter({
  multiple = false,
  chips = false,
  items,
  selectedValue,
  onChange,
  label,
  icon,
  sx,
}: {
  multiple?: boolean;
  chips?: boolean;
  items: { value: string; label: string; color?: string }[];
  selectedValue: string | string[];
  onChange: (value: string | string[]) => void;
  label?: string;
  icon?: ReactElement;
  sx?: SxProps<Theme>;
}) {
  const isArrayValue = Array.isArray(selectedValue);
  return (
    <FormControl size="small" sx={sx}>
      <InputLabel>{label ?? 'Filter'}</InputLabel>
      <Select
        multiple={multiple}
        value={selectedValue}
        label={label ?? 'Filter'}
        size="small"
        sx={{ minWidth: { xs: '100px', sm: '120px' } }}
        startAdornment={
          (isArrayValue && !selectedValue.length) || (!isArrayValue && !selectedValue) ?
            <InputAdornment position="start">
              {icon ?? <FilterListIcon fontSize="small" />}
            </InputAdornment>
          : undefined
        }
        renderValue={
          isArrayValue ?
            selectedValues =>
              chips ?
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {(selectedValues as string[]).map((v, i) => (
                    <Chip key={i} size="small" label={items.find(i => i.value === v)?.label} />
                  ))}
                </Box>
              : <Box fontSize="small" sx={ellipsisSx}>
                  {(selectedValues as string[])
                    .slice(0, 2)
                    .map(v => items.find(i => i.value === v)?.label)
                    .join(', ') +
                    (selectedValues.length > 2 ? `, and ${selectedValues.length - 2} more` : '')}
                </Box>
          : value => (
              <Box fontSize="small" sx={ellipsisSx}>
                {items.find(i => i.value === value)?.label}
              </Box>
            )
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
  );
}
