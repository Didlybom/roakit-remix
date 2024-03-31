import { formatRelative as formatRelativeFn } from 'date-fns/formatRelative';
import { FormatRelativeToken, enUS } from 'date-fns/locale';

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
export type DateRangeValue = DateRange.TwoWeeks | DateRange.OneWeek | DateRange.OneDay;

export const dateRangeLabels: Record<DateRange, string> = {
  [DateRange.TwoWeeks]: 'Last 14 days',
  [DateRange.OneWeek]: 'Last 7 days',
  [DateRange.OneDay]: 'Last 24 hours',
};

export const dateFilterToStartDate = (dateFilter: DateRange) => {
  const now = Date.now();
  switch (dateFilter) {
    case DateRange.TwoWeeks:
      return now - 14 * ONE_DAY;
    case DateRange.OneWeek:
      return now - 7 * ONE_DAY;
    case DateRange.OneDay:
      return now - ONE_DAY;
    default:
      return null;
  }
};
