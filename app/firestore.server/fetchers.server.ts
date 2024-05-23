import retry from 'async-retry';
import dayjs from 'dayjs';
import { FieldPath } from 'firebase-admin/firestore';
import NodeCache from 'node-cache';
import pino from 'pino';
import { firestore } from '../firebase.server';
import { findTicket } from '../types/activityFeed';
import * as schemas from '../types/schemas';
import { displayName, emptyActivity } from '../types/typeUtils';
import type {
  AccountData,
  AccountMap,
  AccountToIdentityRecord,
  ActivityMap,
  ActivityMetadata,
  DaySummaries,
  IdentityData,
  InitiativeData,
  InitiativeRecord,
  Summary,
  TicketRecord,
} from '../types/types';
import { daysInMonth } from '../utils/dateUtils';
import { ParseError } from '../utils/errorUtils';
import { FEED_TYPES } from '../utils/feedUtils';
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

interface TicketCache {
  tickets: TicketRecord;
  hasAllTickets?: boolean;
}
const makeTicketsCacheKey = (customerId: number) => `${customerId};tickets`;
const ticketsCache = new NodeCache({ stdTTL: 60 /* seconds */, useClones: false });

export const queryUser = async (
  email: string
): Promise<{ customerId: number; id: string; role: Role }> => {
  return await retry(async () => {
    const userDocs = (await firestore.collection('users').where('email', '==', email).get()).docs;
    if (userDocs.length === 0) {
      throw Error('User not found');
    }
    if (userDocs.length > 1) {
      throw Error('More than one User found');
    }
    const data = schemas.userSchema.parse(userDocs[0].data());
    return {
      customerId: data.customerId,
      id: userDocs[0].id,
      role: data.role! || DEFAULT_ROLE,
    };
  }, retryProps('Retrying queryUser...'));
};

export const queryIdentity = async (
  customerId: number,
  key: { identityId?: string; email?: string }
): Promise<IdentityData> => {
  if (!key.identityId && !key.email) {
    throw Error('queryIdentity missing param');
  }
  return await retry(async () => {
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
        await firestore
          .collection(`customers/${customerId}/identities`)
          .where('email', '==', key.email)
          .get()
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
    const data = schemas.identitySchema.parse(doc.data());
    return {
      id,
      email: data.email,
      displayName: data.displayName,
      managerId: data.managerId,
      accounts: data.accounts ?? [],
    };
  }, retryProps('Retrying queryIdentity...'));
};

export const queryTeamIdentities = async (
  customerId: number,
  managerId: string
): Promise<IdentityData[]> => {
  return await retry(async () => {
    const identities: IdentityData[] = [];
    (
      await firestore
        .collection(`customers/${customerId}/identities`)
        .where('managerId', '==', managerId)
        .get()
    ).docs.forEach(doc => {
      const data = schemas.identitySchema.parse(doc.data());
      identities.push({
        id: doc.id,
        accounts: data.accounts ?? [],
      });
    });
    return identities;
  }, retryProps('Retrying queryTeamIdentities...'));
};

export const fetchInitiatives = async (customerId: number): Promise<InitiativeData[]> => {
  return await retry(async () => {
    const initiatives: InitiativeData[] = [];
    (await firestore.collection(`customers/${customerId}/initiatives`).get()).forEach(
      initiative => {
        const data = schemas.initiativeSchema.parse(initiative.data());
        initiatives.push({
          id: initiative.id,
          label: data.label,
          counters:
            data.counters ?
              { activities: data.counters.activities }
            : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 } },
          countersLastUpdated: data.countersLastUpdated ?? 0,
        });
      }
    );
    return initiatives.sort((a, b) => a.id.localeCompare(b.id));
  }, retryProps('Retrying fetchInitiatives...'));
};

