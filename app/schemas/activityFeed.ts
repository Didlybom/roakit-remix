import firebase from 'firebase/compat/app';
import { ParseError } from '../utils/errorUtils';
import { ActivityCount, ActivityMap, Artifact, activitySchema } from './schemas';

interface ActorActivityCount {
  id: string;
  count: number;
}
type TopActors = Record<string, ActorActivityCount[]>;

interface Priority {
  id: number;
  count: number;
}

interface Initiative {
  id: string;
  count: ActivityCount;
  actorIds?: Set<string>; // will be removed before returning for serialization
  actorCount: number;
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

export const getUrl = (metadata: any): { url: string; type: 'jira' | 'github' } | null => {
  if (!metadata?.issue?.uri) {
    return null;
  }
  return {
    url: `${(metadata.issue.uri as string).split('rest')[0]}browse/${metadata.issue.key}`,
    type: 'jira',
  };
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-explicit-any */

const buildTopActorKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

export const TOP_ACTORS_OTHERS_ID = 'TOP_ACTORS_OTHERS';

export const groupActivities = (activities: ActivityMap) => {
  //const actors: Actor[] = [];
  const topActors: TopActors = {};
  const priorities: Priority[] = [];
  let initiatives: Initiative[] = [];

  Object.keys(activities).forEach(activityId => {
    const {
      actorId,
      initiativeId,
      priority: priorityId,
      artifact,
      action,
    } = activities[activityId];

    // top actors
    const topActorKey = buildTopActorKey(artifact, action);
    if (topActors[topActorKey] === undefined) {
      topActors[topActorKey] = [];
    }
    let topActor = topActors[topActorKey].find(a => a.id === actorId);
    if (topActor === undefined) {
      topActor = { id: actorId, count: 0 };
      topActors[topActorKey].push(topActor);
    }
    topActor.count++;

    if (priorityId !== undefined) {
      // priorities
      let priority = priorities.find(p => p.id === priorityId);
      if (priority === undefined) {
        priority = { id: priorityId, count: 0 };
        priorities.push(priority);
      }
      priority.count++;
    }
    priorities.sort((a, b) => (a.id < b.id ? 1 : -1));

    // initiatives
    let initiative;
    if (initiativeId) {
      initiative = initiatives.find(i => i.id === initiativeId);
      if (initiative === undefined) {
        initiative = {
          id: initiativeId,
          count: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 },
          actorIds: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        initiatives.push(initiative);
      }
      initiative.count[artifact]++;
      initiative.actorIds!.add(actorId); // set dedupes
      initiative.effort = Math.floor(Math.random() * 10) + 1; // FIXME effort
    }
  });
  initiatives = initiatives
    .map(i => {
      return { id: i.id, count: i.count, actorCount: i.actorIds!.size, effort: i.effort };
    })
    .sort((a, b) => a.id.localeCompare(b.id));

  Object.keys(topActors).forEach(action => {
    const actors = topActors[action];
    // sort top actors
    actors.sort((a, b) => (a.count < b.count ? 1 : -1));
    // keep top 10
    // calculate count for the rest
    let totalOthers = 0;
    for (let i = 10; i < actors.length; i++) {
      totalOthers += actors[i].count;
    }
    topActors[action] = actors.slice(0, 10);
    if (totalOthers > 0) {
      topActors[action].push({ id: TOP_ACTORS_OTHERS_ID, count: totalOthers });
    }
  });

  return { topActors, priorities, initiatives };
};

export interface UserActivityRow {
  id: string;
  date: Date;
  action: string;
  artifact: Artifact;
  initiativeId: string;
  priority?: number;
  actorId?: string;
  metadata: unknown;
}

export const userActivityRows = (
  snapshot: firebase.firestore.QuerySnapshot,
  includeActorId: boolean
): UserActivityRow[] => {
  const rows: UserActivityRow[] = [];
  snapshot.forEach(doc => {
    const props = activitySchema.safeParse(doc.data());
    if (!props.success) {
      throw new ParseError('Failed to parse activities. ' + props.error.message);
    }
    const row = {
      id: doc.id,
      date: new Date(props.data.createdTimestamp),
      action: props.data.action,
      artifact: props.data.artifact,
      initiativeId: props.data.initiative,
      priority: props.data.priority,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metadata: props.data.metadata,
      ...(includeActorId && { actorId: props.data.actorAccountId }),
    };
    rows.push(row);
  });
  return rows;
};
