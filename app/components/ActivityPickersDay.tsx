import { styled } from '@mui/material';
import { grey } from '@mui/material/colors';
import { PickersDay, type PickersDayProps } from '@mui/x-date-pickers';
import type dayjs from 'dayjs';
import { formatYYYYMMDD } from '../utils/dateUtils';

const HighlightedPickersDay = styled(PickersDay)(() => ({ backgroundColor: grey[200] }));

export type PickerDayWithHighlights = PickersDayProps<dayjs.Dayjs> & { highlightedDays?: string[] };

export const ActivityPickersDay = (props: PickerDayWithHighlights) => {
  const { highlightedDays = [], day, selected, ...other } = props;
  if (!selected && highlightedDays.includes(formatYYYYMMDD(day))) {
    return <HighlightedPickersDay {...other} day={day} />;
  } else {
    return <PickersDay {...other} day={day} selected={selected} />;
  }
};
