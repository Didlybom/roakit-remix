import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { grey } from '@mui/material/colors';
import type { SelectOption } from '../utils/jsxUtils';

export default function SelectField({
  items,
  value,
  label,
  required,
  onChange,
}: {
  items: SelectOption[];
  value: string;
  label: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <FormControl required={required} size="small" sx={{ minWidth: 130 }}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} label={label} onChange={e => onChange(e.target.value)} autoWidth>
        {items.map((item, i) => (
          <MenuItem key={i} value={item.value} sx={{ color: item.value ? item.color : grey[400] }}>
            {item.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
