import firebase from 'firebase/compat/app';
import { inferPriority } from '../utils/activityUtils';
import { ParseError } from '../utils/errorUtils';
import { ActivityCount, ActivityMap, Artifact, TicketMap, activitySchema } from './schemas';

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
  if (metadata?.attachment?.filename) {
    return metadata.attachment.mimeType ?
        `Attached ${metadata.attachment.filename} [${metadata.attachment.mimeType}]`
      : `Attached ${metadata.attachment.filename}`;
  }
  if (metadata?.sprint) {
    return `Sprint ${metadata.sprint.name} ${metadata.sprint.state}`;
  }
  if (metadata?.worklog) {
    return 'Worklog';
  }
  if (metadata?.pullRequest) {
    return `${metadata.pullRequest.codeAction ?? ''} ${metadata.pullRequest.title}`;
  }
  if (metadata?.pullRequestComment) {
    return metadata.pullRequestComment.body as string;
  }
  return '';
};

export const getUrl = (metadata: any): { url: string; type: 'jira' | 'github' } | null => {
  if (metadata?.issue?.uri) {
    return {
      url: `${(metadata.issue.uri as string).split('rest')[0]}browse/${metadata.issue.key}`,
      type: 'jira',
    };
  }
  if (metadata?.pullRequest?.uri) {
    return {
      url: metadata.pullRequest.uri as string,
      type: 'github',
    };
  }
  if (metadata?.pullRequestComment?.uri) {
    return {
      url: metadata.pullRequestComment.uri as string,
      type: 'github',
    };
  }
  return null;
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-explicit-any */

const buildTopActorKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

export const TOP_ACTORS_OTHERS_ID = 'TOP_ACTORS_OTHERS';

export const groupActivities = (activities: ActivityMap) => {
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
    if (actorId !== undefined) {
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
    }

    if (priorityId !== undefined && priorityId !== -1) {
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
      if (actorId !== undefined) {
        initiative.actorIds!.add(actorId); // set dedupes
      }
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
  event?: string;
  artifact: Artifact;
  initiativeId: string;
  priority?: number;
  actorId?: string;
  metadata: unknown;
  objectId?: string;
}

export const userActivityRows = (
  snapshot: firebase.firestore.QuerySnapshot,
  tickets: TicketMap,
  includeActorId: boolean
): UserActivityRow[] => {
  const rows: UserActivityRow[] = [];
  snapshot.forEach(doc => {
    const props = activitySchema.safeParse(doc.data());
    if (!props.success) {
      throw new ParseError('Failed to parse activities. ' + props.error.message);
    }
    let priority = props.data.priority;
    if (priority === undefined || priority === -1) {
      priority = inferPriority(tickets, props.data.metadata);
    }
    const row: UserActivityRow = {
      id: doc.id,
      date: new Date(props.data.createdTimestamp),
      action: props.data.action,
      event: props.data.event,
      artifact: props.data.artifact,
      initiativeId: props.data.initiative,
      priority,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      metadata: props.data.metadata,
      ...(includeActorId && { actorId: props.data.actorAccountId ?? '-1' }),
      objectId: props.data.objectId, // for debugging
    };
    rows.push(row);
  });
  return rows;
};
