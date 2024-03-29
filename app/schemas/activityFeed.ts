import {
  AccountMap,
  ActivityCount,
  ActivityMap,
  ActorMap,
  IdentityAccountMap,
  IdentityData,
} from './schemas';

export const artifactActions = new Map<string, { sortOrder: number; label: string }>([
  ['task-created', { sortOrder: 1, label: 'Task creation' }],
  ['task-updated', { sortOrder: 2, label: 'Task update' }],
  ['task-deleted', { sortOrder: 3, label: 'Task deletion' }],
  ['task-disabled', { sortOrder: 4, label: 'Task disable' }],
  ['taskOrg-created', { sortOrder: 5, label: 'Task organization creation' }],
  ['taskOrg-updated', { sortOrder: 6, label: 'Task organization update' }],
  ['code-created', { sortOrder: 7, label: 'Code creation' }],
  ['code-updated', { sortOrder: 8, label: 'Code update' }],
  ['code-deleted', { sortOrder: 9, label: 'Code deletion' }],
  ['code-unknown', { sortOrder: 10, label: 'Code [unknown]' }],
  ['codeOrg-created', { sortOrder: 11, label: 'Code organization creation' }],
  ['codeOrg-updated', { sortOrder: 12, label: 'Code organization update' }],
]);

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
  if (metadata?.commits?.length) {
    return metadata.commits[0].message as string;
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
  if (metadata?.commits?.length) {
    return {
      url: metadata.commits[0].url as string,
      type: 'github',
    };
  }
  return null;
};
/* eslint-enable @typescript-eslint/no-unsafe-member-access */
/* eslint-enable @typescript-eslint/no-explicit-any */

export const buildArtifactActionKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

export const TOP_ACTORS_OTHERS_ID = 'TOP_ACTORS_OTHERS';

interface ActorActivityCount {
  id: string;
  count: number;
}
type TopActorsMap = Record<string, ActorActivityCount[]>;

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

export const identifyAccounts = (
  accounts: AccountMap,
  identities: IdentityData[],
  identityAccountMap: IdentityAccountMap
) => {
  const actors: ActorMap = {};

  accounts.forEach((account, accountId) => {
    const identityId = identityAccountMap[accountId];
    if (identityId) {
      const identity = identities.find(i => i.id === identityId);
      if (!identity) {
        return;
      }
      actors[identityId] = {
        name: identity.displayName ?? identityId,
        email: identity.email,
        urls: identity.accounts
          ?.filter(a => a.url)
          .map(a => {
            return { type: a.type, url: a.url ?? '' };
          }),
      };
    } else {
      actors[accountId] = {
        name: account.name || accountId,
        ...(account.url && { urls: [{ type: account.type, url: account.url }] }),
      };
    }
  });

  return actors;
};

export const identifyActivities = (activities: ActivityMap, accountMap: IdentityAccountMap) => {
  activities.forEach(activity => {
    if (activity.actorId && accountMap[activity.actorId]) {
      activity.actorId = accountMap[activity.actorId];
    }
  });
  return activities;
};

export const groupActivities = (activities: ActivityMap) => {
  const topActors: TopActorsMap = {};
  const priorities: Priority[] = [];
  let initiatives: Initiative[] = [];

  activities.forEach(activity => {
    const { actorId, initiativeId, priority: priorityId, artifact, action } = activity;

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
