import { cloneArray, groupBy, groupByAndSort } from '../../app/utils/mapUtils';

const data = [
  { k: 'a', v: 'a1' },
  { k: 'c', v: 'c1' },
  { k: 'b', v: 'b1' },
  { k: 'a', v: 'a2' },
  { k: 'b', v: 'b2' },
  { k: 'a', v: 'a3' },
];

test('groupBy', () => {
  const result = groupBy(cloneArray(data), 'k');
  expect(result).toEqual({
    a: [{ v: 'a1' }, { v: 'a2' }, { v: 'a3' }],
    c: [{ v: 'c1' }],
    b: [{ v: 'b1' }, { v: 'b2' }],
  }); // a Record could be in any order
});

test('groupByAndSort', () => {
  const dict: Record<string, string> = { a: 'AAA', b: 'BBB', c: 'CCC' };
  let result = groupByAndSort(cloneArray(data), 'k', (x, y) =>
    dict[x.key].localeCompare(dict[y.key])
  );
  expect([...result]).toEqual([
    ['a', [{ v: 'a1' }, { v: 'a2' }, { v: 'a3' }]],
    ['b', [{ v: 'b1' }, { v: 'b2' }]],
    ['c', [{ v: 'c1' }]],
  ]);

  dict.a = 'ZZZ';
  result = groupByAndSort(cloneArray(data), 'k', (x, y) => dict[x.key].localeCompare(dict[y.key]));
  expect([...result]).toEqual([
    ['b', [{ v: 'b1' }, { v: 'b2' }]],
    ['c', [{ v: 'c1' }]],
    ['a', [{ v: 'a1' }, { v: 'a2' }, { v: 'a3' }]],
  ]);

  result = groupByAndSort(cloneArray(data), 'k', (x, y) => x.count - y.count);
  expect([...result]).toEqual([
    ['c', [{ v: 'c1' }]],
    ['b', [{ v: 'b1' }, { v: 'b2' }]],
    ['a', [{ v: 'a1' }, { v: 'a2' }, { v: 'a3' }]],
  ]);
});
