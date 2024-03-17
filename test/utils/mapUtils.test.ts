import { groupBy, groupByAndSort } from '../../app/utils/mapUtils';

const data = [
  { k: 'a', v: 'a1' },
  { k: 'c', v: 'c1' },
  { k: 'b', v: 'b1' },
  { k: 'a', v: 'a2' },
  { k: 'a', v: 'a3' },
];

test('groupBy', () => {
  const result = groupBy(data, 'k');
  expect(result).toEqual({
    a: [
      { k: 'a', v: 'a1' },
      { k: 'a', v: 'a2' },
      { k: 'a', v: 'a3' },
    ],
    c: [{ k: 'c', v: 'c1' }],
    b: [{ k: 'b', v: 'b1' }],
  }); // could be any order
});

test('groupByAndSort', () => {
  const dict: Record<string, string> = { a: 'AAA', b: 'BBB', c: 'CCC' };
  let result = groupByAndSort(data, 'k', (x, y) => dict[x].localeCompare(dict[y]));
  expect([...result]).toEqual([
    [
      'a',
      [
        { k: 'a', v: 'a1' },
        { k: 'a', v: 'a2' },
        { k: 'a', v: 'a3' },
      ],
    ],
    ['b', [{ k: 'b', v: 'b1' }]],
    ['c', [{ k: 'c', v: 'c1' }]],
  ]);

  dict.a = 'ZZZ';
  result = groupByAndSort(data, 'k', (x, y) => dict[x].localeCompare(dict[y]));

  expect([...result]).toEqual([
    ['b', [{ k: 'b', v: 'b1' }]],
    ['c', [{ k: 'c', v: 'c1' }]],
    [
      'a',
      [
        { k: 'a', v: 'a1' },
        { k: 'a', v: 'a2' },
        { k: 'a', v: 'a3' },
      ],
    ],
  ]);
});
