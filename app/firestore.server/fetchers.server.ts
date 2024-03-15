import retry from 'async-retry';
import pino from 'pino';
import { firestore } from '../firebase.server';
import {
  ActorData,
  InitiativeData,
  InitiativeMap,
  actorSchema,
  initiativeSchema,
} from '../schemas/schemas';

const logger = pino({ name: 'firestore:fetchers' });

const retryProps = {
  // see https://github.com/tim-kos/node-retry#api
  retries: 2,
  factor: 2,
  minTimeout: 500,
};

export const fetchInitiatives = async (customerId: number | undefined) => {
  return await retry(
    async () => {
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
    },
    {
      ...retryProps,
      onRetry: e => logger.warn(`Retrying fetchInitiatives... ${e.message}`),
    }
  );
};

export const fetchInitiativeMap = async (customerId: number | undefined) => {
  return await retry(
    async () => {
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
    },
    {
      ...retryProps,
      onRetry: e => logger.warn(`Retrying fetchInitiativeMap... ${e.message}`),
    }
  );
};

export const fetchActors = async (customerId: number | undefined) => {
  return await retry(
    async () => {
      const actors: ActorData[] = [];

      await Promise.all([
        async () => {
          const gitHubColl = firestore.collection(`customers/${customerId}/feeds/1/accounts`);
          const gitHubDocs = await gitHubColl.get();
          gitHubDocs.forEach(actor => {
            const data = actorSchema.parse(actor.data());
            actors.push({ id: actor.id, name: data.accountName });
          });
        },
        async () => {
          const jiraColl = firestore.collection(`customers/${customerId}/feeds/2/accounts`);
          const jiraDocs = await jiraColl.get();
          jiraDocs.forEach(actor => {
            const data = actorSchema.parse(actor.data());
            actors.push({ id: actor.id, name: data.accountName });
          });
        },
      ]);

      return actors;
    },
    {
      ...retryProps,
      onRetry: e => logger.warn(`Retrying fetchActors... ${e.message}`),
    }
  );
};

export const fetchActorMap = async (customerId: number | undefined) => {
  return await retry(
    async () => {
      const coll = firestore.collection(`customers/${customerId}/feeds/2/accounts`);
      const docs = await coll.get();
      const actors: Record<ActorData['id'], Omit<ActorData, 'id'>> = {};
      docs.forEach(actor => {
        const data = actorSchema.parse(actor.data());
        actors[actor.id] = { name: data.accountName };
      });
      return actors;
    },
    {
      ...retryProps,
      onRetry: e => logger.warn(`Retrying fetchActorMap... ${e.message}`),
    }
  );
};
