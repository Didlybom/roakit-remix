import {
  clearExpressionsCache,
  compileExpressions,
  evalActivity,
} from '../../app/initiativeMapper/initiativeMapper';
import type { ActivityData } from '../../app/types/types';

test('evalActivity', () => {
  const mappers = {
    'ini-1': `event == "abc"`, // if activity's event is abc, then we map it to initiative ini-1
    'ini-2': `metadata.issue.project.id == "proj-a"  `,
    'ini-3': `event == "abc" or   metadata.issue.project.id == "proj-a"`,
    'ini-4': `event== "abc" and metadata.issue.project.id =="proj-a"`,
    'ini-5': ` (event == "abc" and metadata.issue.project.id == "proj-a")or artifact == "code"`,
  };
  clearExpressionsCache();
  compileExpressions(mappers);

  const activity: ActivityData = {
    initiativeId: '',
    id: 'id',
    action: 'action',
    createdTimestamp: 0,
    artifact: 'code',
    event: 'abc',
    metadata: { issue: { key: 'iss-a', project: { id: 'proj-a' } } },
  };

  expect(evalActivity(activity)).toEqual(['ini-1', 'ini-2', 'ini-3', 'ini-4', 'ini-5']);
  expect(evalActivity({ ...activity, event: 'x' })).toEqual(['ini-2', 'ini-3', 'ini-5']);
  expect(
    evalActivity({
      ...activity,
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual(['ini-1', 'ini-3', 'ini-5']);
  expect(
    evalActivity({
      ...activity,
      event: 'x',
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual(['ini-5']);
  expect(
    evalActivity({
      ...activity,
      artifact: 'task',
      event: 'x',
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual([]);
});
