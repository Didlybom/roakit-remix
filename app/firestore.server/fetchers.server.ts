import retry from 'async-retry';
import dayjs from 'dayjs';
import { FieldPath } from 'firebase-admin/firestore';
import NodeCache from 'node-cache';
import pino from 'pino';
import { combineAndPushActivity } from '../activityProcessors/activityCombiner';
import { firestore } from '../firebase.server';
import * as schemas from '../types/schemas';
import { parse } from '../types/schemas';
import {
  FEED_TYPES,
  displayName,
  type Account,
  type AccountMap,
  type AccountToIdentityRecord,
  type Activity,
  type ActivityMetadata,
  type Artifact,
  type DaySummaries,
  type Identity,
  type Initiative,
  type InitiativeRecord,
  type Phase,
  type Summary,
  type TicketRecord,
} from '../types/types';
import { findTicket } from '../utils/activityFeed';
import { daysInMonth } from '../utils/dateUtils';
import { DEFAULT_ROLE, Role } from '../utils/rbac';
import { withMetricsAsync } from '../utils/withMetrics.server';

const logger = pino({ name: 'firestore:fetchers' });

const retryProps = (message: string) => ({
  // see https://github.com/tim-kos/node-retry#api
  retries: 1,
  factor: 2,
  minTimeout: 500,
  onRetry: (e: unknown) => logger.warn(e, message),
});

export const queryUser = async (
  email: string
): Promise<{ customerId: number; id: string; role: Role }> => {
  const userDocs = (
    await retry(
      async () => firestore.collection('users').where('email', '==', email).get(),
      retryProps('Retrying queryUser...')
    )
  ).docs;
  if (userDocs.length === 0) {
    throw Error('User not found');
  }
  if (userDocs.length > 1) {
    throw Error('More than one User found');
  }
  const data = parse<schemas.UserType>(
    schemas.userSchema,
    userDocs[0].data(),
    'user ' + userDocs[0].id
  );
  return {
    customerId: data.customerId,
    id: userDocs[0].id,
    role: data.role! || DEFAULT_ROLE,
  };
};

export const queryIdentity = async (
  customerId: number,
  key: { identityId?: string; email?: string }
): Promise<Identity> => {
  if (!key.identityId && !key.email) {
    throw Error('queryIdentity missing param');
  }
  let doc;
  let id;
  if (key.identityId) {
    doc = await firestore.doc(`customers/${customerId}/identities/${key.identityId}`).get();
    if (!doc.exists) {
      throw Error('Identity not found');
    }
    id = key.identityId;
  } else {
    const docs = (
      await retry(
        async () =>
          await firestore
            .collection(`customers/${customerId}/identities`)
            .where('email', '==', key.email)
            .get(),
        retryProps('Retrying queryIdentity...')
      )
    ).docs;
    if (docs.length === 0) {
      throw Error('Identity not found');
    }
    if (docs.length > 1) {
      throw Error('More than one Identity found');
    }
    id = docs[0].id;
    doc = docs[0];
  }
  const data = parse<schemas.IdentityType>(
    schemas.identitySchema,
    doc.data()!,
    'identity ' + doc.id
  );
  return {
    id,
    email: data.email,
    displayName: data.displayName,
    managerId: data.managerId,
    accounts: data.accounts ?? [],
  };
};

export const queryTeamIdentities = async (
  customerId: number,
  managerId: string
): Promise<Identity[]> => {
  const identities: Identity[] = [];
  (
    await retry(
      async () =>
        await firestore
          .collection(`customers/${customerId}/identities`)
          .where('managerId', '==', managerId)
          .get(),
      retryProps('Retrying queryTeamIdentities...')
    )
  ).docs.forEach(doc => {
    const data = parse<schemas.IdentityType>(
      schemas.identitySchema,
      doc.data(),
      'identity ' + doc.id
    );
    identities.push({ id: doc.id, accounts: data.accounts ?? [] });
  });
  return identities;
};

