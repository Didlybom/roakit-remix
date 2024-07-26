import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import isTodayPlugin from 'dayjs/plugin/isToday';
import isYesterdayPlugin from 'dayjs/plugin/isYesterday';
import localizedFormatPlugin from 'dayjs/plugin/localizedFormat';
import relativeTimePlugin from 'dayjs/plugin/relativeTime';
import updateLocalePlugin from 'dayjs/plugin/updateLocale';

dayjs.extend(localizedFormatPlugin);
dayjs.extend(updateLocalePlugin);
dayjs.extend(relativeTimePlugin);
dayjs.extend(isTodayPlugin);
dayjs.extend(isYesterdayPlugin);

// see https://day.js.org/docs/en/customization/relative-time
dayjs.updateLocale('en', {
  relativeTime: {
    future: 'in %s',
    past: '%s ago',
    s: 'few secs',
    m: '1m',
    mm: '%dm',
    h: '1h',
    hh: '%dh',
    d: '1d',
    dd: '%dd',
    M: '1 month',
    MM: '%d months',
    y: '1year',
    yy: '%d years',
  },
});

export const ONE_HOUR = 60 * 60 * 1000;
export const ONE_DAY = 24 * ONE_HOUR;

export const formatMonthDayTime = (date: Date | number) =>
  (typeof date === 'number' ? new Date(date) : date).toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

export const formatMonthDay = (date: Date | number) =>
  (typeof date === 'number' ? new Date(date) : date).toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
  });

export const isToday = (date: Dayjs) => date.isToday();
export const isYesterday = (date: Dayjs) => date.isYesterday();

export const endOfDay = (date: Dayjs) => date.endOf('day').valueOf();

export enum DateRange {
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  TwoDays = 'TwoDays',
  OneDay = 'OneDay',
}
export type DateRangeValue = DateRange.TwoWeeks | DateRange.OneWeek | DateRange.OneDay;

export type DateRangeEnding = { dateRange: DateRange; endDay: string /* YYYYMMDD*/ };

export const dateRangeLabels: Record<DateRange, string> = {
  [DateRange.TwoWeeks]: '14 days',
  [DateRange.OneWeek]: '7 days',
  [DateRange.TwoDays]: '2 days',
  [DateRange.OneDay]: '1 day',
};

export const dateFilterToStartDate = (dateRange: DateRange, endDay: Dayjs) => {
  const ending = endOfDay(endDay);
  switch (dateRange) {
    case DateRange.TwoWeeks:
      return ending - 14 * ONE_DAY;
    case DateRange.OneWeek:
      return ending - 7 * ONE_DAY;
    case DateRange.TwoDays:
      return ending - 2 * ONE_DAY;
    case DateRange.OneDay:
      return ending - ONE_DAY;
    default:
      return null;
  }
};

export const formatRelative = (date: Date) => dayjs().to(dayjs(date), true /* no suffix */);

export const formatDayLocal = (date: Dayjs) => date?.format('LL') ?? null;

export const formatYYYYMMDD = (date: Dayjs) => date?.format('YYYYMMDD') ?? null;
export const formatYYYYMM = (date: Dayjs) => date?.format('YYYYMM') ?? null;

/**
 * Returns the days in month, formatted as YYYYMMDD,
 * excluding future days
 */
export const daysInMonth = (date: Dayjs) => {
  const today = formatYYYYMMDD(dayjs());
  return [...Array(date.daysInMonth()).keys()]
    .map(i => formatYYYYMMDD(date.startOf('month').add(i, 'days')))
    .filter(d => d <= today);
};

export const endOfNextBusinessDay = (date: Date | number) => {
  const day = typeof date === 'number' ? new Date(date) : date;
  // see https://stackoverflow.com/questions/39137913/get-next-day-skip-weekends/39137972#39137972
  let weekDay = day.getDay();
  let add;
  if (weekDay === 6) {
    add = 2;
  } else if (weekDay === 5) {
    add = 3;
  } else {
    add = 1;
  }
  day.setDate(day.getDate() + add);
  return endOfDay(dayjs(day));
};

export const isValidDate = (date: Dayjs) => !isNaN(date.toDate().getTime());
