import type {
  AccountMap,
  AccountToIdentityRecord,
  Activity,
  ActivityCount,
  ActivityMetadata,
  ActorRecord,
  Identity,
  TicketRecord,
} from '../types/types';
import { findJiraTickets } from './stringUtils';

export const artifactActions = new Map<string, { sortOrder: number; label: string }>([
  ['task-created', { sortOrder: 1, label: 'Task creation' }],
  ['task-updated', { sortOrder: 2, label: 'Task update' }],
  ['task-deleted', { sortOrder: 3, label: 'Task deletion' }],
  ['taskOrg-created', { sortOrder: 4, label: 'Task org. creation' }],
  ['taskOrg-updated', { sortOrder: 5, label: 'Task org. update' }],
  ['code-created', { sortOrder: 6, label: 'Code creation' }],
  ['code-updated', { sortOrder: 7, label: 'Code update' }],
  ['code-deleted', { sortOrder: 8, label: 'Code deletion' }],
  ['codeOrg-created', { sortOrder: 9, label: 'Code org. creation' }],
  ['codeOrg-updated', { sortOrder: 10, label: 'Code org. update' }],
  ['codeOrg-deleted', { sortOrder: 11, label: 'Code org. deletion' }],
  ['docOrg-created', { sortOrder: 12, label: 'Doc org. creation' }],
  ['doc-created', { sortOrder: 13, label: 'Doc creation' }],
  ['doc-updated', { sortOrder: 14, label: 'Doc update' }],
]);

// return the first ticket referenced from metadata fields
export const findTicket = (metadata?: ActivityMetadata) => {
  if (!metadata) {
    return undefined;
  }
  const pullRequestRef = metadata.pullRequest?.ref;
  if (pullRequestRef) {
    const tickets = findJiraTickets(pullRequestRef);
    if (tickets) {
      return tickets[0];
    }
  }
  const commits = metadata.commits;
  if (commits) {
    for (const commit of commits) {
      const tickets = findJiraTickets(commit.message);
      if (tickets) {
        return tickets[0];
      }
    }
  }
  return undefined;
};

export const inferPriority = (tickets: TicketRecord, metadata: ActivityMetadata) => {
  const ticket = findTicket(metadata);
  if (!ticket) {
    return -1;
  }
  return tickets[ticket] ?? -1;
};

export const buildArtifactActionKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

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
  count: ActivityCount;
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

export const identifyAccounts = (
  accounts: AccountMap,
  identities: Identity[],
  identityAccountMap: AccountToIdentityRecord
) => {
  const actors: ActorRecord = {};

  accounts.forEach((account, accountId) => {
    const identityId = identityAccountMap[accountId];
    if (identityId) {
      const identity = identities.find(i => i.id === identityId);
      if (!identity) {
        return;
      }
      if (!actors[identityId]) {
        actors[identityId] = {
          name: identity.displayName ?? identityId,
          email: identity.email,
          accounts: identity.accounts.map(a => ({ id: a.id, type: a.type, url: a.url })),
        };
      }
      // add account url if identity doesn't have it
      const identityAccount = actors[identityId].accounts?.find(a => a.id === accountId);
      if (identityAccount && !identityAccount?.url) {
        identityAccount.url = account.url;
      }
    } else {
      // no identity, use the accountId as key
      actors[accountId] = {
        name: account.name || accountId,
        ...(account.url && { urls: [{ type: account.type, url: account.url }] }),
      };
    }
  });

  return actors;
};

