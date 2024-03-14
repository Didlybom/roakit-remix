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

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
export const getSummary = (metadata: any) => {
  if (metadata?.issue) {
    return metadata.issue.key + ' ' + metadata.issue.summary;
  }
  if (metadata?.mimeType) {
    return metadata.mimeType as string;
  }
  return '';
};

export const getUrl = (metadata: any) => {
  if (!metadata?.issue?.uri) {
    return null;
  }
  return `${(metadata.issue.uri as string).split('rest')[0]}browse/${metadata.issue.key}`;
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-explicit-any */

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
