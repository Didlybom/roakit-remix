import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { SelectOption } from '../utils/jsxUtils';
import theme from '../utils/theme';

export default function SelectField({
  items,
  value,
  label,
  required,
  autoFocus,
  onChange,
}: {
  items: SelectOption[];
  value: string;
  label: string;
  required?: boolean;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl autoFocus={autoFocus} required={required} size="small" sx={{ width: 130 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        autoFocus={autoFocus}
        value={value}
        label={label}
        onChange={e => onChange(e.target.value)}
        autoWidth
      >
        {items.map((item, i) => (
          <MenuItem
            key={i}
            value={item.value}
            sx={{ fontSize: 'small', color: item.value ? item.color : theme.palette.grey[400] }}
          >
            {item.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
