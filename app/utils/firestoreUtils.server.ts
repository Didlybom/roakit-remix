import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from '../firebase.server';
import {
  ARTIFACTS,
  ActivityCount,
  ActorData,
  Artifact,
  InitiativeData,
  InitiativeMap,
  actorSchema,
  initiativeSchema,
} from '../schemas/schemas';
import { ONE_HOUR } from './dateUtils';

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
  return initiatives;
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

export const updateInitiativeCounters = async (customerId: number, initiatives: InitiativeMap) => {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR;
  const flatCounters: {
    initiativeId: string;
    artifact: Artifact;
    lastUpdated: number;
  }[] = [];
  Object.keys(initiatives).forEach(initiativeId => {
    const initiative = initiatives[initiativeId];
    if (initiative.countersLastUpdated >= oneHourAgo) {
      return;
    }
    ARTIFACTS.forEach(artifact => {
      flatCounters.push({
        initiativeId,
        artifact,
        lastUpdated: initiative.countersLastUpdated,
      });
    });
  });
  const newFlatCounts = await Promise.all(
    flatCounters.map(async counter => {
      const countQuery = firestore
        .collection(`customers/${customerId}/activities`)
        .where('artifact', '==', counter.artifact)
        .where('initiative', '==', counter.initiativeId)
        .orderBy('createdTimestamp')
        .startAt(counter.lastUpdated)
        .count();
      const count = (await countQuery.get()).data().count;
      return { ...counter, count };
    })
  );
  newFlatCounts.forEach(flatCount => {
    const initiative = initiatives[flatCount.initiativeId];
    initiative.counters.activities[flatCount.artifact] =
      initiative.counters.activities[flatCount.artifact] + flatCount.count;
  });
  void Promise.all(
    Object.keys(initiatives).map(initiativeId => {
      const initiative = initiatives[initiativeId];
      const initiativeDoc = firestore.doc(`customers/${customerId}/initiatives/${initiativeId}`);
      void initiativeDoc.set(
        { counters: initiative.counters, countersLastUpdated: initiative.countersLastUpdated },
        { merge: true }
      ); // no need to await (I think)
    })
  );
  return initiatives;
};

export const incrementInitiativeCounters = async (
  customerId: string,
  initiativeId: string,
  counters: ActivityCount
) => {
  const initiativeDoc = firestore.doc(`customers/${customerId}/initiatives/${initiativeId}`);
  await initiativeDoc.update({
    counters: {
      activities: {
        code: FieldValue.increment(counters.code),
        codeOrg: FieldValue.increment(counters.codeOrg),
        task: FieldValue.increment(counters.task),
        taskOrg: FieldValue.increment(counters.taskOrg),
      },
    },
  });
};
