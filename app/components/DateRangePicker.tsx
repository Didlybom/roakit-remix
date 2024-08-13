import {
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
  KeyboardArrowLeft as ArrowLeftIcon,
  KeyboardArrowRight as ArrowRightIcon,
  CalendarMonth as LargeDateRangeIcon,
  DateRange as MediumDateRangeIcon,
  Today as SmallDateRangeIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  type ButtonPropsColorOverrides,
} from '@mui/material';
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
import theme from '../utils/theme';

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
  prevAndNextButtons = true,
  color = theme.palette.common.white,
}: {
  dateRange: DateRange;
  endDay: Dayjs;
  onSelect: (dateRangeEnding: DateRangeEnding) => void;
  prevAndNextButtons?: boolean;
  color?: ButtonPropsColorOverrides;
}) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);
  const [range, setRange] = useState<DateRange>(dateRange);
  const [day, setDay] = useState<Dayjs>(endDay);
  const isTodaySelected = isToday(day);

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
  if (isTodaySelected) {
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
        color="inherit"
        sx={{
          fontWeight: 400,
          fontSize: ' small',
          textWrap: 'nowrap',
          textTransform: 'none',
        }}
      >
        {dateRangeLabels[dateRange]}
      </Button>
      <Menu open={!!menuEl} anchorEl={menuEl} onClose={() => setMenuEl(null)} sx={{ color }}>
        {Object.entries(dateRangeLabels).map(([rangeOption, rangeLabel], i) => (
          <MenuItem
            key={i}
            value={rangeOption}
            selected={rangeOption === range}
            onClick={() => handleDateRangeClick(rangeOption as DateRange)}
          >
            <ListItemIcon>{icons[rangeOption as DateRange]}</ListItemIcon>
            <ListItemText>{rangeLabel}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
      <Box color="inherit" mt="1px">
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
      {prevAndNextButtons && (
        <>
          <IconButton
            onClick={() => handleEndDayClick(day.subtract(1, 'day'))}
            title="Previous day"
            color="inherit"
            sx={{ ml: '4px', p: '2px' }}
          >
            <ArrowLeftIcon fontSize="small" />
          </IconButton>
          {!isTodaySelected && (
            <IconButton
              onClick={() => handleEndDayClick(day.add(1, 'day'))}
              title="Next day"
              color="inherit"
              sx={{ p: '2px' }}
            >
              <ArrowRightIcon fontSize="small" />
            </IconButton>
          )}
        </>
      )}
    </Stack>
  );
}
