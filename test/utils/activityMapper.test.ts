import {
  clearActivityMapperCache,
  compileActivityMappers,
  mapActivity,
} from '../../app/processors/activityMapper';
import type { Activity } from '../../app/types/types';

test('evalActivity', () => {
  const mappers = {
    'ini-1': { key: 'k1', activityMapper: `event == "abc"` },
    'ini-2': { key: 'k2', activityMapper: `metadata.issue.project.id == "proj-a"  ` },
    'ini-3': {
      key: 'k3',
      activityMapper: `event == "abc" or   metadata.issue.project.id == "proj-a"`,
    },
    'ini-4': {
      key: 'k4',
      activityMapper: `event== "abc" and metadata.issue.project.id =="proj-a"`,
    },
    'ini-5': {
      key: 'k5',
      activityMapper: ` (event == "abc" and metadata.issue.project.id == "proj-a")or artifact == "code"`,
    },
    'ini-6': { key: 'k6', activityMapper: `xxx ~= "xxx" or metadata.label.name ~= "QWer"` },
  };
  clearActivityMapperCache();
  compileActivityMappers(mappers);

  const activity: Activity = {
    initiativeId: '',
    id: 'id',
    action: 'action',
    createdTimestamp: 0,
    timestamp: 0,
    artifact: 'code',
    event: 'abc',
    metadata: { issue: { key: 'iss-a', project: { id: 'proj-a' } } },
  };

  expect(mapActivity(activity)).toEqual(['ini-1', 'ini-2', 'ini-3', 'ini-4', 'ini-5']);
  expect(mapActivity({ ...activity, event: 'x' })).toEqual(['ini-2', 'ini-3', 'ini-5']);
  expect(
    mapActivity({
      ...activity,
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual(['ini-1', 'ini-3', 'ini-5']);
  expect(
    mapActivity({
      ...activity,
      event: 'x',
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual(['ini-5']);
  expect(
    mapActivity({
      ...activity,
      artifact: 'task',
      event: 'x',
      metadata: { issue: { key: 'iss-a', project: { id: 'x' } } },
    })
  ).toEqual([]);
  expect(
    mapActivity({
      ...activity,
      metadata: { label: { contentType: 'page', name: 'qwerty' } },
    })
  ).toEqual(['ini-1', 'ini-3', 'ini-5', 'ini-6']);
  expect(
    mapActivity({
      ...activity,
      metadata: { label: { contentType: 'page', name: 'x' } },
    })
  ).toEqual(['ini-1', 'ini-3', 'ini-5']);
});

test('evalActivityWithArrayField', () => {
  const mappers = {
    'ini-1': { key: 'k2', activityMapper: `metadata.commits_1st.message ~= "abc"` },
    'ini-2': { key: 'k2', activityMapper: `metadata.commits.message ~= "abc"` },
    'ini-3': { key: 'k2', activityMapper: `metadata.commits_1st.message ~= "eee"` },
  };
  clearActivityMapperCache();
  compileActivityMappers(mappers);

  const activity: Activity = {
    initiativeId: '',
    id: 'id',
    action: 'action',
    createdTimestamp: 0,
    timestamp: 0,
    artifact: 'code',
    event: 'abc',
    metadata: { commits: [{ message: 'xxx abc yyy' }, { message: 'zzz' }] },
  };

  expect(mapActivity(activity)).toEqual(['ini-1']);
});
