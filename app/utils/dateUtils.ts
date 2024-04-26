import dayjs, { Dayjs } from 'dayjs';
import localizedFormatPlugin from 'dayjs/plugin/localizedFormat';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';

dayjs.extend(localizedFormatPlugin);
dayjs.extend(relativeTimePlugin);

export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;

export const formatMonthDayTime = (date: Date) =>
  date.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

export const formatMonthDay = (date: Date) =>
  date.toLocaleDateString('en-us', { month: 'short', day: 'numeric' });

export enum DateRange {
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  TwoDays = 'TwoDays',
  OneDay = 'OneDay',
}
export type DateRangeValue = DateRange.TwoWeeks | DateRange.OneWeek | DateRange.OneDay;

export const dateRangeLabels: Record<DateRange, string> = {
  [DateRange.TwoWeeks]: 'Last 14 days',
  [DateRange.OneWeek]: 'Last 7 days',
  [DateRange.TwoDays]: 'Last 48 hours',
  [DateRange.OneDay]: 'Last 24 hours',
};

export const dateFilterToStartDate = (dateFilter: DateRange) => {
  const now = Date.now();
  switch (dateFilter) {
    case DateRange.TwoWeeks:
      return now - 14 * ONE_DAY;
    case DateRange.OneWeek:
      return now - 7 * ONE_DAY;
    case DateRange.TwoDays:
      return now - 2 * ONE_DAY;
    case DateRange.OneDay:
      return now - ONE_DAY;
    default:
      return null;
  }
};

export const formatRelative = (date: Date) => dayjs().to(dayjs(date));

export const formatDayLocal = (date: Dayjs | null) => date?.format('LL') ?? null;

export const formatYYYYMMDD = (date: Dayjs | null) => date?.format('YYYYMMDD') ?? null;

export const daysInMonth = (date: Dayjs | null) =>
  date ?
    Array.from({ length: date.daysInMonth() }, (_, i) =>
      formatYYYYMMDD(date.startOf('month').add(i, 'days'))
    )
  : null;
