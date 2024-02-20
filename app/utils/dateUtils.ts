import { formatRelative as formatRelativeFn } from 'date-fns/formatRelative';
import { FormatRelativeToken, enUS } from 'date-fns/locale';

export const formatDayMonth = (date: Date) =>
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

export const formatRelative = (date: Date) => {
  return formatRelativeFn(date, new Date(), {
    locale: relativeLlocale,
    weekStartsOn: 1 /* Monday */,
  });
};
