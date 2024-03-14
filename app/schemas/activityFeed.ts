import { ActivityCount, ActivityMap } from './schemas';

interface Actor {
  id: string;
  activityIds: string[];
}

interface Initiative {
  id: string;
  activityCount: ActivityCount;
  actorIds: string[];
  effort: number;
}

export const groupActivities = (activities: ActivityMap) => {
  const actors: Actor[] = [];
  const initiatives: Initiative[] = [];

  Object.keys(activities).forEach(activityId => {
    const { actorId, initiativeId, artifact } = activities[activityId];

    // actors
    let actor = actors.find(a => a.id === actorId);
    if (!actor) {
      actor = { id: actorId, activityIds: [] };
      actors.push(actor);
    }
    actor.activityIds.push(activityId);

    // initiatives
    let initiative;
    if (initiativeId) {
      initiative = initiatives.find(i => i.id === initiativeId);
      if (!initiative) {
        initiative = {
          id: initiativeId,
          activityCount: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 },
          actorIds: [],
          effort: 0,
        };
        initiatives.push(initiative);
      }
      initiative.activityCount[artifact]++;
      if (!initiative.actorIds.includes(actorId)) {
        initiative.actorIds.push(actorId);
      }
      initiative.effort = Math.floor(Math.random() * 10) + 1; // FIXME effort
    }
  });

  return { actors, initiatives };
};
