import type { InitiativeActorStats } from '../types/types';
import { TicketStatus } from '../types/types';

type ActorInitiativeStats = Record<
  string,
  {
    initiatives: string[];
  }
>;

type InitiativeStats = Record<
  string,
  {
    effort: number;
    new: number;
    ongoing: number;
    blocked: number;
    completed: number;
    tickets: string[];
  }
>;

export type GroupedInitiativeStats = {
  actors?: ActorInitiativeStats;
  initiatives?: InitiativeStats;
};

export const groupInitiativeStats = (stats: InitiativeActorStats[]): GroupedInitiativeStats => {
  const actors: ActorInitiativeStats = {};
  const initiatives: InitiativeStats = {};

  const latestTicketStatus: Record<string, TicketStatus> = {};
  stats
    .sort((a, b) => a.day - b.day)
    .forEach(stat => {
      // actors
      let actorStats = actors[stat.identityId];
      if (!actorStats) {
        actorStats = { initiatives: [] };
        actors[stat.identityId] = actorStats;
      }
      if (!actorStats.initiatives.includes(stat.initiativeId)) {
        actorStats.initiatives.push(stat.initiativeId);
      }

      // initiatives
      let initiative = initiatives[stat.initiativeId];
      if (!initiative) {
        initiative = { effort: 0, new: 0, ongoing: 0, blocked: 0, completed: 0, tickets: [] };
        initiatives[stat.initiativeId] = initiative;
      }
      initiative.effort += stat.effort ?? 0;
      stat.tickets.forEach(t => {
        if (!initiative.tickets.includes(t.key)) initiative.tickets.push(t.key);
      });

      stat.tickets
        .filter(t => t.status)
        .forEach(t => {
          latestTicketStatus[t.key] = t.status as TicketStatus;
        });
    });

  Object.values(initiatives).forEach(initiative => {
    initiative.tickets.forEach(ticket => {
      const status = latestTicketStatus[ticket];
      if (status === TicketStatus.New) initiative.new++;
      if (status === TicketStatus.InProgress) initiative.ongoing++;
      if (status === TicketStatus.Blocked) initiative.blocked++;
      if (status === TicketStatus.Completed) initiative.completed++;
    });
  });

  return { actors, initiatives };
};