export const fetchInitiativeMap = async (customerId: number): Promise<InitiativeRecord> => {
  const initiatives: InitiativeRecord = {};
  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/initiatives`).get(),
      retryProps('Retrying fetchInitiatives...')
    )
  ).forEach(doc => {
    const data = parse<schemas.InitiativeType>(schemas.initiativeSchema, doc.data(), 'initiative');
    initiatives[doc.id] = {
      key: data.key ?? doc.id,
      label: data.label,
      tags: data.tags,
      reference: data.reference,
      url: data.url,
      activityMapper: data.activityMapper,
      counters:
        data.counters ?
          { activities: data.counters.activities }
        : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 } },
      countersLastUpdated: data.countersLastUpdated ?? 0,
    };
  });
  return initiatives;
};

export const fetchInitiatives = async (customerId: number): Promise<Initiative[]> => {
  const initiatives: Initiative[] = [];
  const initiativeMap = await fetchInitiativeMap(customerId);
  Object.keys(initiativeMap).forEach(id => initiatives.push({ ...initiativeMap[id], id }));
  return initiatives.sort((a, b) => a.key.localeCompare(b.key));
};

export const fetchLaunchItemMap = async (customerId: number): Promise<InitiativeRecord> => {
  const launchItems: InitiativeRecord = {};
  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/launchItems`).get(),
      retryProps('Retrying fetchLaunchItems...')
    )
  ).forEach(doc => {
    const data = parse<schemas.InitiativeType>(
      schemas.initiativeSchema,
      doc.data(),
      'launch item ' + doc.id
    );
    launchItems[doc.id] = {
      key: data.key ?? doc.id,
      label: data.label,
      color: data.color,
      activityMapper: data.activityMapper,
      counters:
        data.counters ?
          { activities: data.counters.activities }
        : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0, doc: 0, docOrg: 0 } },
      countersLastUpdated: data.countersLastUpdated ?? 0,
    };
  });
  return launchItems;
};

export const fetchLaunchItems = async (customerId: number): Promise<Initiative[]> => {
  const launchItems: Initiative[] = [];
  const launchItemMap = await fetchLaunchItemMap(customerId);
  Object.keys(launchItemMap).forEach(id => launchItems.push({ ...launchItemMap[id], id }));
  return launchItems.sort((a, b) => a.key.localeCompare(b.key));
};

const findIdentity = (identities: Identity[], id: string) => identities.find(i => i.id === id)!;

export const fetchIdentities = async (
  customerId: number
): Promise<{ list: Identity[]; accountMap: AccountToIdentityRecord }> => {
  const identities: Identity[] = [];
  const accountMap: AccountToIdentityRecord = {};

  const usersByEmail: Record<string, { id: string; role: Role }> = {};
  (
    await retry(
      async () => await firestore.collection('users').where('customerId', '==', customerId).get(),
      retryProps('Retrying fetchIdentities#users...')
    )
  ).forEach(doc => {
    const data = parse<schemas.UserType>(schemas.userSchema, doc.data(), 'user ' + doc.id);
    usersByEmail[data.email] = { id: doc.id, role: data.role ?? DEFAULT_ROLE };
  });

  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/identities`).get(),
      retryProps('Retrying fetchIdentities...')
    )
  ).forEach(doc => {
    const data = parse<schemas.IdentityType>(schemas.identitySchema, doc.data(), 'user ' + doc.id);
    identities.push({
      id: doc.id,
      email: data.email,
      displayName: data.displayName,
      managerId: data.managerId,
      user: usersByEmail[data.email ?? ''] ?? { role: DEFAULT_ROLE },
      accounts: data.accounts ?? [],
    });
    // map accounts to identities
    data.accounts?.forEach(account => {
      if (account.id) {
        accountMap[account.id] = doc.id;
      } else if (account.name) {
        accountMap[account.name] = doc.id;
      }
    });
  });
  // add the report member ids
  identities.forEach(identity => {
    identity.reportIds = identities
      .filter(report => report.managerId === identity.id)
      .map(i => i.id)
      .sort((a, b) =>
        (findIdentity(identities, a).displayName ?? '').localeCompare(
          findIdentity(identities, b).displayName ?? ''
        )
      );
  });

  return {
    list: identities.sort((a, b) => displayName(a).localeCompare(displayName(b))),
    accountMap,
  };
};

interface TicketCache {
  tickets: TicketRecord;
  hasAllTickets?: boolean;
}
const makeTicketsCacheKey = (customerId: number) => `${customerId};tickets`;
const ticketsCache = new NodeCache({ stdTTL: 60 /* seconds */, useClones: false });

export const fetchTicketPriorityMapWithCache = async (
  customerId: number
): Promise<TicketRecord> => {
  const cacheKey = makeTicketsCacheKey(customerId);
  const cache: TicketCache | undefined = ticketsCache.get(cacheKey);
  if (cache?.hasAllTickets) {
    // hasAllTickets is false when fetchTicketPriorities() cached tickets, and the cache was empty
    return cache.tickets;
  }
  const tickets: TicketRecord = {};
  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/tickets`).get(),
      retryProps('Retrying fetchTicketsMap...')
    )
  ).forEach(doc => {
    const data = parse<schemas.TicketType>(schemas.ticketSchema, doc.data(), 'ticket ' + doc.id);
    tickets[doc.id] = data.priority;
  });
  ticketsCache.set(cacheKey, { tickets, hasAllTickets: true });
  return tickets;
};

