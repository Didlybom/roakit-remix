export const cloneArray = <T>(array: T[]) => {
  const cloned: T[] = [];
  array.forEach(val => cloned.push(Object.assign({}, val)));
  return cloned;
};

export const areRecordsEqual = <T>(rec1: Record<string, T>, rec2: Record<string, T>) =>
  JSON.stringify(rec1, Object.keys(rec1).sort()) === JSON.stringify(rec2, Object.keys(rec2).sort());

export const groupBy = <T>(array: T[], key: keyof T): Record<string, T[]> =>
  array.reduce(
    (acc, value) => {
      const recordKey = value[key] as string;
      const recordValue = value;
      delete recordValue[key];
      (acc[recordKey] ||= []).push(recordValue);
      return acc;
    },
    {} as Record<string, T[]>
  );

export const groupByArray = <T>(array: T[], key: keyof T): { key: string; values: T[] }[] => {
  return array.reduce(
    (acc, value) => {
      const recordKey = value[key] as string;
      const recordValue = value;
      delete recordValue[key];
      const record = acc.find(a => a.key === recordKey);
      if (!record) {
        acc.push({ key: recordKey, values: [recordValue] });
      } else {
        record.values.push(recordValue);
      }
      return acc;
    },
    [] as { key: string; values: T[] }[]
  );
};

export const sortMap = <T>(
  arrayMap: { key: string; values: T[] }[],
  compare: (a: { key: string; count: number }, b: { key: string; count: number }) => number
): Map<string, T[]> => {
  arrayMap.sort((a, b) =>
    compare({ key: a.key, count: a.values.length }, { key: b.key, count: b.values.length })
  );
  const sorted = new Map<string, T[]>();
  arrayMap.forEach(v => sorted.set(v.key, v.values));
  return sorted;
};

export const groupByAndSort = <T>(
  array: T[],
  key: keyof T,
  compare: (a: { key: string; count: number }, b: { key: string; count: number }) => number
): Map<string, T[]> => sortMap(groupByArray(array, key), compare);
