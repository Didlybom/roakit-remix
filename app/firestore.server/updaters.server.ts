import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from '../firebase.server';
import { ARTIFACTS, ActivityCount, Artifact, InitiativeMap } from '../schemas/schemas';
import { ONE_HOUR } from '../utils/dateUtils';

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
