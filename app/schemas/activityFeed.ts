import { ActivityMap } from './schemas';

export const groupActivities = (activities: ActivityMap) => {
  const actors: Record<string, { activityIds: string[] }> = {};
  const initiatives: Record<string, { activityCount: number; actorIds: string[] }> = {};

  Object.keys(activities).forEach(activityId => {
    const { actorId, initiativeId } = activities[activityId];

    // actors
    if (!actors[actorId]) {
      actors[actorId] = { activityIds: [] };
    }
    actors[actorId].activityIds.push(activityId);

    // initiatives
    if (initiativeId) {
      if (!initiatives[initiativeId]) {
        initiatives[initiativeId] = { activityCount: 0, actorIds: [] };
      }
      initiatives[initiativeId].activityCount++;
      if (!initiatives[initiativeId].actorIds.includes(actorId)) {
        initiatives[initiativeId].actorIds.push(actorId);
      }
    }
  });

  return { actors, initiatives };
};
