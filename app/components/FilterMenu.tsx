import FilterListIcon from '@mui/icons-material/FilterList';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  SxProps,
  Theme,
} from '@mui/material';

export default function FilterMenu<T extends string>({
  items,
  selectedValue,
  onChange,
  sx,
}: {
  items: { value: T; label: string; color?: string }[];
  selectedValue: T;
  onChange: (e: SelectChangeEvent) => void;
  sx?: SxProps<Theme>;
}) {
  return (
    <Stack direction="row" spacing={1} alignItems="center" sx={sx}>
      <FilterListIcon />
      <FormControl size="small">
        <InputLabel>Filter</InputLabel>
        <Select
          id="activity-filter"
          value={selectedValue}
          label="Filter"
          sx={{ minWidth: 120 }}
          onChange={onChange}
        >
          {items.map((item, i) => (
            <MenuItem key={i} value={item.value} sx={{ color: item.color }}>
              {item.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Stack>
  );
}
