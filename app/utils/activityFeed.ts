import type { ActivityMetadata, TicketRecord } from '../types/types';
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
