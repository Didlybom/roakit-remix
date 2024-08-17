import retry from 'async-retry';
import dayjs from 'dayjs';
import { FieldPath, type Query } from 'firebase-admin/firestore';
import NodeCache from 'node-cache';
import { firestore } from '../firebase.server';
import { combineAndPushActivity } from '../processors/activityCombiner';
import { findFirstTicket } from '../processors/activityFeed';
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
  type CustomerSettings,
  type DaySummaries,
  type Group,
  type GroupToIdentitiesRecord,
  type Identity,
  type Initiative,
  type InitiativeActorStats,
  type InitiativeRecord,
  type Phase,
  type Summary,
  type Ticket,
  type TicketPlanHistory,
  type TicketRecord,
} from '../types/types';
import { daysInMonth } from '../utils/dateUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { forEachRight } from '../utils/mapUtils';
import type { Role } from '../utils/rbac';
import { DEFAULT_ROLE } from '../utils/rbac';
import { withMetricsAsync } from '../utils/withMetrics.server';

const logger = getLogger('firestore:fetchers');
const EXPLAIN_QUERIES = process.env?.EXPLAIN_QUERIES === 'true';

const explainQuery = async (query: FirebaseFirestore.Query) => {
  const metrics = (await query.explain({ analyze: true })).metrics;
  return {
    indexesUsed: metrics.planSummary.indexesUsed,
    executionStats: metrics.executionStats,
  };
};

const retryProps = (message: string) => ({
  // see https://github.com/tim-kos/node-retry#api
  retries: 1,
  factor: 2,
  minTimeout: 500,
  onRetry: (e: unknown) => logger.warn(e, message),
});

const makeCustomerSettingsCacheKey = (customerId: number) => `${customerId};settings`;
const customerSettingsCache = new NodeCache({ stdTTL: 300 /* seconds */, useClones: false });

export const queryCustomer = async (customerId: number): Promise<CustomerSettings> => {
  const cacheKey = makeCustomerSettingsCacheKey(customerId);
  const cache: CustomerSettings | undefined = customerSettingsCache.get(cacheKey);
  if (cache != null) {
    return cache;
  }
  const doc = await retry(
    async () => await firestore.doc(`customers/${customerId}`).get(),
    retryProps('Retrying queryCustomer...')
  );
  const data = doc.data();
  if (!data) {
    throw Error(`Customer ${customerId} not found`);
  }
  const settings = parse<schemas.CustomerType>(schemas.customerSchema, data, 'customer ' + doc.id);
  customerSettingsCache.set(cacheKey, settings);
  return settings;
};

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
    throw Error(`User ${email} not found`);
  }
  if (userDocs.length > 1) {
    throw Error(`More than one User found for ${email}`);
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
    groups: data.groups,
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
    identities.push({ id: doc.id, groups: data.groups, accounts: data.accounts ?? [] });
  });
  return identities;
};

const makeInitiativeCacheKey = (customerId: number) => `${customerId};initiatives`;
const initiativeCache = new NodeCache({ stdTTL: 60 /* seconds */, useClones: false });

