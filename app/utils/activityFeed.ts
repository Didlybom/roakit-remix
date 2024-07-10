import type { Activity, ActivityMetadata, TicketRecord } from '../types/types';
import { findJiraTickets } from './stringUtils';

export const artifactActions = new Map<string, { sortOrder: number; label: string }>([
  ['task-created', { sortOrder: 1, label: 'Task created' }],
  ['task-updated', { sortOrder: 2, label: 'Task updated' }],
  ['task-deleted', { sortOrder: 3, label: 'Task deleted' }],
  ['taskOrg-created', { sortOrder: 4, label: 'Task org. created' }],
  ['taskOrg-updated', { sortOrder: 5, label: 'Task org. updated' }],
  ['code-created', { sortOrder: 6, label: 'Code created' }],
  ['code-updated', { sortOrder: 7, label: 'Code updated' }],
  ['code-deleted', { sortOrder: 8, label: 'Code deleted' }],
  ['code-unknown', { sortOrder: 9, label: 'Code misc.' }],
  ['codeOrg-created', { sortOrder: 10, label: 'Code org. created' }],
  ['codeOrg-updated', { sortOrder: 11, label: 'Code org. updated' }],
  ['codeOrg-deleted', { sortOrder: 12, label: 'Code org. deleted' }],
  ['docOrg-created', { sortOrder: 13, label: 'Doc org. created' }],
  ['doc-created', { sortOrder: 14, label: 'Doc created' }],
  ['doc-updated', { sortOrder: 15, label: 'Doc updated' }],
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

export const activitiesTotalEffort = (activities: Activity[]) => {
  const activitiesWithEffort = activities.filter(activity => activity.effort != null);
  return activitiesWithEffort.length ?
      activitiesWithEffort.reduce((total, activity) => total + activity.effort!, 0)
    : undefined;
};
