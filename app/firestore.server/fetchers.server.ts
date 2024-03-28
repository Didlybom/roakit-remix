import retry from 'async-retry';
import pino from 'pino';
import { firestore } from '../firebase.server';
import {
  ActivityMap,
  ActorData,
  InitiativeData,
  InitiativeMap,
  TicketMap,
  activitySchema,
  actorSchema,
  emptyActivity,
  initiativeSchema,
  ticketSchema,
} from '../schemas/schemas';
import { ParseError } from '../utils/errorUtils';
import { withMetricsAsync } from '../utils/withMetrics.server';

const logger = pino({ name: 'firestore:fetchers' });

const retryProps = (message: string) => {
  return {
    // see https://github.com/tim-kos/node-retry#api
    retries: 2,
    factor: 2,
    minTimeout: 500,
    onRetry: (e: unknown) => logger.warn(e, message),
  };
};

export const fetchInitiatives = async (customerId: number | undefined) => {
  return await retry(async () => {
    const coll = firestore.collection(`customers/${customerId}/initiatives`);
    const docs = await coll.get();
    const initiatives: InitiativeData[] = [];
    docs.forEach(initiative => {
      const data = initiativeSchema.parse(initiative.data());
      initiatives.push({
        id: initiative.id,
        label: data.label,
        counters:
          data.counters ?
            { activities: data.counters.activities }
          : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 } },
        countersLastUpdated: data.countersLastUpdated ?? 0,
      });
    });
    return initiatives.sort((a, b) => a.id.localeCompare(b.id));
  }, retryProps('Retrying fetchInitiatives...'));
};

export const fetchInitiativeMap = async (customerId: number | undefined) => {
  return await retry(async () => {
    const coll = firestore.collection(`customers/${customerId}/initiatives`);
    const docs = await coll.get();
    const initiatives: InitiativeMap = {};
    docs.forEach(initiative => {
      const data = initiativeSchema.parse(initiative.data());
      initiatives[initiative.id] = {
        label: data.label,
        counters:
          data.counters ?
            { activities: data.counters.activities }
          : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 } },
        countersLastUpdated: data.countersLastUpdated ?? 0,
      };
    });
    return initiatives;
  }, retryProps('Retrying fetchInitiativeMap...'));
};

export const fetchTicketMap = async (customerId: number | undefined) => {
  return await retry(async () => {
    const coll = firestore.collection(`customers/${customerId}/tickets`);
    const docs = await coll.get();
    const tickets: TicketMap = {};
    docs.forEach(ticket => {
      const data = ticketSchema.parse(ticket.data());
      tickets[ticket.id] = {
        priority: data.priority,
        ...(data.project && { project: { key: data.project.key } }),
      };
    });
    return tickets;
  }, retryProps('Retrying fetchTicketsMap...'));
};

type ActorMap = Record<ActorData['id'], Omit<ActorData, 'id'>>;
export const fetchActorMap = async (customerId: number | undefined) => {
  return await retry(async () => {
    const actors: ActorMap = {};
    await Promise.all([
      (async () => {
        const gitHubColl = firestore.collection(`customers/${customerId}/feeds/1/accounts`);
        const gitHubDocs = await gitHubColl.get();
        gitHubDocs.forEach(actor => {
          const data = actorSchema.parse(actor.data());
          actors[actor.id] = { name: data.accountName, url: data.accountUri };
        });
        return actors;
      })(),
      (async () => {
        const jiraColl = firestore.collection(`customers/${customerId}/feeds/2/accounts`);
        const jiraDocs = await jiraColl.get();
        jiraDocs.forEach(actor => {
          const data = actorSchema.parse(actor.data());
          actors[actor.id] = { name: data.accountName };
        });
      })(),
    ]);
    return actors;
  }, retryProps('Retrying fetchActorMap...'));
};

export const fetchActivities = async (customerId: number, startDate: number) => {
  return await retry(async bail => {
    const activitiesCollection = firestore
      .collection(`customers/${customerId}/activities`)
      .orderBy('createdTimestamp')
      .startAt(startDate)
      .limit(5000); // FIXME limit
    const activityDocs = await withMetricsAsync<FirebaseFirestore.QuerySnapshot>(
      () => activitiesCollection.get(),
      { metricsName: 'dashboard:getActivities' }
    );
    const activities: ActivityMap = {};
    activityDocs.forEach(activity => {
      const props = activitySchema.safeParse(activity.data());
      if (!props.success) {
        bail(new ParseError('Failed to parse activities. ' + props.error.message));
        return emptyActivity; // not used, bail() will throw
      }
      activities[activity.id] = {
        action: props.data.action,
        actorId: props.data.actorAccountId,
        artifact: props.data.artifact,
        createdTimestamp: props.data.createdTimestamp,
        initiativeId: props.data.initiative,
        priority: props.data.priority,
      };
    });
    return activities;
  }, retryProps('Retrying fetchActivities...'));
};