export const fetchInitiativesWithCache = async (customerId: number): Promise<InitiativeRecord> => {
  const cacheKey = makeInitiativeCacheKey(customerId);
  const cache: InitiativeRecord | undefined = initiativeCache.get(cacheKey);
  if (cache != null) {
    return cache;
  }
  const initiatives: InitiativeRecord = {};
  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/initiatives`).get(),
      retryProps('Retrying fetchInitiatives...')
    )
  ).forEach(doc => {
    const data = parse<schemas.InitiativeType>(
      schemas.initiativeSchema,
      doc.data(),
      'initiative ' + doc.id
    );
    initiatives[doc.id] = {
      key: data.key ?? doc.id,
      activityMapper: data.activityMapper,
    };
  });
  initiativeCache.set(cacheKey, initiatives);
  return initiatives;
};

export const fetchInitiativeMap = async (customerId: number): Promise<InitiativeRecord> => {
  const initiatives: InitiativeRecord = {};
  (
    await retry(
      async () => await firestore.collection(`customers/${customerId}/initiatives`).get(),
      retryProps('Retrying fetchInitiativeMap...')
    )
  ).forEach(doc => {
    const data = parse<schemas.InitiativeType>(
      schemas.initiativeSchema,
      doc.data(),
      'initiative ' + doc.id
    );
    initiatives[doc.id] = {
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
  return initiatives;
};

export const fetchInitiatives = async (customerId: number): Promise<Initiative[]> => {
  const initiatives: Initiative[] = [];
  const initiativeMap = await fetchInitiativeMap(customerId);
  Object.entries(initiativeMap).forEach(([id, initiative]) =>
    initiatives.push({ ...initiative, id })
  );
  return initiatives.sort((a, b) => a.key.localeCompare(b.key));
};

const findIdentity = (identities: Identity[], id: string) => identities.find(i => i.id === id)!;

export const fetchIdentities = async (
  customerId: number
): Promise<{
  list: Identity[];
  accountMap: AccountToIdentityRecord;
  groupMap: GroupToIdentitiesRecord;
}> => {
  const identities: Identity[] = [];
  const accountMap: AccountToIdentityRecord = {};
  const groupMap: GroupToIdentitiesRecord = {};

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
      groups: data.groups,
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
    // map groups to identities
    data.groups?.forEach(group => {
      if (!groupMap[group]) groupMap[group] = [];
      groupMap[group].push(doc.id);
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
    groupMap,
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
    .forEach(doc => {
      const data = parse<schemas.TicketType>(schemas.ticketSchema, doc.data(), 'ticket ' + doc.id);
      tickets[doc.id] = data.priority;
    });
  // add to the cache freshly found tickets
  ticketsCache.set(cacheKey, { tickets: { ...cache?.tickets, ...tickets } });
  return { ...tickets, ...fromCache };
};

export const fetchTickets = async (
  customerId: number,
  ticketKeys?: string[]
): Promise<Ticket[]> => {
  const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  if (!ticketKeys) {
    let query = firestore
      .collection(`customers/${customerId}/tickets`)
      .orderBy('lastUpdatedTimestamp', 'desc')
      .limit(1000); // FIXME limit
    if (EXPLAIN_QUERIES) {
      logger.debug(await explainQuery(query));
    }
    batches.push(query.get());
  } else {
    while (ticketKeys.length) {
      // firestore supports up to 30 IN comparisons at a time
      const batch = ticketKeys.splice(0, 30);
      let query = firestore
        .collection(`customers/${customerId}/tickets`)
        .where(FieldPath.documentId(), 'in', [...batch])
        .orderBy('lastUpdatedTimestamp', 'desc');
      if (EXPLAIN_QUERIES) {
        logger.debug(await explainQuery(query));
      }
      batches.push(query.get());
    }
  }

  const ticketDocs = (
    await withMetricsAsync(
      () => retry(async () => await Promise.all(batches), retryProps('Retrying fetchTickets...')),
      { metricsName: 'fetchTickets' }
    )
  ).flatMap(t => t.docs);

  const tickets: Ticket[] = [];
  ticketDocs.forEach(doc => {
    const data = parse<schemas.TicketType>(schemas.ticketSchema, doc.data(), 'ticket ' + doc.id);
    tickets.push({ ...data, key: doc.id });
  });
  return tickets;
};

export const fetchTicketPlanHistory = async (
  customerId: number,
  ticketKey: string
): Promise<TicketPlanHistory> => {
  const planHistory: TicketPlanHistory['planHistory'] = [];
  (
    await retry(
      async () =>
        firestore
          .collection(`customers/${customerId}/tickets/${ticketKey}/planHistory`)
          .orderBy('timestamp', 'desc')
          .get(),
      retryProps('Retrying fetchTicketPlanHistory...')
    )
  ).forEach(doc => {
    const data = parse<schemas.TicketPlanHistoryType>(
      schemas.ticketPlanHistorySchema,
      doc.data(),
      'ticket plan history ' + doc.id
    );
    planHistory.push(data);
  });
  return { ticketKey, planHistory };
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

export const fetchGroups = async (customerId: number): Promise<Group[]> => {
  const groups: Group[] = [];
  (
    await retry(
      async () => firestore.collection(`customers/${customerId}/groups`).get(),
      retryProps('Retrying fetchGroups...')
    )
  ).forEach(doc => {
    const data = parse<schemas.GroupType>(schemas.groupSchema, doc.data(), 'group ' + doc.id);
    groups.push({ id: doc.id, name: data.name });
  });
  return groups;
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
  options?: {
    includeMetadata?: boolean;
    findPriority?: boolean;
    combine?: boolean;
    useIdentityId?: boolean;
  };
}) => {
  const batches: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
  if (!userIds) {
    let query = firestore
      .collection(`customers/${customerId}/activities`)
      .orderBy('createdTimestamp', 'desc')
      .endAt(startDate);
    if (endDate) {
      query = query.startAt(endDate);
    }
    query = query.limit(20000); // FIXME limit
    if (EXPLAIN_QUERIES) {
      logger.debug(await explainQuery(query));
    }
    batches.push(query.get());
  } else {
    while (userIds.length) {
      // firestore supports up to 30 IN comparisons at a time
      const batch = userIds.splice(0, 30);
      let query = firestore
        .collection(`customers/${customerId}/activities`)
        .where(options?.useIdentityId ? 'identityId' : 'actorAccountId', 'in', [...batch])
        .orderBy('createdTimestamp', 'desc')
        .endAt(startDate);
      if (endDate) {
        query = query.startAt(endDate);
      }
      query = query.limit(20000); // FIXME limit
      if (EXPLAIN_QUERIES) {
        logger.debug(await explainQuery(query));
      }
      batches.push(query.get());
    }
  }

  const activityDocs = (
    await withMetricsAsync(
      () =>
        retry(async () => await Promise.all(batches), retryProps('Retrying fetchActivities...')),
      { metricsName: 'fetchActivities' }
    )
  ).flatMap(a => a.docs);

  const activities: Activity[] = [];
  const ticketPrioritiesToFetch = new Set<string>();
  const activityTickets = new Map<string, string>();

  forEachRight(activityDocs, doc => {
    const data = parse<schemas.ActivityType>(
      schemas.activitySchema,
      doc.data(),
      'activity ' + doc.id
    );
    const priority = data.priority;
    if ((!priority || priority === -1) && options?.findPriority) {
      // will find priority from metadata for activities missing one
      const ticket = findFirstTicket(data.metadata as ActivityMetadata, data.description);
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
        createdTimestamp: data.createdTimestamp,
        timestamp: data.eventTimestamp ?? data.createdTimestamp,
        initiativeId: data.initiativeId,
        effort: data.effort,
        ongoing: data.ongoing,
        previousActivityId: data.previousActivityId,
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
      const activity = activities.find(a => a.id === activityId);
      if (activity) {
        activity.priority = tickets[activityTicket];
      }
    });
  }

  return activities;
};

export const fetchActivitiesPage = async ({
  customerId,
  startAfter,
  endBefore,
  userIds,
  artifacts,
  limit,
  combine,
  useIdentityId = false,
}: {
  customerId: number;
  startAfter?: number;
  endBefore?: number;
  userIds?: string[];
  artifacts?: string[];
  limit: number;
  combine?: boolean;
  useIdentityId?: boolean;
}) => {
  if (startAfter != null && endBefore != null) {
    throw Error('startAfter and endBefore are mutually exclusive params.');
  }
  const activitiesCollection = firestore.collection(`customers/${customerId}/activities`);
  let activityQuery = activitiesCollection as Query;
  if (userIds?.length) {
    activityQuery = activityQuery.where(
      useIdentityId ? 'identityId' : 'actorAccountId',
      'in',
      userIds
    );
  }
  if (artifacts?.length) {
    activityQuery = activityQuery.where('artifact', 'in', artifacts);
  }
  let activityPageQuery = activityQuery.orderBy('createdTimestamp', 'desc');
  if (startAfter != null) {
    activityPageQuery = activityPageQuery.startAfter(startAfter).limit(limit);
  } else if (endBefore != null) {
    activityPageQuery = activityPageQuery.endBefore(endBefore).limitToLast(limit);
  } else {
    activityPageQuery = activityPageQuery.limit(limit);
  }

  if (EXPLAIN_QUERIES) {
    logger.debug(await explainQuery(activityPageQuery));
  }

  let activityPage = await retry(
    async () => activityPageQuery.get(),
    retryProps('Retrying fetchActivitiesPage...')
  );

  const activities: Activity[] = [];
  const ticketPrioritiesToFetch = new Set<string>();
  const activityTickets = new Map<string, string>();

  activityPage.forEach(doc => {
    const data = parse<schemas.ActivityType>(
      schemas.activitySchema,
      doc.data(),
      `activity ${doc.id}`
    );
    const priority = data.priority;
    if (!priority || priority === -1) {
      // will find priority from metadata for activities missing one
      const ticket = findFirstTicket(data.metadata as ActivityMetadata, data.description);
      if (ticket) {
        ticketPrioritiesToFetch.add(ticket);
        activityTickets.set(doc.id, ticket);
      }
    }
    activities.push({
      id: doc.id,
      action: data.action,
      eventType: data.eventType,
      event: data.event,
      actorId: data.actorAccountId,
      artifact: data.artifact as Artifact,
      createdTimestamp: data.createdTimestamp,
      timestamp: data.eventTimestamp ?? data.createdTimestamp,
      priority: data.priority,
      initiativeId: data.initiativeId,
      phase: data.phase as Phase,
      effort: data.effort,
      ongoing: data.ongoing,
      previousActivityId: data.previousActivityId,
      description: data.description,
      metadata: data.metadata as ActivityMetadata,
      reactions: data.reactions,
      note: data.note,
      objectId: data.objectId, // for debugging
    });
  });
  if (combine) {
    const combinedActivities: Activity[] = [];
    for (let i = activities.length - 1; i >= 0; i--) {
      combineAndPushActivity(activities[i], combinedActivities);
    }
    combinedActivities.sort((a, b) => b.timestamp - a.timestamp);
    return combinedActivities;
  }
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

export const fetchInitiativeStats = async ({
  customerId,
  startDay /* YYYYMMDD */,
  endDay,
}: {
  customerId: number;
  startDay: number;
  endDay?: number;
}) => {
  const stats: InitiativeActorStats[] = [];

  let query = firestore
    .collection(`customers/${customerId}/initiativeCounters`)
    .orderBy('day')
    .startAt(startDay);
  if (endDay) {
    query = query.endAt(endDay);
  }
  query = query.limit(20000); // FIXME limit
  const documents = await retry(
    async () => await query.get(),
    retryProps('Retrying fetchInitiativeStats...')
  );
  documents.forEach(doc => {
    const data = parse<schemas.InitiativeStatsType>(
      schemas.initiativeStatsSchema,
      doc.data(),
      'initiative stats ' + doc.id
    );
    stats.push(data);
  });
  return stats;
};
