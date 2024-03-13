import { firestore } from '../firebase.server';
import {
  ACTIVITY_TYPES,
  ActivityData,
  ActorData,
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
  const coll = firestore.collection(`customers/${customerId}/actors`);
  const docs = await coll.get();
  const actors: ActorData[] = [];
  docs.forEach(actor => {
    const data = actorSchema.parse(actor.data());
    actors.push({ id: actor.id, name: data.name });
  });
  return actors;
};

export const fetchActorMap = async (customerId: number | undefined) => {
  const coll = firestore.collection(`customers/${customerId}/actors`);
  const docs = await coll.get();
  const actors: Record<ActorData['id'], Omit<ActorData, 'id'>> = {};
  docs.forEach(actor => {
    const data = actorSchema.parse(actor.data());
    actors[actor.id] = { name: data.name };
  });
  return actors;
};

export const updateInitiativeCounters = async (customerId: number, initiatives: InitiativeMap) => {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR;
  const flatCounters: {
    initiativeId: string;
    activityType: ActivityData['type'];
    lastUpdated: number;
  }[] = [];
  Object.keys(initiatives).forEach(initiativeId => {
    const initiative = initiatives[initiativeId];
    if (initiative.countersLastUpdated >= oneHourAgo) {
      return;
    }
    ACTIVITY_TYPES.forEach(activityType => {
      flatCounters.push({
        initiativeId: initiativeId,
        activityType,
        lastUpdated: initiative.countersLastUpdated,
      });
    });
  });
  const newFlatCounts = await Promise.all(
    flatCounters.map(async counter => {
      const countQuery = firestore
        .collection(`customers/${customerId}/activities`)
        .where('type', '==', counter.activityType)
        .orderBy('date')
        .startAt(counter.lastUpdated)
        .count();
      const count = (await countQuery.get()).data().count;
      return { ...counter, count };
    })
  );
  newFlatCounts.forEach(flatCount => {
    const initiative = initiatives[flatCount.initiativeId];
    initiative.counters.activities[flatCount.activityType] =
      initiative.counters.activities[flatCount.activityType] + flatCount.count;
    initiative.countersLastUpdated = now;
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
