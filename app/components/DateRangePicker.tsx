import { CircularProgress, FormControl, MenuItem, Select } from '@mui/material';
import { DateRange, dateRanges } from '~/utils/dateUtils';

export default function DateRangePicker({
  dateRange,
  showProgress,
  onDateRangeSelect,
}: {
  dateRange: DateRange;
  showProgress?: boolean;
  onDateRangeSelect?: (dateRange: DateRange) => void;
}) {
  return (
    <FormControl sx={{ mx: 2, minWidth: 80 }} variant="standard">
      <Select
        id="date-range"
        value={dateRange}
        onChange={e => onDateRangeSelect?.(e.target.value as DateRange)}
        disableUnderline={true}
        sx={{
          color: 'inherit',
          '& .MuiSvgIcon-root': { color: 'inherit' },
        }}
      >
        {Object.keys(dateRanges).map((date, i) => (
          <MenuItem key={i} value={date} color="red">
            {dateRanges[date as DateRange]}
          </MenuItem>
        ))}
      </Select>
      {showProgress && (
        <CircularProgress
          size={30}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-15px',
            marginLeft: '-15px',
            color: 'inherit',
          }}
        />
      )}
    </FormControl>
  );
}
