import { firestore } from '../firebase.server';
import {
  ActorData,
  InitiativeData,
  InitiativeMap,
  actorSchema,
  initiativeSchema,
} from '../schemas/schemas';

export const fetchInitiatives = async (customerId: number | undefined) => {
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
};

export const fetchInitiativeMap = async (customerId: number | undefined) => {
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
};

export const fetchActors = async (customerId: number | undefined) => {
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
};

export const fetchActorMap = async (customerId: number | undefined) => {
  const coll = firestore.collection(`customers/${customerId}/feeds/2/accounts`);
  const docs = await coll.get();
  const actors: Record<ActorData['id'], Omit<ActorData, 'id'>> = {};
  docs.forEach(actor => {
    const data = actorSchema.parse(actor.data());
    actors[actor.id] = { name: data.accountName };
  });
  return actors;
};
