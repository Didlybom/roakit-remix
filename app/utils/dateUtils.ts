import { formatRelative as formatRelativeFn } from 'date-fns/formatRelative';
import { FormatRelativeToken, enUS } from 'date-fns/locale';
import { startOfToday } from 'date-fns/startOfToday';
import { subWeeks } from 'date-fns/subWeeks';

export const formatMonthDayTime = (date: Date) =>
  date.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  });

export const formatMonthDay = (date: Date) =>
  date.toLocaleDateString('en-us', {
    month: 'short',
    day: 'numeric',
  });

const formatRelativeLocale = {
  lastWeek: "'Last' eeee",
  yesterday: "'Yesterday'",
  today: "'Today'",
  tomorrow: "'Tomorrow'",
  nextWeek: "'Next week'",
  other: 'P',
};

const relativeLlocale = {
  ...enUS,
  formatRelative: (token: FormatRelativeToken) => formatRelativeLocale[token],
};

export const formatRelative = (date: Date) =>
  formatRelativeFn(date, new Date(), {
    locale: relativeLlocale,
    weekStartsOn: 1 /* Monday */,
  });

export enum DateFilter {
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  OneDay = 'OneDay',
}

export const dateFilters: Record<DateFilter, string> = {
  [DateFilter.TwoWeeks]: '2 weeks',
  [DateFilter.OneWeek]: '1 week',
  [DateFilter.OneDay]: '1 day',
};

export const dateFilterToStartDate = (dateFilter: DateFilter) => {
  switch (dateFilter) {
    case DateFilter.TwoWeeks:
      return subWeeks(startOfToday(), 2).getTime();
    case DateFilter.OneWeek:
      return subWeeks(startOfToday(), 1).getTime();
    case DateFilter.OneDay:
      return startOfToday().getTime();
    default:
      return null;
  }
};
