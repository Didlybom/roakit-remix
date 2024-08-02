import type { Activity, ArtifactCount, PhaseCount } from '../types/types';
import { buildArtifactActionKey, findTicket } from './activityFeed';

export const TOP_ACTORS_OTHERS_ID = 'TOP_ACTORS_OTHERS';

export type ActorActivityCount = {
  id: string;
  count: number;
};
export type TopActorsMap = Record<string, ActorActivityCount[]>;

type Priority = {
  id: number;
  count: number;
};

type InitiativeWithCounts = {
  id: string;
  key: string;
  artifactCount: ArtifactCount;
  phaseCount: PhaseCount;
  actorIds?: Set<string>;
  actorCount: number;
  effort: number;
};

type InitiativeWithTickets = {
  id: string;
  key: string;
  tickets: string[];
  effort: number;
};

export type GroupedActivities = {
  topActors?: TopActorsMap;
  priorities?: Priority[];
  initiatives?: InitiativeWithCounts[];
  launchItems?: InitiativeWithCounts[];
};

export const groupActivities = (activities: Activity[]): GroupedActivities => {
  const topActors: TopActorsMap = {};
  const priorities: Priority[] = [];
  let initiatives: InitiativeWithCounts[] = [];
  let launchItems: InitiativeWithCounts[] = [];

  activities.forEach(activity => {
    const {
      actorId,
      initiativeId,
      launchItemId,
      priority: priorityId,
      artifact,
      phase,
      action,
    } = activity;

    // top actors
    if (actorId != null) {
      const topActorKey = buildArtifactActionKey(artifact, action);
      if (topActors[topActorKey] == null) {
        topActors[topActorKey] = [];
      }
      let topActor = topActors[topActorKey].find(a => a.id === actorId);
      if (topActor == null) {
        topActor = { id: actorId, count: 0 };
        topActors[topActorKey].push(topActor);
      }
      topActor.count++;
    }

    // priorities
    if (priorityId != null && priorityId !== -1) {
      let priority = priorities.find(p => p.id === priorityId);
      if (priority == null) {
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
      if (initiative == null) {
        initiative = {
          id: initiativeId,
          key: '',
          artifactCount: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 },
          phaseCount: { design: 0, dev: 0, test: 0, deploy: 0, stabilize: 0, ops: 0 },
          actorIds: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        initiatives.push(initiative);
      }
      initiative.artifactCount[artifact]++;
      if (actorId != null) {
        initiative.actorIds!.add(actorId); // the set dedupes
      }
      initiative.effort += activity.effort ?? 0;
    }

    // launch items
    let launchItem;
    if (launchItemId) {
      launchItem = launchItems.find(i => i.id === launchItemId);
      if (launchItem == null) {
        launchItem = {
          id: launchItemId,
          key: '',
          artifactCount: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 },
          phaseCount: { design: 0, dev: 0, test: 0, deploy: 0, stabilize: 0, ops: 0 },
          actorIds: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        launchItems.push(launchItem);
      }
      launchItem.artifactCount![artifact]++;
      if (phase) {
        launchItem.phaseCount![phase]++;
      }
      if (actorId != null) {
        launchItem.actorIds!.add(actorId); // the set dedupes
      }
      launchItem.effort += activity.effort ?? 0;
    }
  });

  initiatives = initiatives.map(initiative => {
    const { actorIds, ...initiativeFields } = initiative;
    return { ...initiativeFields, actorCount: actorIds?.size ?? 0 };
  });

  launchItems = launchItems.map(launchItem => {
    const { actorIds, ...launchItemFields } = launchItem;
    return { ...launchItemFields, actorCount: actorIds?.size ?? 0 };
  });

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

  return { topActors, priorities, initiatives, launchItems };
};

export type GroupedActorActivities = {
  priorities?: Priority[];
  launchItems?: InitiativeWithTickets[];
  tickets: string[];
  ongoingCount: number;
};

export const groupActorActivities = (activities: Activity[]): GroupedActorActivities => {
  let launchItems: InitiativeWithTickets[] = [];
  let tickets: string[] = [];
  let ongoingCount = 0;

  activities.forEach(activity => {
    const { launchItemId, ongoing } = activity;

    if (ongoing) {
      ongoingCount++;
    }
    // tickets
    const ticket = findTicket(activity.metadata);
    if (ticket && !tickets.includes(ticket)) {
      tickets.push(ticket);
    }

    // launch items
    let launchItem;
    if (launchItemId) {
      launchItem = launchItems.find(i => i.id === launchItemId);
      if (launchItem == null) {
        launchItem = {
          id: launchItemId,
          key: '',
          tickets: [],
          effort: 0,
        };
        launchItems.push(launchItem);
      }
      if (ticket && !launchItem.tickets.includes(ticket)) {
        launchItem.tickets!.push(ticket);
      }
      launchItem.effort += activity.effort ?? 0;
    }
  });

  launchItems = launchItems.map(launchItem => {
    const { tickets, ...launchItemFields } = launchItem;
    return { ...launchItemFields, tickets: [...tickets] };
  });

  return { launchItems, tickets, ongoingCount };
};
