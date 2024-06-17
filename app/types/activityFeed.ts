import { findJiraTickets, mimeTypeToType } from '../utils/stringUtils';
import type {
  AccountMap,
  AccountToIdentityRecord,
  Activity,
  ActivityChangeLog,
  ActivityCount,
  ActivityMetadata,
  ActorRecord,
  Identity,
  TicketRecord,
} from './types';

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

export const getSummary = (activity: Omit<Activity, 'id'>) => {
  const metadata = activity.metadata;
  if (metadata?.issue) {
    return metadata.issue.key + ' ' + metadata.issue.summary;
  }
  if (metadata?.attachment?.filename) {
    const type = metadata.attachment.mimeType ? mimeTypeToType(metadata.attachment.mimeType) : null;
    return type ?
        `Attached ${type} ${metadata.attachment.filename}`
      : `Attached ${metadata.attachment.filename}`;
  }
  if (metadata?.sprint) {
    return `Sprint ${metadata.sprint.name} ${metadata.sprint.state}`;
  }
  if (metadata?.worklog) {
    return 'Worklog';
  }

  if (metadata?.space) {
    return `Space: ${metadata.space.title}`;
  }
  if (metadata?.page) {
    return `${metadata.page.title}`;
  }
  if (metadata?.comment) {
    return `Commented ${metadata.comment.parent?.title}`;
  }
  if (metadata?.label) {
    return `Labeled ${metadata?.label.contentType ? `${metadata?.label.contentType} ` : ''}${metadata?.label.name}`;
  }
  if (metadata?.attachments) {
    const files = metadata.attachments.files.map(f => f.filename).join(', ');
    return `Attached ${files} to ${metadata.attachments.parent?.type} ${metadata.attachments.parent?.title}`;
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
  if (activity.event === 'organization') {
    return 'Organization';
  }
  if (activity.event === 'repository') {
    return 'Repository';
  }
  if (activity.event === 'repository_ruleset') {
    return 'Repository ruleset';
  }
  if (activity.event === 'project_created') {
    return 'Project created';
  }
  return '';
};

const transitionString = (prefix: string, changeLog: ActivityChangeLog) =>
  prefix + changeLog.oldValue + ' → ' + changeLog.newValue;

const codeActionString = (codeAction: string, metadata: ActivityMetadata) => {
  if (codeAction === 'opened') {
    return 'opened';
  }
  if (codeAction === 'ready_for_review') {
    return 'ready for review';
  }
  if (codeAction === 'review_requested') {
    return 'review requested';
  }
  if (codeAction === 'submitted') {
    return 'submitted';
  }
  if (codeAction === 'assigned') {
    return 'assigned';
  }
  if (codeAction === 'resolved') {
    return 'discussion resolved';
  }
  if (codeAction === 'edited') {
    return 'edited';
  }
  if (codeAction === 'labeled') {
    return 'labeled';
  }
  if (codeAction === 'closed') {
    return 'closed';
  }
  if (codeAction === 'dismissed') {
    return 'dismissed';
  }
  if (codeAction === 'created' && metadata.pullRequestComment) {
    return 'commented';
  }
  if (codeAction === 'deleted' && metadata.pullRequestComment) {
    return 'comment deleted';
  }
};

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
        if (changeLog.field === 'Fix Version' && changeLog.newValue) {
          actions.push('Fix Version: ' + changeLog.newValue);
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
    if (metadata?.attachment) {
      return metadata.attachment.uri;
    }
    if (metadata?.attachments?.files?.length) {
      return metadata.attachments.files[0].uri;
    }

    if (metadata?.codeAction && (metadata?.pullRequest || metadata?.pullRequestComment)) {
      const codeAction = metadata.codeAction;
      if (Array.isArray(codeAction)) {
        return 'PR ' + codeAction.map(a => codeActionString(a, metadata)).join(', ');
      } else {
        return 'PR ' + codeActionString(codeAction, metadata);
      }
    }
    if (metadata?.codeAction === 'member_invited') {
      return 'Member invited';
    }
    if (metadata?.codeAction === 'edited') {
      return 'Edited';
    }
  } catch (e) {
    return '';
  }
};

