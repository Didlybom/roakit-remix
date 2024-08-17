import {
  TicketStatus,
  type Activity,
  type ArtifactCounts,
  type InitiativeTicketStats,
  type PhaseCounts,
  type Ticket,
} from '../types/types';
import { JIRA_FAKE_TICKET_REGEXP } from '../utils/stringUtils';
import { buildArtifactActionKey, findTickets, inferTicketStatus } from './activityFeed';

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

type InitiativeWithCounts = {
  id: string;
  artifactCount: ArtifactCounts;
  phaseCount: PhaseCounts;
  actorIdSet?: Set<string>;
  actorCount: number;
  effort: number;
};

export type InitiativeWithTicketStats = {
  initiativeId: string;
} & InitiativeTicketStats;

export type GroupedActivities = {
  topActors?: TopActorsMap;
  priorities?: Priority[];
  initiatives?: InitiativeWithCounts[];
};

export const groupActivities = (activities: Activity[]): GroupedActivities => {
  const topActors: TopActorsMap = {};
  const priorities: Priority[] = [];
  let initiatives: InitiativeWithCounts[] = [];

  activities.forEach(activity => {
    const { actorId, initiativeId, priority: priorityId, artifact, phase, action } = activity;

    // top actors
    if (actorId != null) {
      const topActorKey = buildArtifactActionKey(artifact, action);
      if (topActors[topActorKey] == null) {
        topActors[topActorKey] = [];
      }
      let topActor = topActors[topActorKey].find(a => a.id === actorId);
      if (topActor == null) {
        topActor = { id: actorId, count: 0 };
        topActors[topActorKey].push(topActor);
      }
      topActor.count++;
    }

    // priorities
    if (priorityId != null && priorityId !== -1) {
      let priority = priorities.find(p => p.id === priorityId);
      if (priority == null) {
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
      if (initiative == null) {
        initiative = {
          id: initiativeId,
          artifactCount: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 },
          phaseCount: { design: 0, dev: 0, test: 0, deploy: 0, stabilize: 0, ops: 0 },
          actorIdSet: new Set<string>(),
          actorCount: 0,
          effort: 0,
        };
        initiatives.push(initiative);
      }
      initiative.artifactCount![artifact]++;
      if (phase) {
        initiative.phaseCount![phase]++;
      }
      if (actorId != null) {
        initiative.actorIdSet!.add(actorId); // the set dedupes
      }
      initiative.effort += activity.effort ?? 0;
    }
  });

  initiatives = initiatives.map(initiative => {
    const { actorIdSet: actorIds, ...initiativeFields } = initiative;
    return { ...initiativeFields, actorCount: actorIds?.size ?? 0 };
  });

  Object.entries(topActors).forEach(([action, actors]) => {
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

export type GroupedActorActivities = {
  initiatives?: InitiativeWithTicketStats[];
  tickets: Ticket[];
};

export const groupActorActivities = (
  activities: Omit<Activity, 'id' | 'createdTimestamp' | 'artifact' | 'action'>[]
): GroupedActorActivities => {
  let initiatives: InitiativeWithTicketStats[] = [];
  let tickets: Ticket[] = [];

  activities
    .sort((a, b) => a.timestamp - b.timestamp) // oldest first
    .forEach(activity => {
      const { initiativeId } = activity;

      // tickets
      const ticketKeys = findTickets(activity.metadata, activity.description).filter(
        ticketKey => !JIRA_FAKE_TICKET_REGEXP.exec(ticketKey)
      );
      const ticketStatus =
        activity.ongoing ? TicketStatus.InProgress : inferTicketStatus(activity.metadata);
      for (const ticketKey of ticketKeys) {
        let ticket = tickets.find(t => t.key === ticketKey);
        if (!ticket) {
          ticket = { key: ticketKey };
          tickets.push(ticket);
        }
        ticket.status = ticketStatus; // if same ticket appears in multiple activities, latest status wins
      }

      // initiatives
      let initiative;
      if (initiativeId) {
        initiative = initiatives.find(i => i.initiativeId === initiativeId);
        if (initiative == null) {
          initiative = { initiativeId, tickets: [] };
          initiatives.push(initiative);
        }

        for (const ticketKey of ticketKeys) {
          let ticket = initiative.tickets.find(t => t.key === ticketKey);
          if (!ticket) {
            ticket = { key: ticketKey };
            initiative.tickets.push(ticket);
          }
          ticket.status = ticketStatus; // if same ticket appears in multiple activities, latest status wins
        }
        if (activity.effort != null) {
          if (initiative.effort == null) initiative.effort = 0;
          initiative.effort += activity.effort;
        }
      }
    });

  return { initiatives: initiatives, tickets };
};