export const fetchTicketPrioritiesWithCache = async (
  customerId: number,
  ticketIds: string[]
): Promise<TicketRecord> => {
  const cacheKey = makeTicketsCacheKey(customerId);
  const cache: TicketCache | undefined = ticketsCache.get(cacheKey);
  const fromCache: TicketRecord = {};
  if (cache) {
    ticketIds.forEach((ticketId, i) => {
      if (cache.tickets[ticketId]) {
        fromCache[ticketId] = cache.tickets[ticketId]; // we'll add it to the response at the end
        ticketIds.splice(i, 1); // we have it form cache already
      }
    });
  }
  const tickets: TicketRecord = {};
  const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  while (ticketIds.length) {
    // firestore supports up to 30 IN comparisons at a time
    const batch = ticketIds.splice(0, 30);
    batches.push(
      firestore
        .collection(`customers/${customerId}/tickets`)
        .where(FieldPath.documentId(), 'in', [...batch])
        .get()
    );
  }
  (await retry(async () => await Promise.all(batches), retryProps('Retrying fetchTickets...')))
    .flatMap(t => t.docs)
    .map(doc => {
      const data = parse<schemas.TicketType>(schemas.ticketSchema, doc.data(), 'ticket ' + doc.id);
      tickets[doc.id] = data.priority;
    });
  // add to the cache freshly found tickets
  ticketsCache.set(cacheKey, { tickets: { ...cache?.tickets, ...tickets } });
  return { ...tickets, ...fromCache };
};

export const fetchAccountMap = async (customerId: number): Promise<AccountMap> => {
  const accounts: AccountMap = new Map();
  (
    await retry(
      async () =>
        await Promise.all(
          FEED_TYPES.map(feed =>
            (async () => ({
              feedType: feed.type,
              accounts: await firestore
                .collection(`customers/${customerId}/feeds/${feed.id}/accounts`)
                .get(),
            }))()
          )
        ),
      retryProps('Retrying fetchAccountMap...')
    )
  ).forEach(feed => {
    feed.accounts.forEach(account => {
      const data = parse<schemas.AccountType>(
        schemas.accountSchema,
        account.data(),
        'account ' + account.id
      );
      accounts.set(account.id, {
        type: feed.feedType,
        name: data.accountName ?? '',
        url: data.accountUri,
      });
    });
  });
  return accounts;
};

export const fetchAccountsToReview = async (customerId: number): Promise<Account[]> => {
  const accounts: Account[] = [];
  (
    await retry(
      async () =>
        await Promise.all(
          FEED_TYPES.map(feed =>
            (async () => ({
              feedType: feed.type,
              accounts: await firestore
                .collection(`customers/${customerId}/feeds/${feed.id}/accountsToReview`)
                .get(),
            }))()
          )
        ),
      retryProps('Retrying fetchAccountsToReview...')
    )
  ).forEach(feed => {
    feed.accounts.forEach(account => {
      const data = parse<schemas.AccountType>(
        schemas.accountSchema,
        account.data(),
        'account ' + account.id
      );
      accounts.push({
        id: account.id,
        type: feed.feedType,
        name: data.accountName ?? '',
        url: data.accountUri,
        createdTimestamp: data.createdDate,
      });
    });
  });
  return accounts;
};

