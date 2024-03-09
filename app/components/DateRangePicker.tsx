import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateRangeIcon from '@mui/icons-material/DateRange';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import TodayIcon from '@mui/icons-material/Today';
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
import { DateRange, dateRanges } from '~/utils/dateUtils';

const icons: Record<DateRange, JSX.Element> = {
  [DateRange.TwoWeeks]: <CalendarMonthIcon fontSize="small" />,
  [DateRange.OneWeek]: <DateRangeIcon fontSize="small" />,
  [DateRange.OneDay]: <TodayIcon fontSize="small" />,
};

export default function DateRangePicker({
  dateRange,
  onDateRangeSelect,
  showProgress,
}: {
  dateRange: DateRange;
  onDateRangeSelect: (dateRange: DateRange) => void;
  showProgress?: boolean;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const handleClickListItem = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  return (
    <Box sx={{ mx: 2, minWidth: 80 }}>
      <Button
        color="inherit"
        startIcon={icons[dateRange]}
        endIcon={<KeyboardArrowDownIcon />}
        onClick={handleClickListItem}
        sx={{ textWrap: 'nowrap' }}
      >
        {dateRanges[dateRange]}
      </Button>
      <Menu
        id="date-range"
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        sx={{ color: 'inherit' }}
      >
        {Object.keys(dateRanges).map((date, i) => (
          <MenuItem
            key={i}
            value={date}
            selected={(date as DateRange) === dateRange}
            onClick={() => {
              setAnchorEl(null);
              onDateRangeSelect(date as DateRange);
            }}
          >
            <ListItemIcon>{icons[date as DateRange]}</ListItemIcon>
            <ListItemText>{dateRanges[date as DateRange]}</ListItemText>
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
