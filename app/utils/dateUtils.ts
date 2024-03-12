import { formatRelative as formatRelativeFn } from 'date-fns/formatRelative';
import { FormatRelativeToken, enUS } from 'date-fns/locale';
import { startOfToday } from 'date-fns/startOfToday';
import { subWeeks } from 'date-fns/subWeeks';

export const ONE_HOUR = 60 * 60 * 1000;

export const formatMonthDayTime = (date: Date) =>
  date.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

export const formatMonthDay = (date: Date) =>
  date.toLocaleDateString('en-us', { month: 'short', day: 'numeric' });

const formatRelativeLocale = {
  lastWeek: "'Last' eeee",
  yesterday: "'Yesterday'",
  today: "'Today'",
  tomorrow: "'Tomorrow'",
  nextWeek: "'Next week'",
  other: 'P',
};

const relativeLocale = {
  ...enUS,
  formatRelative: (token: FormatRelativeToken) => formatRelativeLocale[token],
};

export const formatRelative = (date: Date) =>
  formatRelativeFn(date, new Date(), { locale: relativeLocale, weekStartsOn: 1 /* Monday */ });

export enum DateRange {
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  OneDay = 'OneDay',
}

export const dateRanges: Record<DateRange, string> = {
  [DateRange.TwoWeeks]: 'Last 14 days',
  [DateRange.OneWeek]: 'Last 7 days',
  [DateRange.OneDay]: 'Last 24 hours',
};

export const dateFilterToStartDate = (dateFilter: DateRange) => {
  switch (dateFilter) {
    case DateRange.TwoWeeks:
      return subWeeks(startOfToday(), 2).getTime();
    case DateRange.OneWeek:
      return subWeeks(startOfToday(), 1).getTime();
    case DateRange.OneDay:
      return startOfToday().getTime();
    default:
      return null;
  }
};

export const DATE_RANGE_LOCAL_STORAGE_KEY = 'dateRange';