export const fetchActivities = async ({
  customerId,
  startDate,
  endDate,
  userIds,
  options,
}: {
  customerId: number;
  startDate: number;
  endDate?: number;
  userIds?: string[];
  options?: { includeMetadata?: boolean; findPriority?: boolean; combine?: boolean };
}) => {
  const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  if (!userIds) {
    let query = firestore
      .collection(`customers/${customerId}/activities`)
      .orderBy('createdTimestamp')
      .startAt(startDate)
      .limit(20000); // FIXME limit
    if (endDate) {
      query = query.endAt(endDate);
    }
    batches.push(query.get());
  } else {
    while (userIds.length) {
      // firestore supports up to 30 IN comparisons at a time
      const batch = userIds.splice(0, 30);
      let query = firestore
        .collection(`customers/${customerId}/activities`)
        .where('actorAccountId', 'in', [...batch])
        .orderBy('createdTimestamp')
        .startAt(startDate)
        .limit(20000); // FIXME limit
      if (endDate) {
        query = query.endAt(endDate);
      }
      batches.push(query.get());
    }
  }

  const activityDocs = (
    await withMetricsAsync(
      () =>
        retry(async () => await Promise.all(batches), retryProps('Retrying queryActivities...')),
      { metricsName: 'queryActivities' }
    )
  ).flatMap(a => a.docs);

  const activities: Activity[] = [];
  const ticketPrioritiesToFetch = new Set<string>();
  const activityTickets = new Map<string, string>();

  activityDocs.forEach(doc => {
    const data = parse<schemas.ActivityType>(
      schemas.activitySchema,
      doc.data(),
      'activity ' + doc.id
    );
    const priority = data.priority;
    if ((!priority || priority === -1) && options?.findPriority) {
      // will find priority from metadata for activities missing one
      const ticket = findTicket(data.metadata as ActivityMetadata);
      if (ticket) {
        ticketPrioritiesToFetch.add(ticket);
        activityTickets.set(doc.id, ticket);
      }
    }
    combineAndPushActivity(
      {
        id: doc.id,
        action: data.action,
        actorId: data.actorAccountId,
        artifact: data.artifact as Artifact,
        timestamp: data.eventTimestamp ?? data.createdTimestamp,
        initiativeId: data.initiative,
        launchItemId: data.launchItemId,
        effort: data.effort,
        phase: data.phase as Phase,
        priority, // see overwrite below
        eventType: data.eventType,
        event: data.event,
        description: data.description,
        ...(options?.includeMetadata && { metadata: data.metadata as ActivityMetadata }),
        objectId: data.objectId, // for debugging
      },
      activities
    );
  });

  if (ticketPrioritiesToFetch.size > 0) {
    const tickets = await fetchTicketPrioritiesWithCache(customerId, [...ticketPrioritiesToFetch]);
    activityTickets.forEach((activityTicket, activityId) => {
      // add the found priority to the activity
      const activity = activities.find(a => (a.id = activityId));
      if (activity) {
        activity.priority = tickets[activityTicket];
      }
    });
  }

  return activities;
};

const makeActivityCountCacheKey = (
  customerId: number,
  { withInitiatives }: { withInitiatives?: boolean }
) => {
  let suffix = '';
  if (withInitiatives != null) {
    suffix = withInitiatives ? ';withInitiatives' : ';withoutInitiatives';
  }
  return `${customerId};activityTotal${suffix}`;
};
const activityCountCache = new NodeCache({ stdTTL: 60 /* seconds */, useClones: false });

const fetchActivityTotalWithCache = async (
  customerId: number,
  withInitiatives?: boolean
): Promise<number> => {
  const cacheKey = makeActivityCountCacheKey(customerId, { withInitiatives });
  const cache: number | undefined = activityCountCache.get(cacheKey);
  if (cache != null) {
    return cache;
  }
  return await retry(async () => {
    const activitiesCollection = firestore.collection(`customers/${customerId}/activities`);
    let activityQuery;
    if (withInitiatives == null) {
      activityQuery = activitiesCollection;
    } else {
      activityQuery = activitiesCollection.where('initiative', withInitiatives ? '!=' : '==', '');
    }
    const activityTotal = (await activityQuery.count().get()).data().count;
    activityCountCache.set(cacheKey, activityTotal);
    return activityTotal;
  }, retryProps('Retrying fetchActivityTotal...'));
};