export const identifyActivities = (activities: Activity[], accountMap: AccountToIdentityRecord) => {
  activities.forEach(activity => {
    if (activity.actorId && accountMap[activity.actorId]) {
      activity.actorId = accountMap[activity.actorId];
    }
  });
  return activities;
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
          count: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 },
          actorIds: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        initiatives.push(initiative);
      }
      initiative.count[artifact]++;
      if (actorId !== undefined) {
        initiative.actorIds!.add(actorId); // the set dedupes
      }
      initiative.effort++; // for now, the number of activities
    }

    // launch items
    let launchItem;
    if (launchItemId) {
      launchItem = launchItems.find(i => i.id === launchItemId);
      if (launchItem === undefined) {
        launchItem = {
          id: launchItemId,
          key: '',
          count: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 },
          actorIds: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        launchItems.push(launchItem);
      }
      launchItem.count[artifact]++;
      if (actorId !== undefined) {
        launchItem.actorIds!.add(actorId); // the set dedupes
      }
      launchItem.effort++; // for now, the number of activities
    }
  });

  initiatives = initiatives.map(i => ({
    id: i.id,
    key: i.key,
    count: i.count,
    actorCount: i.actorIds!.size,
    effort: i.effort,
  }));

  launchItems = launchItems.map(i => ({
    id: i.id,
    key: i.key,
    count: i.count,
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

const consolidateToNewActivity = (
  activities: Activity[],
  oldActivityIndex: number,
  oldActivity: Activity,
  newActivity: Activity
) => {
  newActivity.consolidatedIds = oldActivity.consolidatedIds ?? [];
  newActivity.consolidatedIds.push(oldActivity.id);
  activities.splice(oldActivityIndex, 1);
  activities.push(newActivity);
};

export const consolidateAndPushActivity = (newActivity: Activity, activities: Activity[]) => {
  if (!newActivity.metadata) {
    activities.push(newActivity);
    return activities;
  }

  // PR
  if (newActivity.metadata?.pullRequest?.uri) {
    const indexPRActivity = activities.findLastIndex(
      a =>
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
        a.action === newActivity.action &&
        a.event === newActivity.event &&
        a.metadata?.pullRequest?.uri &&
        a.metadata.pullRequest.uri === newActivity.metadata?.pullRequest?.uri &&
        a.metadata?.codeAction
    );
    if (indexPRActivity >= 0 && newActivity.metadata.codeAction) {
      const foundActivity = activities[indexPRActivity];

      const foundCodeAction = foundActivity.metadata!.codeAction!;
      const codeActions = new Set<string>(
        Array.isArray(foundCodeAction) ? foundCodeAction : [foundCodeAction]
      );
      codeActions.add(newActivity.metadata.codeAction as string);
      if (newActivity.timestamp >= foundActivity.timestamp) {
        newActivity.metadata.codeAction = [...codeActions];
        consolidateToNewActivity(activities, indexPRActivity, foundActivity, newActivity);
      } else {
        foundActivity.metadata!.codeAction = [...codeActions];
        foundActivity.consolidatedIds = [...(foundActivity.consolidatedIds ?? []), newActivity.id];
      }
      return activities;
    }
  }

  // Code push
  if (newActivity.metadata?.commits?.length) {
    const indexPushActivity = activities.findLastIndex(
      a =>
        a.event === 'push' &&
        a.event === newActivity.event &&
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
        a.action === newActivity.action &&
        a.event === newActivity.event &&
        a.metadata?.commits
    );
    if (indexPushActivity >= 0) {
      const foundActivity = activities[indexPushActivity];
      const urls = foundActivity.metadata!.commits!.map(c => c.url);
      // if at least one commit is identical, we consolidate the 2 activities
      if (newActivity.metadata.commits.some(a => urls.indexOf(a.url) !== -1)) {
        const commits = [...foundActivity.metadata!.commits!];
        newActivity.metadata.commits.forEach(commit => {
          if (!commits.some(c => c.url === commit.url)) {
            commits.push(commit);
          }
        });
        if (newActivity.timestamp >= foundActivity.timestamp) {
          newActivity.metadata.commits = commits;
          consolidateToNewActivity(activities, indexPushActivity, foundActivity, newActivity);
        } else {
          foundActivity.metadata!.commits = commits;
          foundActivity.consolidatedIds = [
            ...(foundActivity.consolidatedIds ?? []),
            newActivity.id,
          ];
        }
        return activities;
      }
    }
  }

  // Issue changelog
  if (newActivity.metadata?.issue?.key && newActivity.metadata.changeLog) {
    const indexIssueActivity = activities.findLastIndex(
      a =>
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
        a.action === newActivity.action &&
        a.event === newActivity.event &&
        a.metadata?.issue?.key &&
        a.metadata.issue.key === newActivity.metadata?.issue?.key &&
        a.metadata?.changeLog
    );
    if (indexIssueActivity >= 0 && newActivity.metadata.changeLog) {
      const foundActivity = activities[indexIssueActivity];
      if (newActivity.timestamp >= foundActivity.timestamp) {
        newActivity.metadata.changeLog.push(...foundActivity.metadata!.changeLog!);
        consolidateToNewActivity(activities, indexIssueActivity, foundActivity, newActivity);
      } else {
        foundActivity.metadata!.changeLog!.push(...newActivity.metadata.changeLog);
        foundActivity.consolidatedIds = [...(foundActivity.consolidatedIds ?? []), newActivity.id];
      }
      return activities;
    }
  }

  // Confluence page
  if (newActivity.metadata?.page?.id) {
    const indexPageActivity = activities.findLastIndex(
      a =>
        a.action === newActivity.action &&
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
        a.event === newActivity.event &&
        a.metadata?.page &&
        a.metadata.page.id === newActivity.metadata?.page?.id
    );
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      if (newActivity.timestamp >= foundActivity.timestamp) {
        if (
          newActivity.metadata.page.version &&
          newActivity.metadata.page.version != foundActivity.metadata!.page!.version
        ) {
          newActivity.metadata.page.version += ', ' + foundActivity.metadata!.page!.version;
        }
        consolidateToNewActivity(activities, indexPageActivity, foundActivity, newActivity);
      } else {
        if (
          newActivity.metadata.page.version &&
          newActivity.metadata.page.version != foundActivity.metadata!.page!.version
        ) {
          foundActivity.metadata!.page!.version += ', ' + newActivity.metadata?.page.version;
        }
        foundActivity.consolidatedIds = [...(foundActivity.consolidatedIds ?? []), newActivity.id];
      }
      return activities;
    }
  }

  // no similar activity found, push it as new
  activities.push(newActivity);
  return activities;
};
