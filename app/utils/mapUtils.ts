export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> =>
  array.reduce(
    (acc, value) => {
      (acc[value[key] as string] ||= []).push(value);
      return acc;
    },
    {} as Record<string, T[]>
  );

export const groupByAndSort = <T>(
  array: T[],
  key: keyof T,
  compare: (keyA: string, keyB: string) => number
): Map<string, T[]> => {
  const grouped = array.reduce(
    (acc, value) => {
      const recordKey = value[key] as string;
      const record = acc.find(a => a.key === recordKey);
      if (!record) {
        acc.push({ key: recordKey, values: [value] });
      } else {
        record.values.push(value);
      }
      return acc;
    },
    [] as { key: string; values: T[] }[]
  );
  grouped.sort((a, b) => compare(a.key, b.key));
  const sorted = new Map<string, T[]>();
  grouped.forEach(v => sorted.set(v.key, v.values));
  return sorted;
};