export const fetchInitiativeMap = async (customerId: number): Promise<InitiativeRecord> => {
  return await retry(async () => {
    const initiatives: InitiativeRecord = {};
    (await firestore.collection(`customers/${customerId}/initiatives`).get()).forEach(
      initiative => {
        const data = schemas.initiativeSchema.parse(initiative.data());
        initiatives[initiative.id] = {
          label: data.label,
          counters:
            data.counters ?
              { activities: data.counters.activities }
            : { activities: { code: 0, codeOrg: 0, task: 0, taskOrg: 0 } },
          countersLastUpdated: data.countersLastUpdated ?? 0,
        };
      }
    );
    return initiatives;
  }, retryProps('Retrying fetchInitiativeMap...'));
};

const findIdentity = (identities: IdentityData[], id: string) => identities.find(i => i.id === id)!;

export const fetchIdentities = async (
  customerId: number
): Promise<{ list: IdentityData[]; accountMap: AccountToIdentityRecord }> => {
  return await retry(async () => {
    const identities: IdentityData[] = [];
    const accountMap: AccountToIdentityRecord = {};

    const usersByEmail: Record<string, { id: string; role: Role }> = {};
    (await firestore.collection('users').where('customerId', '==', customerId).get()).forEach(
      user => {
        const data = schemas.userSchema.parse(user.data());
        usersByEmail[data.email] = { id: user.id, role: data.role ?? DEFAULT_ROLE };
      }
    );

    (await firestore.collection(`customers/${customerId}/identities`).get()).forEach(identity => {
      const data = schemas.identitySchema.parse(identity.data());
      identities.push({
        id: identity.id,
        email: data.email,
        displayName: data.displayName,
        managerId: data.managerId,
        user: usersByEmail[data.email ?? ''] ?? { role: DEFAULT_ROLE },
        accounts: data.accounts ?? [],
      });
      // map accounts to identities
      data.accounts?.forEach(account => {
        if (account.id) {
          accountMap[account.id] = identity.id;
        } else if (account.name) {
          accountMap[account.name] = identity.id;
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
  }, retryProps('Retrying fetchIdentities...'));
};

export const fetchTicketPriorityMap = async (customerId: number): Promise<TicketRecord> => {
  const cacheKey = makeTicketsCacheKey(customerId);
  const cache: TicketCache | undefined = ticketsCache.get(cacheKey);
  if (cache?.hasAllTickets) {
    // hasAllTickets is false when fetchTicketPriorities() cached tickets, and the cache was empty
    return cache.tickets;
  }
  return await retry(async () => {
    const tickets: TicketRecord = {};
    (await firestore.collection(`customers/${customerId}/tickets`).get()).forEach(ticket => {
      const data = schemas.ticketSchema.parse(ticket.data());
      tickets[ticket.id] = data.priority;
    });
    ticketsCache.set(cacheKey, { tickets, hasAllTickets: true });
    return tickets;
  }, retryProps('Retrying fetchTicketsMap...'));
};

export const fetchTicketPriorities = async (
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

  return await retry(async () => {
    const tickets: TicketRecord = {};
    const batches = [];
    while (ticketIds.length) {
      // firestore supports up to 30 IN comparisons at a time
      const batch = ticketIds.splice(0, 30);
      batches.push(
        firestore
          .collection(`customers/${customerId}/tickets`)
          .where(FieldPath.documentId(), 'in', [...batch])
          .get()
          .then(result =>
            result.docs.map(ticket => {
              const data = schemas.ticketSchema.parse(ticket.data());
              tickets[ticket.id] = data.priority;
            })
          )
      );
    }
    await Promise.all(batches);

    // add to the cache freshly found tickets
    ticketsCache.set(cacheKey, { tickets: { ...cache?.tickets, ...tickets } });

    return { ...tickets, ...fromCache };
  }, retryProps('Retrying fetchTickets...'));
};

export const fetchAccountMap = async (customerId: number): Promise<AccountMap> => {
  return await retry(async () => {
    const accounts: AccountMap = new Map();
    await Promise.all(
      FEED_TYPES.map(async feed => {
        (
          await firestore.collection(`customers/${customerId}/feeds/${feed.id}/accounts`).get()
        ).forEach(account => {
          const data = schemas.accountSchema.parse(account.data());
          accounts.set(account.id, {
            type: feed.type,
            name: data.accountName,
            url: data.accountUri,
          });
        });
      })
    );
    return accounts;
  }, retryProps('Retrying fetchAccountMap...'));
};

export const fetchAccountsToReview = async (customerId: number): Promise<AccountData[]> => {
  return await retry(async () => {
    const accounts: AccountData[] = [];
    await Promise.all(
      FEED_TYPES.map(async feed => {
        (
          await firestore
            .collection(`customers/${customerId}/feeds/${feed.id}/accountsToReview`)
            .get()
        ).forEach(account => {
          const data = schemas.accountToReviewSchema.parse(account.data());
          accounts.push({
            id: account.id,
            type: feed.type,
            name: data.accountName,
            url: data.accountUri,
          });
        });
      })
    );
    return accounts;
  }, retryProps('Retrying fetchAccountsToReview...'));
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
  options?: { includesMetadata?: boolean; findPriority?: boolean };
}) => {
  return await retry(async bail => {
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
      await withMetricsAsync(() => Promise.all(batches), { metricsName: 'fetcher:getActivities' })
    ).flatMap(a => a.docs);

    const activities: ActivityMap = new Map();
    const ticketPrioritiesToFetch = new Set<string>();
    const activityTickets = new Map<string, string>();

    activityDocs.forEach(activity => {
      const props = schemas.activitySchema.safeParse(activity.data());
      if (!props.success) {
        bail(new ParseError('Failed to parse activities. ' + props.error.message));
        return emptyActivity; // not used, bail() will throw
      }
      const priority = props.data.priority;
      if ((!priority || priority === -1) && options?.findPriority) {
        // will find priority from metadata for activities missing one
        const ticket = findTicket(props.data.metadata as ActivityMetadata);
        if (ticket) {
          ticketPrioritiesToFetch.add(ticket);
          activityTickets.set(activity.id, ticket);
        }
      }
      activities.set(activity.id, {
        action: props.data.action,
        actorId: props.data.actorAccountId,
        artifact: props.data.artifact,
        createdTimestamp: props.data.createdTimestamp,
        initiativeId: props.data.initiative,
        priority, // see overwrite below
        event: props.data.event,
        ...(options?.includesMetadata && { metadata: props.data.metadata as ActivityMetadata }),
        objectId: props.data.objectId, // for debugging
      });
    });
    if (ticketPrioritiesToFetch.size > 0) {
      const tickets = await fetchTicketPriorities(customerId, [...ticketPrioritiesToFetch]);
      activityTickets.forEach((activityTicket, activityId) => {
        // add the found priority to the activity
        const activity = activities.get(activityId);
        if (activity) {
          activity.priority = tickets[activityTicket];
        }
      });
    }

    return activities;
  }, retryProps('Retrying fetchActivities...'));
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
      days.map(async day => {
        return {
          day,
          snapshot: await firestore
            .collection(`customers/${customerId}/summaries/${day}/instances`)
            .where('identityId', '==', identityId)
            .get(),
        };
      })
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
    const props = schemas.summarySchema.safeParse(document.snapshot.docs[0].data());
    if (!props.success) {
      throw new ParseError('Failed to parse summary. ' + props.error.message);
    }
    summaries[document.day] = {
      identityId: props.data.identityId, // useless here
      aiSummary: props.data.aiSummary,
      userSummary: props.data.userSummary,
      aiTeamSummary: props.data.aiTeamSummary,
      userTeamSummary: props.data.userTeamSummary,
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
  documents.forEach(document => {
    const props = schemas.summarySchema.safeParse(document.data());
    if (!props.success) {
      throw new ParseError('Failed to parse summary. ' + props.error.message);
    }
    summaries.push({
      identityId: props.data.identityId,
      aiSummary: props.data.aiSummary,
      userSummary: props.data.userSummary,
      aiTeamSummary: props.data.aiTeamSummary,
      userTeamSummary: props.data.userTeamSummary,
    });
  });
  return summaries;
};
