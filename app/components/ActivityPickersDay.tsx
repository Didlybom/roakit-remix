import { styled } from '@mui/material';
import { PickersDay, type PickersDayProps } from '@mui/x-date-pickers';
import type dayjs from 'dayjs';
import { formatYYYYMMDD } from '../utils/dateUtils';
import theme from '../utils/theme';

const HighlightedPickersDay = styled(PickersDay)(() => ({
  backgroundColor: theme.palette.grey[200],
}));

export type PickerDayWithHighlights = PickersDayProps<dayjs.Dayjs> & { highlightedDays?: string[] };

export default function ActivityPickersDay(props: PickerDayWithHighlights) {
  const { highlightedDays = [], day, selected, ...other } = props;
  if (!selected && highlightedDays.includes(formatYYYYMMDD(day))) {
    return <HighlightedPickersDay {...other} day={day} />;
  } else {
    return <PickersDay {...other} day={day} selected={selected} />;
  }
}
