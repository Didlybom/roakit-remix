import {
  TicketStatus,
  type Account,
  type Activity,
  type ActivityMetadata,
  type ActorRecord,
  type Reactions,
} from '../types/types';
import { findJiraTickets } from '../utils/stringUtils';

export const artifactActions = new Map<string, { sortOrder: number; label: string }>([
  ['task-created', { sortOrder: 1, label: 'Task created' }],
  ['task-updated', { sortOrder: 2, label: 'Task updated' }],
  ['task-deleted', { sortOrder: 3, label: 'Task deleted' }],
  ['taskOrg-created', { sortOrder: 4, label: 'Task org. created' }],
  ['taskOrg-updated', { sortOrder: 5, label: 'Task org. updated' }],
  ['code-created', { sortOrder: 6, label: 'Code' }],
  ['code-updated', { sortOrder: 7, label: 'Code review' }],
  ['code-deleted', { sortOrder: 8, label: 'Code deleted' }],
  ['code-unknown', { sortOrder: 9, label: 'Code misc.' }],
  ['codeOrg-created', { sortOrder: 10, label: 'Code org. created' }],
  ['codeOrg-updated', { sortOrder: 11, label: 'Code org. updated' }],
  ['codeOrg-deleted', { sortOrder: 12, label: 'Code org. deleted' }],
  ['docOrg-created', { sortOrder: 13, label: 'Doc org. created' }],
  ['doc-created', { sortOrder: 14, label: 'Doc created' }],
  ['doc-updated', { sortOrder: 15, label: 'Doc updated' }],
]);

export const artifacts = new Map<string, { label: string }>([
  ['task', { label: 'Task' }],
  ['taskOrg', { label: 'Task Org.' }],
  ['code', { label: 'Code' }],
  ['codeOrg', { label: 'Code Org.' }],
  ['doc', { label: 'Doc.' }],
  ['docOrg', { label: 'Doc. Org.' }],
]);

// return the first ticket referenced from metadata fields
export const findFirstTicket = (metadata?: ActivityMetadata, description?: string | null) => {
  if (!metadata) return undefined;
  if (metadata?.issue?.key) return metadata.issue.key; // strong signal
  const pullRequestRef = metadata.pullRequest?.ref;
  if (pullRequestRef) {
    const tickets = findJiraTickets(pullRequestRef);
    if (tickets) return tickets[0];
  }
  const pullRequestTitle = metadata.pullRequest?.title;
  if (pullRequestTitle) {
    const tickets = findJiraTickets(pullRequestTitle);
    if (tickets) return tickets[0];
  }
  const commits = metadata.commits;
  if (commits) {
    for (const commit of commits) {
      const tickets = findJiraTickets(commit.message);
      if (tickets) return tickets[0];
    }
  }
  if (description) {
    const tickets = findJiraTickets(description);
    if (tickets) return tickets[0];
  }
  return undefined;
};

// return the tickets referenced from metadata fields, the most significant first or alone
export const findTickets = (metadata?: ActivityMetadata, description?: string | null) => {
  if (!metadata && !description) return [];
  const tickets = [];
  if (metadata?.issue?.key) return [metadata.issue.key]; // strong signal
  const pullRequestRef = metadata?.pullRequest?.ref;
  if (pullRequestRef) {
    tickets.push(...findJiraTickets(pullRequestRef));
  }
  const pullRequestTitle = metadata?.pullRequest?.title;
  if (pullRequestTitle) {
    tickets.push(...findJiraTickets(pullRequestTitle));
  }
  const commits = metadata?.commits;
  if (commits) {
    for (const commit of commits) {
      tickets.push(...findJiraTickets(commit.message));
    }
  }
  if (description) {
    tickets.push(...findJiraTickets(description));
  }
  return tickets;
};

export const inferTicketStatus = (metadata?: ActivityMetadata) => {
  if (!metadata) return undefined;
  const statusName = metadata?.issue?.status?.name;
  if (!statusName) {
    if (metadata.commits || metadata.pullRequest || metadata.pullRequestComment) {
      return TicketStatus.InProgress;
    }
    return undefined;
  }
  // FIXME ticket status inference should be configurable
  if (statusName === 'To Do' || statusName === 'Backlog' || statusName === 'Development Backlog') {
    return TicketStatus.New;
  }
  if (
    statusName === 'Selected for Development' ||
    statusName === 'In Development' ||
    statusName === 'Code Review' ||
    statusName === 'Work in progress' ||
    statusName === 'Pending closure'
  ) {
    return TicketStatus.InProgress;
  }
  if (
    statusName === 'Ready for Regression' ||
    statusName === 'In Regression' ||
    statusName === 'In QA' ||
    statusName === 'Ready for Release'
  ) {
    return TicketStatus.InTesting;
  }
  if (
    statusName === 'Blocked' ||
    statusName === 'Waiting for support' ||
    statusName === 'Pending Customer'
  ) {
    return TicketStatus.Blocked;
  }
  if (statusName === 'Closed' || statusName === 'Rejected') {
    return TicketStatus.Completed;
  }
};

export const buildArtifactActionKey = (artifact: string, action: string) => {
  return artifact + '-' + action;
};

export const activitiesTotalEffort = (activities: Activity[]) => {
  const activitiesWithEffort = activities.filter(activity => activity.effort != null);
  return activitiesWithEffort.length ?
      activitiesWithEffort.reduce((total, activity) => total + activity.effort!, 0)
    : undefined;
};

export const accountUrlToWeb = (account: Account) =>
  (
    (account.type === 'jira' || account.type === 'confluence') &&
    account.url &&
    account.url.indexOf('rest') > -1
  ) ?
    `${account.url!.split('rest')[0]}people/${account.id}`
  : account.url;

export const issueUrlToWeb = (url: string, key: string) =>
  url.indexOf('rest') > -1 ? `${url.split('rest')[0]}browse/${key}` : url;

export const jiraSourceName = (metadata: ActivityMetadata | undefined) =>
  metadata?.issue?.project?.name ?? 'Jira';

export const gitHubSourceName = (metadata: ActivityMetadata | undefined) =>
  metadata?.repository ?? 'GitHub';

export const confluenceSourceName = (metadata: ActivityMetadata | undefined) =>
  metadata?.space?.title ?? metadata?.page?.spaceKey ?? 'Confluence';

export const reactionCount = (reactions: Reactions) => ({
  like: Object.entries(reactions.like).filter(([, v]) => v).length,
});

export const reactionNames = (reactions: Reactions, actors: ActorRecord) => ({
  like: Object.entries(reactions.like)
    .filter(([, v]) => v)
    .map(([id]) => actors[id]?.name)
    .join(', '),
});