export const getUrl = (
  activity: Activity
): { url: string; type: 'jira' | 'confluence' | 'github' } | null => {
  const metadata = activity.metadata;
  let type: 'jira' | 'confluence' | 'github' | null = null;
  if (activity.eventType === 'jira') {
    type = 'jira';
  } else if (activity.eventType === 'confluence') {
    type = 'confluence';
  } else if (activity.eventType === 'github') {
    type = 'github';
  }
  if (!type) {
    // legacy mapping, before we had activity.eventType (introduced with Confluence)
    if (metadata?.issue) {
      type = 'jira';
    } else if (metadata?.pullRequest || metadata?.pullRequestComment || metadata?.commits) {
      type = 'github';
    }
  }
  if (!type) {
    return null;
  }
  if (metadata?.issue?.uri) {
    return { url: `${metadata.issue.uri.split('rest')[0]}browse/${metadata.issue.key}`, type };
  }
  if (metadata?.space?.uri) {
    return { url: `${metadata.space.uri}`, type };
  }
  if (metadata?.page?.uri) {
    return { url: `${metadata.page.uri}`, type };
  }
  if (metadata?.comment?.uri) {
    return { url: `${metadata.comment.uri}`, type };
  }
  if (metadata?.label?.contentUri) {
    return { url: `${metadata.label.contentUri}`, type };
  }
  if (metadata?.attachments?.parent?.uri) {
    return { url: `${metadata.attachments.parent.uri}`, type };
  }

  if (metadata?.pullRequest?.uri) {
    return { url: metadata.pullRequest.uri, type };
  }
  if (metadata?.pullRequestComment?.uri) {
    return { url: metadata.pullRequestComment.uri, type };
  }
  if (metadata?.commits?.length) {
    return { url: metadata.commits[0].url!, type };
  }
  return null;
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
      initiative.effort = Math.floor(Math.random() * 10) + 1; // FIXME effort
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
      launchItem.effort = Math.floor(Math.random() * 10) + 1; // FIXME effort
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

export const consolidateAndPushActivity = (newActivity: Activity, activities: Activity[]) => {
  if (!newActivity.metadata) {
    activities.push(newActivity);
    return activities;
  }

  // PR
  if (newActivity.metadata?.pullRequest?.uri) {
    const indexPRActivity = activities.findLastIndex(
      a =>
        a.action === newActivity.action &&
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
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
        activities.splice(indexPRActivity, 1);
        activities.push(newActivity);
      } else {
        foundActivity.metadata!.codeAction = [...codeActions];
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
        a.action === newActivity.action &&
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
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
          activities.splice(indexPushActivity, 1);
          activities.push(newActivity);
        } else {
          foundActivity.metadata!.commits = commits;
        }
        return activities;
      }
    }
  }

  // Issue changelog
  if (newActivity.metadata?.issue?.key && newActivity.metadata.changeLog) {
    const indexIssueActivity = activities.findLastIndex(
      a =>
        a.action === newActivity.action &&
        a.actorId === newActivity.actorId &&
        a.artifact === newActivity.artifact &&
        a.eventType === newActivity.eventType &&
        a.event === newActivity.event &&
        a.metadata?.issue?.key &&
        a.metadata.issue.key === newActivity.metadata?.issue?.key &&
        a.metadata?.changeLog
    );
    if (indexIssueActivity >= 0 && newActivity.metadata.changeLog) {
      const foundActivity = activities[indexIssueActivity];

      if (newActivity.timestamp >= foundActivity.timestamp) {
        newActivity.metadata.changeLog.push(...foundActivity.metadata!.changeLog!);
        activities.splice(indexIssueActivity, 1);
        activities.push(newActivity);
      } else {
        foundActivity.metadata!.changeLog!.push(...newActivity.metadata.changeLog);
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
        a.metadata.page.id === newActivity.metadata?.page?.id &&
        a.metadata.page.version === newActivity.metadata?.page?.version
    );
    if (indexPageActivity >= 0) {
      const foundActivity = activities[indexPageActivity];
      if (newActivity.timestamp >= foundActivity.timestamp) {
        activities.splice(indexPageActivity, 1);
        activities.push(newActivity);
      }
      return activities;
    }
  }

  // no similar activity found, push it as new
  activities.push(newActivity);
  return activities;
};