export const fetchActivitiesPage = async ({
  customerId,
  startAfter,
  endBefore,
  limit,
  withInitiatives,
}: {
  customerId: number;
  startAfter?: number;
  endBefore?: number;
  limit: number;
  withInitiatives?: boolean;
}) => {
  if (startAfter != null && endBefore != null) {
    throw Error('startAfter and endBefore are mutually exclusive params.');
  }
  const activitiesCollection = firestore.collection(`customers/${customerId}/activities`);
  let activityQuery;
  if (withInitiatives == null) {
    activityQuery = activitiesCollection;
  } else {
    activityQuery = activitiesCollection.where('initiative', withInitiatives ? '!=' : '==', '');
  }
  let activityPageQuery = activityQuery.orderBy('createdTimestamp', 'desc');
  if (startAfter != null) {
    activityPageQuery = activityPageQuery.startAfter(startAfter).limit(limit);
  } else if (endBefore != null) {
    activityPageQuery = activityPageQuery.endBefore(endBefore).limitToLast(limit);
  } else {
    activityPageQuery = activityPageQuery.limit(limit);
  }
  const activities: Activity[] = [];
  const [activityPage, activityTotal] = await Promise.all([
    retry(async () => activityPageQuery.get(), retryProps('Retrying fetchActivitiesPage...')),
    fetchActivityTotalWithCache(customerId, withInitiatives),
  ]);
  activityPage.forEach(doc => {
    const data = parse<schemas.ActivityType>(
      schemas.activitySchema,
      doc.data(),
      'activity ' + doc.id
    );
    activities.push({
      id: doc.id,
      action: data.action,
      eventType: data.eventType,
      event: data.event,
      actorId: data.actorAccountId,
      artifact: data.artifact as Artifact,
      timestamp: data.eventTimestamp ?? data.createdTimestamp,
      priority: data.priority,
      initiativeId: data.initiative,
      launchItemId: data.launchItemId,
      description: data.description,
      metadata: data.metadata as ActivityMetadata,
      note: data.note,
      objectId: data.objectId, // for debugging
    });
  });
  return { activities, activityTotal };
};

export const fetchSummaries = async (
  customerId: number,
  identityId: string,
  date: { day?: string /* YYYYMMDD */; month?: string /* YYYYMM */ }
): Promise<DaySummaries | undefined> => {
  if ((!date.day && !date.month) || (date.day && date.month)) {
    throw Error('Day xor month required');
  }
  const summaries: DaySummaries = {};
  const documents = await retry(async () => {
    const days = date.day ? [date.day] : daysInMonth(dayjs(date.month));
    return await Promise.all(
      days.map(async day => ({
        day,
        snapshot: await firestore
          .collection(`customers/${customerId}/summaries/${day}/instances`)
          .where('identityId', '==', identityId)
          .get(),
      }))
    );
  }, retryProps('Retrying fetchSummaries...'));
  documents.forEach(document => {
    if (document.snapshot.size === 0) {
      return undefined;
    }
    if (document.snapshot.size > 1) {
      throw Error(
        `Found more than one summary for customer ${customerId}, user ${identityId} on ${document.day}`
      );
    }
    const data = parse<schemas.SummaryType>(
      schemas.summarySchema,
      document.snapshot.docs[0].data(),
      'summary ' + document.snapshot.docs[0].id
    );
    summaries[document.day] = {
      identityId: data.identityId, // useless here
      aiSummary: data.aiSummary,
      userSummary: data.userSummary,
      aiTeamSummary: data.aiTeamSummary,
      userTeamSummary: data.userTeamSummary,
    };
  });
  return summaries;
};

export const fetchAllSummaries = async (
  customerId: number,
  day: string /* YYYYMMDD */
): Promise<Summary[] | undefined> => {
  const summaries: Summary[] = [];
  const documents = await retry(
    async () =>
      await firestore.collection(`customers/${customerId}/summaries/${day}/instances`).get(),
    retryProps('Retrying fetchAllSummaries...')
  );
  documents.forEach(doc => {
    const data = parse<schemas.SummaryType>(schemas.summarySchema, doc.data(), 'summary ' + doc.id);
    summaries.push({
      identityId: data.identityId,
      aiSummary: data.aiSummary,
      userSummary: data.userSummary,
      aiTeamSummary: data.aiTeamSummary,
      userTeamSummary: data.userTeamSummary,
    });
  });
  return summaries;
};
