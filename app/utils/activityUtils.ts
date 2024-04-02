import { TicketMap } from '../schemas/schemas';
import { findJiraTickets } from './stringUtils';

const findPriority = (str: string, tickets: TicketMap) => {
  for (const ticket of findJiraTickets(str)) {
    if (tickets[ticket]) {
      return tickets[ticket];
    }
  }
  return undefined;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inferPriority = (tickets: TicketMap, metadata: any) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  const pullRequestRef = metadata.pullRequest?.ref as string;
  const priority = findPriority(pullRequestRef, tickets);
  if (priority) {
    return priority;
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
