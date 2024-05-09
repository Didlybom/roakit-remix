import {
  ArrowDropDown as ArrowDropDownIcon,
  ArrowDropUp as ArrowDropUpIcon,
  CalendarMonth as LargeDateRangeIcon,
  DateRange as MediumDateRangeIcon,
  Today as SmallDateRangeIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from '@mui/material';
import { useState } from 'react';
import { DateRange, dateRangeLabels } from '../utils/dateUtils';
import { postJson } from '../utils/httpUtils';

const icons: Record<DateRange, JSX.Element> = {
  [DateRange.TwoWeeks]: <LargeDateRangeIcon fontSize="small" />,
  [DateRange.OneWeek]: <MediumDateRangeIcon fontSize="small" />,
  [DateRange.TwoDays]: <SmallDateRangeIcon fontSize="small" />,
  [DateRange.OneDay]: <SmallDateRangeIcon fontSize="small" />,
};

export default function DateRangePicker({
  dateRange,
  onSelect,
  showProgress,
}: {
  dateRange: DateRange;
  onSelect: (dateRange: DateRange) => void;
  showProgress?: boolean;
}) {
  const [menuEl, setMenuEl] = useState<null | HTMLElement>(null);

  const onDateClick = async (dateRange: DateRange) => {
    setMenuEl(null);
    onSelect(dateRange);
    await postJson('/set-cookie', { dateRange });
  };

  return (
    <Box mx={2}>
      <Button
        color="inherit"
        startIcon={icons[dateRange]}
        endIcon={menuEl ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}
        onClick={e => setMenuEl(e.currentTarget)}
        sx={{ textWrap: 'nowrap', textTransform: 'none' }}
      >
        {dateRangeLabels[dateRange]}
      </Button>
      <Menu
        id="date-range"
        open={!!menuEl}
        anchorEl={menuEl}
        onClose={() => setMenuEl(null)}
        sx={{ color: 'inherit' }}
      >
        {(Object.keys(dateRangeLabels) as DateRange[]).map((date, i) => (
          <MenuItem
            key={i}
            value={date}
            selected={date === dateRange}
            onClick={() => onDateClick(date)}
          >
            <ListItemIcon>{icons[date]}</ListItemIcon>
            <ListItemText>{dateRangeLabels[date]}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
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
    </Box>
  );
}
