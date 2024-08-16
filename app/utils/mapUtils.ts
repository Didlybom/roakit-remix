export const cloneArray = <T>(array: T[]) => {
  const cloned: T[] = [];
  array.forEach(val => cloned.push(Object.assign({}, val)));
  return cloned;
};

export const areArrayEqual = <T>(arr1: T[] | undefined, arr2: T[] | undefined) => {
  if (!arr1 || !arr2) return false;
  if (arr1.length != arr2.length) return false;
  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) return false;
  }
  return true;
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

export const forEachRight = <T>(
  array: T[],
  fn: (element: T, index: number, array: T[]) => void
) => {
  for (let index = array.length - 1; index >= 0; --index) {
    if (index in array) {
      fn(array[index], index, array);
    }
  }
};

export const groupByArray = <T>(
  array: T[],
  key: keyof T | null
): { key: string | null; values: T[] }[] => {
  if (!key) {
    return [{ key: null, values: array }];
  }
  return array.reduce(
    (acc, value) => {
      const recordKey = (value[key] as string) ?? '';
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
    [] as { key: string | null; values: T[] }[]
  );
};

export const sortMap = <T>(
  arrayMap: { key: string | null; values: T[] }[],
  compare:
    | ((a: { key: string | null; values: T[] }, b: { key: string | null; values: T[] }) => number)
    | null
): Map<string | null, T[]> => {
  if (compare) {
    arrayMap.sort((a, b) =>
      compare({ key: a.key, values: a.values }, { key: b.key, values: b.values })
    );
  }
  const sorted = new Map<string | null, T[]>();
  arrayMap.forEach(v => sorted.set(v.key, v.values));
  return sorted;
};

export const groupByAndSort = <T>(
  array: T[],
  key: keyof T,
  compare: (
    a: { key: string | null; values: T[] },
    b: { key: string | null; values: T[] }
  ) => number
): Map<string | null, T[]> => sortMap(groupByArray(array, key), compare);

export const dedupeConsecutiveItems = <T>(array: T[], areEqual: (a: T, b: T) => boolean): T[] =>
  array.filter((item, pos, arr) => pos === 0 || !areEqual(item, arr[pos - 1]));
