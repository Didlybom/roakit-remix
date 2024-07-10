import type { Activity, ArtifactCount, PhaseCount } from '../types/types';
import { buildArtifactActionKey } from './activityFeed';

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

type Initiative = {
  id: string;
  key: string;
  artifactCount: ArtifactCount;
  phaseCount: PhaseCount;
  actorIds?: Set<string>; // will be removed before returning for serialization
  actorCount: number;
  effort: number;
};

export type GroupedActivities = {
  topActors?: TopActorsMap;
  priorities?: Priority[];
  initiatives?: Initiative[];
  launchItems?: Initiative[];
};

export const groupActivities = (activities: Activity[]): GroupedActivities => {
  const topActors: TopActorsMap = {};
  const priorities: Priority[] = [];
  let initiatives: Initiative[] = [];
  let launchItems: Initiative[] = [];

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
    if (actorId !== undefined) {
      const topActorKey = buildArtifactActionKey(artifact, action);
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
      if (actorId !== undefined) {
        initiative.actorIds!.add(actorId); // the set dedupes
      }
      initiative.effort += activity.effort ?? 0;
    }

    // launch items
    let launchItem;
    if (launchItemId) {
      launchItem = launchItems.find(i => i.id === launchItemId);
      if (launchItem === undefined) {
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
      launchItem.artifactCount[artifact]++;
      if (phase) {
        launchItem.phaseCount[phase]++;
      }
      if (actorId !== undefined) {
        launchItem.actorIds!.add(actorId); // the set dedupes
      }
      launchItem.effort = activity.effort ?? 0;
    }
  });

  initiatives = initiatives.map(i => ({
    id: i.id,
    key: i.key,
    artifactCount: i.artifactCount,
    phaseCount: i.phaseCount,
    actorCount: i.actorIds!.size,
    effort: i.effort,
  }));

  launchItems = launchItems.map(i => ({
    id: i.id,
    key: i.key,
    artifactCount: i.artifactCount,
    phaseCount: i.phaseCount,
    actorCount: i.actorIds!.size,
    effort: i.effort,
  }));

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
