import type { LaunchActorStats } from '../types/types';
import { TicketStatus } from '../types/types';

type ActorLaunchStats = Record<
  string,
  {
    launches: string[];
    blocked: number;
  }
>;

type LaunchStats = Record<
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

export type GroupedLaunchStats = {
  actors?: ActorLaunchStats;
  launches?: LaunchStats;
};

export const groupLaunchStats = (stats: LaunchActorStats[]): GroupedLaunchStats => {
  const actors: ActorLaunchStats = {};
  const launches: LaunchStats = {};

  const latestTicketStatus: Record<string, TicketStatus> = {};
  stats
    .sort((a, b) => a.day - b.day)
    .forEach(stat => {
      // actors
      let actorStats = actors[stat.identityId];
      if (!actorStats) {
        actorStats = { launches: [], blocked: 0 };
        actors[stat.identityId] = actorStats;
      }
      if (!actorStats.launches.includes(stat.launchItemId)) {
        actorStats.launches.push(stat.launchItemId);
      }
      // actorStats.blocked += stat.blocked;

      // launches
      let launch = launches[stat.launchItemId];
      if (!launch) {
        launch = { effort: 0, new: 0, ongoing: 0, blocked: 0, completed: 0, tickets: [] };
        launches[stat.launchItemId] = launch;
      }
      launch.effort += stat.effort;
      stat.tickets.forEach(t => {
        if (!launch.tickets.includes(t.key)) launch.tickets.push(t.key);
      });

      stat.tickets
        .filter(t => t.status)
        .forEach(t => {
          latestTicketStatus[t.key] = t.status as TicketStatus;
        });
    });

  Object.keys(launches).forEach(launchId => {
    const launch = launches[launchId];
    launch.tickets.forEach(ticket => {
      const status = latestTicketStatus[ticket];
      if (status === TicketStatus.New) launch.new++;
      if (status === TicketStatus.InProgress) launch.ongoing++;
      if (status === TicketStatus.Blocked) launch.blocked++;
      if (status === TicketStatus.Completed) launch.completed++;
    });
  });

  return { actors, launches };
};
