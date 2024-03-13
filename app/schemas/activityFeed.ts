import { ActivityCount, ActivityMap } from './schemas';

export const groupActivities = (activities: ActivityMap) => {
  const actors: Record<string, { activityIds: string[] }> = {};
  const initiatives: Record<
    string,
    {
      activityCount: ActivityCount;
      actorIds: string[];
    }
  > = {};

  Object.keys(activities).forEach(activityId => {
    const { actorId, initiativeId, type } = activities[activityId];

    // actors
    if (!actors[actorId]) {
      actors[actorId] = { activityIds: [] };
    }
    actors[actorId].activityIds.push(activityId);

    // initiatives
    if (initiativeId) {
      if (!initiatives[initiativeId]) {
        initiatives[initiativeId] = {
          activityCount: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 },
          actorIds: [],
        };
      }
      initiatives[initiativeId].activityCount[type]++;
      if (!initiatives[initiativeId].actorIds.includes(actorId)) {
        initiatives[initiativeId].actorIds.push(actorId);
      }
    }
  });

  return { actors, initiatives };
};
