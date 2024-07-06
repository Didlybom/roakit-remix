import {
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
  CalendarMonth as LargeDateRangeIcon,
  DateRange as MediumDateRangeIcon,
  Today as SmallDateRangeIcon,
} from '@mui/icons-material';
import { Box, Button, ListItemIcon, ListItemText, Menu, MenuItem, Stack } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useState } from 'react';
import {
  DateRange,
  dateRangeLabels,
  formatYYYYMMDD,
  isToday,
  isValidDate,
  isYesterday,
  type DateRangeEnding,
} from '../utils/dateUtils';
import { postJson } from '../utils/httpUtils';

const icons: Record<DateRange, JSX.Element> = {
  [DateRange.TwoWeeks]: <LargeDateRangeIcon fontSize="small" />,
  [DateRange.OneWeek]: <MediumDateRangeIcon fontSize="small" />,
  [DateRange.TwoDays]: <SmallDateRangeIcon fontSize="small" />,
  [DateRange.OneDay]: <SmallDateRangeIcon fontSize="small" />,
};

export default function DateRangePicker({
  dateRange,
  endDay = dayjs(),
  onSelect,
  color = 'white',
}: {
  dateRange: DateRange;
  endDay: Dayjs;
  onSelect: (dateRangeEnding: DateRangeEnding) => void;
  color?: string;
}) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [range, setRange] = useState<DateRange>(dateRange);
  const [day, setDay] = useState<Dayjs>(endDay);

  const handleDateRangeClick = async (dateRange: DateRange) => {
    setMenuEl(null);
    setRange(dateRange);
    const endDay = formatYYYYMMDD(day);
    onSelect({ dateRange, endDay });
    await postJson('/set-cookie', { dateRange, endDay });
  };

  const handleEndDayClick = async (day: Dayjs | null) => {
    if (!day || !isValidDate(day)) {
      return;
    }
    setMenuEl(null);
    setDay(day);
    const endDay = formatYYYYMMDD(day);
    onSelect({ dateRange: range, endDay });
    await postJson('/set-cookie', { dateRange: range, endDay: endDay });
  };

  let datePickerFormat = 'MMM Do';
  if (isToday(day)) {
    datePickerFormat = 'Today';
  } else if (isYesterday(day)) {
    datePickerFormat = 'Yesterday';
  }

  return (
    <Stack direction="row" alignItems="center" useFlexGap>
      <Button
        endIcon={
          menuEl ? <ArrowDropUpIcon sx={{ ml: -1 }} /> : <ArrowDropDownIcon sx={{ ml: -1 }} />
        }
        onClick={e => setMenuEl(e.currentTarget)}
        sx={{
          color,
          fontWeight: 400,
          fontSize: ' small',
          textWrap: 'nowrap',
          textTransform: 'none',
        }}
      >
        {dateRangeLabels[dateRange]}
      </Button>
      <Menu open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)} sx={{ color }}>
        {(Object.keys(dateRangeLabels) as DateRange[]).map((rangeOption, i) => (
          <MenuItem
            key={i}
            value={rangeOption}
            selected={rangeOption === range}
            onClick={() => handleDateRangeClick(rangeOption)}
          >
            <ListItemIcon>{icons[rangeOption]}</ListItemIcon>
            <ListItemText>{dateRangeLabels[rangeOption]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      <Box fontSize="small" mr={1}>
        {'ending'}
      </Box>
      <Box mt="1px">
        <LocalizationProvider dateAdapter={AdapterDayjs}>
          <DatePicker
            disableFuture={true}
            slotProps={{
              textField: {
                size: 'small',
                sx: {
                  width: '120px',
                  input: { color, fontSize: 'small', py: '4px', pl: '8px' },
                  '& .MuiOutlinedInput-root': {
                    '& fieldset': { borderColor: color, opacity: 0.7 },
                    '&:hover fieldset': { borderColor: color, opacity: 0.7 },
                    '& .Mui-focused fieldset': { borderColor: color, opacity: 0.7 },
                  },
                },
              },
              openPickerButton: { sx: { color, '& svg': { fontSize: '1.25rem' } } },
            }}
            value={day}
            format={datePickerFormat}
            onChange={handleEndDayClick}
          />
        </LocalizationProvider>
      </Box>
    </Stack>
  );
}
