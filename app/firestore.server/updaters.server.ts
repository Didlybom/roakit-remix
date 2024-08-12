import { FieldValue } from 'firebase-admin/firestore';
import { firestore } from '../firebase.server';
import { ARTIFACTS } from '../types/schemas';
import {
  CUSTOM_EVENT,
  type Activity,
  type Artifact,
  type ArtifactCounts,
  type InitiativeRecord,
  type InitiativeTicketStats,
  type Ticket,
} from '../types/types';
import { endOfDay, nextBusinessDay, ONE_HOUR } from '../utils/dateUtils';

export const updateInitiativeCounters = async (
  customerId: number,
  initiatives: InitiativeRecord
) => {
  const now = Date.now();
  const oneHourAgo = now - ONE_HOUR;
  const flatCounters: {
    initiativeId: string;
    artifact: Artifact;
    lastUpdated: number;
  }[] = [];
  Object.keys(initiatives).forEach(initiativeId => {
    const initiative = initiatives[initiativeId];
    if (initiative.countersLastUpdated! >= oneHourAgo) {
      return;
    }
    ARTIFACTS.forEach(artifact => {
      flatCounters.push({
        initiativeId,
        artifact,
        lastUpdated: initiative.countersLastUpdated!,
      });
    });
  });
  if (!flatCounters.length) {
    return initiatives;
  }
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
    initiative.counters!.activities[flatCount.artifact] += flatCount.count;
  });
  void Promise.all(
    Object.keys(initiatives).map(initiativeId => () => {
      const initiative = initiatives[initiativeId];
      const initiativeDoc = firestore.doc(`customers/${customerId}/initiatives/${initiativeId}`);
      void initiativeDoc.set(
        { counters: initiative.counters, countersLastUpdated: now },
        { merge: true }
      ); // no need to await (I think)
    })
  );
  return initiatives;
};

export const incrementInitiativeCounters = async (
  customerId: number,
  initiativeId: string,
  counters: ArtifactCounts
) => {
  const initiativeDoc = firestore.doc(`customers/${customerId}/initiatives/${initiativeId}`);
  await initiativeDoc.set(
    {
      counters: {
        activities: {
          code: FieldValue.increment(counters.code),
          codeOrg: FieldValue.increment(counters.codeOrg),
          task: FieldValue.increment(counters.task),
          taskOrg: FieldValue.increment(counters.taskOrg),
        },
      },
    },
    { merge: true }
  );
};

export const upsertLaunchItemIndividualCounters = async (
  customerId: number,
  identityId: string,
  day: string /* YYYYMMDD */,
  counters: (InitiativeTicketStats & { launchItemId: string })[],
  launchItemIdToDelete?: string
) => {
  const coll = firestore.collection(`customers/${customerId}/launchItemCounters`);
  const batch = firestore.batch();
  if (launchItemIdToDelete) {
    let deleteQuery = coll.where('identityId', '==', identityId).where('day', '==', +day);
    if (launchItemIdToDelete !== '*') {
      deleteQuery = deleteQuery.where('launchItemId', '==', launchItemIdToDelete);
    }
    (await deleteQuery.get()).docs.forEach(async doc => batch.delete(doc.ref));
  }
  counters.forEach(async counter =>
    batch.create(coll.doc(), { day: +day, identityId, ...counter })
  );
  await batch.commit();
};

export const upsertSummary = async (
  customerId: number,
  date: string /* YYYYMMDD */,
  {
    identityId,
    isTeam,
    aiSummary,
    userSummary,
  }: {
    identityId: string;
    isTeam: boolean;
    aiSummary: string;
    userSummary: string;
  }
) => {
  const coll = firestore.collection(`customers/${customerId}/summaries/${date}/instances`);
  const existing = await coll.where('identityId', '==', identityId).get();
  if (existing.size > 1) {
    throw Error('Found more than one summary');
  }
  const now = Date.now();
  if (existing.size === 0) {
    await coll.add({
      ...(isTeam ?
        { aiTeamSummary: aiSummary, userTeamSummary: userSummary }
      : { aiSummary, userSummary }),
      identityId,
      createdTimestamp: now,
      lastUpdatedTimestamp: now,
    });
  } else {
    await existing.docs[0].ref.set(
      {
        ...(isTeam ?
          { aiTeamSummary: aiSummary, userTeamSummary: userSummary }
        : { aiSummary, userSummary }),
        lastUpdatedTimestamp: now,
      },
      { merge: true }
    );
  }
};

export const upsertNextOngoingActivity = async (customerId: number, previousActivity: Activity) => {
  const activitiesColl = firestore.collection(`customers/${customerId}/activities/`);

  if (!(await activitiesColl.where('previousActivityId', '==', previousActivity.id).get()).empty) {
    return null;
  }

  return await activitiesColl.add({
    previousActivityId: previousActivity.id,
    actorAccountId: previousActivity.actorId,
    createdTimestamp: endOfDay(nextBusinessDay(previousActivity.createdTimestamp)),
    eventType: previousActivity.eventType,
    event: CUSTOM_EVENT,
    ongoing: false,
    action: previousActivity.action,
    artifact: previousActivity.artifact,
    launchItemId: previousActivity.launchItemId,
    initiative: previousActivity.initiativeId,
    phase: previousActivity.phase,
    description: previousActivity.description,
    priority: previousActivity.priority,
    ...(previousActivity.metadata && { metadata: previousActivity.metadata }),
  });
};

export const insertActivity = async (
  customerId: number,
  activity: Omit<Activity, 'id' | 'initiativeId'> & { actorAccountId: string; initiative: string }
) => {
  return (await firestore.collection(`customers/${customerId!}/activities`).add(activity)).id;
};

export const upsertTicket = async (customerId: number, ticket: Ticket) => {
  const { key, ...ticketFields } = ticket;
  const ticketDoc = firestore.doc(`customers/${customerId}/tickets/${key}`);
  await ticketDoc.set({ ...ticketFields, lastUpdatedTimestamp: Date.now() }, { merge: true });
};
