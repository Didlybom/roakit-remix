import { findJiraTickets } from '../utils/stringUtils';
import {
  AccountMap,
  AccountToIdentityRecord,
  ActivityChangeLog,
  ActivityCount,
  ActivityMap,
  ActivityMetadata,
  ActorRecord,
  IdentityData,
  TicketRecord,
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
  ['codeOrg-deleted', { sortOrder: 13, label: 'Code organization deletion' }],
]);

const findPriority = (str: string, tickets: TicketRecord) => {
  for (const ticket of findJiraTickets(str)) {
    if (tickets[ticket]) {
      return tickets[ticket];
    }
  }
  return undefined;
};

export const inferPriority = (tickets: TicketRecord, metadata: ActivityMetadata) => {
  const pullRequestRef = metadata.pullRequest?.ref;
  if (pullRequestRef) {
    const priority = findPriority(pullRequestRef, tickets);
    if (priority) {
      return priority;
    }
  }
  const commits = metadata.commits as { message: string }[];
  if (commits) {
    for (const commit of commits) {
      const priority = findPriority(commit.message, tickets);
      if (priority) {
        return priority;
      }
    }
  }

  return -1;
};

export const getSummary = (metadata: ActivityMetadata) => {
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
    return metadata.pullRequestComment.body;
  }
  if (metadata?.commits?.length) {
    return metadata.commits[0].message;
  }
  return '';
};

const transitionString = (prefix: string, changeLog: ActivityChangeLog) =>
  prefix + changeLog.oldValue + ' → ' + changeLog.newValue;

export const getSummaryAction = (metadata: ActivityMetadata) => {
  try {
    if (metadata?.issue) {
      const actions: string[] = [];
      metadata.changeLog?.forEach(changeLog => {
        if (changeLog.field === 'status' && changeLog.oldValue && changeLog.newValue) {
          actions.push('Status: ' + changeLog.oldValue + ' → ' + changeLog.newValue);
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Assignee: ', changeLog));
        }
        if (changeLog.field === 'assignee' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Assignee: ' + changeLog.newValue);
        }
        if (changeLog.field === 'assignee' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unassigned: ' + changeLog.oldValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Labels: ', changeLog));
        }
        if (changeLog.field === 'labels' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Labeled: ' + changeLog.newValue);
        }
        if (changeLog.field === 'labels' && changeLog.oldValue && !changeLog.newValue) {
          actions.push('Unlabeled: ' + changeLog.oldValue);
        }
        if (changeLog.field === 'Link' && changeLog.newValue) {
          actions.push(changeLog.newValue); // "This issue relates to XXX"
        }
        if (changeLog.field === 'Domain' && changeLog.newValue) {
          actions.push('Domain: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Platform' && changeLog.newValue) {
          actions.push('Platform: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Epic Link' && changeLog.newValue) {
          actions.push('Epic Link');
        }
        if (changeLog.field === 'Rank' && changeLog.newValue) {
          actions.push(changeLog.newValue); // "Ranked higher"
        }
        // FIXME NURSA specific custom fields
        if (changeLog.field === 'Start Date' && !changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Start  date: ', changeLog));
        }
        if (changeLog.field === 'Start date' && changeLog.newValue) {
          actions.push('Start date: ' + changeLog.newValue);
        }
        if (
          changeLog.field === 'Expected Delivery Date' &&
          changeLog.oldValue &&
          changeLog.newValue
        ) {
          actions.push(transitionString('Expected delivery date: ', changeLog));
        }
        if (
          changeLog.field === 'Expected Delivery Date' &&
          !changeLog.oldValue &&
          changeLog.newValue
        ) {
          actions.push('Expected delivery date: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Sprint' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Sprint: ', changeLog));
        }
        if (changeLog.field === 'Sprint' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Sprint: ' + changeLog.newValue);
        }
        if (changeLog.field === 'Story Points' && changeLog.oldValue && changeLog.newValue) {
          actions.push(transitionString('Story Points: ', changeLog));
        }
        if (changeLog.field === 'Story Points' && !changeLog.oldValue && changeLog.newValue) {
          actions.push('Story Points: ' + changeLog.newValue);
        }
        if (changeLog.field === 'summary') {
          actions.push('Updated summary');
        }
        if (changeLog.field === 'description') {
          actions.push('Updated description');
        }
      });
      return actions.join(', ');
    }
    if (metadata?.codeAction) {
      const codeAction = metadata.codeAction;
      if (codeAction === 'opened') {
        return 'PR opened';
      }
      if (codeAction === 'ready_for_review') {
        return 'PR ready for review';
      }
      if (codeAction === 'review_requested') {
        return 'PR review requested';
      }
      if (codeAction === 'submitted') {
        return 'PR submitted';
      }
      if (codeAction === 'assigned') {
        return 'PR assigned';
      }
      if (codeAction === 'resolved') {
        return 'PR discussion resolved';
      }
      if (codeAction === 'edited') {
        return 'PR edited';
      }
      if (codeAction === 'labeled') {
        return 'PR labeled';
      }
      if (codeAction === 'closed') {
        return 'PR closed';
      }
      if (codeAction === 'dismissed') {
        return 'PR dismissed';
      }
      if (codeAction === 'created' && metadata.pullRequestComment) {
        return 'PR commented';
      }
    }
  } catch (e) {
    return '';
  }
};

export const getUrl = (
  metadata: ActivityMetadata
): { url: string; type: 'jira' | 'github' } | null => {
  if (metadata?.issue?.uri) {
    return {
      url: `${metadata.issue.uri.split('rest')[0]}browse/${metadata.issue.key}`,
      type: 'jira',
    };
  }
  if (metadata?.pullRequest?.uri) {
    return {
      url: metadata.pullRequest.uri,
      type: 'github',
    };
  }
  if (metadata?.pullRequestComment?.uri) {
    return {
      url: metadata.pullRequestComment.uri,
      type: 'github',
    };
  }
  if (metadata?.commits?.length) {
    return {
      url: metadata.commits[0].url!,
      type: 'github',
    };
  }
  return null;
};

export const buildArtifactActionKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

export const TOP_ACTORS_OTHERS_ID = 'TOP_ACTORS_OTHERS';

export interface ActorActivityCount {
  id: string;
  count: number;
}
export type TopActorsMap = Record<string, ActorActivityCount[]>;

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
          urls: identity.accounts
            ?.filter(a => a.url)
            .map(a => {
              return { type: a.type, url: a.url ?? '' };
            }),
        };
      }
      // add account url if identity doesn't have them
      if (account.url && !actors[identityId].urls?.find(u => u.type === account.type)) {
        actors[identityId].urls?.push({ type: account.type, url: account.url });
      }
    } else {
      actors[accountId] = {
        name: account.name || accountId,
        ...(account.url && { urls: [{ type: account.type, url: account.url }] }),
      };
    }
  });

  return actors;
};

export const identifyActivities = (
  activities: ActivityMap,
  accountMap: AccountToIdentityRecord
) => {
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

export const getTopActors = (activities: ActivityMap) => {
  const topActors: TopActorsMap = {};

  activities.forEach(activity => {
    const { actorId, artifact, action } = activity;

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

  return topActors;
};
