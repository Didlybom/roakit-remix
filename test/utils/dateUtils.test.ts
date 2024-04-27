import dayjs from 'dayjs';
import { daysInMonth } from '../../app/utils/dateUtils';

test('daysInMonth', () => {
  const expected = [...Array(29).keys()].map(k => '202002' + ('0' + (k + 1)).slice(-2));
  expect(daysInMonth(dayjs('20200201'))).toEqual(expected);
  expect(daysInMonth(dayjs('202002'))).toEqual(expected);
});
