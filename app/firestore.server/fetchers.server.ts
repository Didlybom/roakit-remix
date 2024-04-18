import retry from 'async-retry';
import { FieldPath } from 'firebase-admin/firestore';
import NodeCache from 'node-cache';
import pino from 'pino';
import { firestore } from '../firebase.server';
import {
  AccountData,
  AccountMap,
  AccountToIdentityRecord,
  ActivityMap,
  ActivityMetadata,
  IdentityData,
  InitiativeData,
  InitiativeRecord,
  TicketRecord,
  accountSchema,
  accountToReviewSchema,
  activitySchema,
  displayName,
  emptyActivity,
  identitySchema,
  initiativeSchema,
  ticketSchema,
} from '../schemas/schemas';
import { ParseError } from '../utils/errorUtils';
import { FEED_TYPES } from '../utils/feedUtils';
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

const makeTicketsCacheKey = (customerId: number) => `${customerId};tickets`;
const ticketsCache = new NodeCache({ stdTTL: 60 /* seconds */, useClones: false });

export const queryCustomerId = async (email: string) => {
  const userDocs = (await firestore.collection('users').where('email', '==', email).get()).docs;
  if (userDocs.length === 0) {
    throw Error('User not found');
  }
  if (userDocs.length > 1) {
    throw Error('More than one User found');
  }
  return userDocs[0].data().customerId as number;
};

export const fetchInitiatives = async (customerId: number): Promise<InitiativeData[]> => {
  return await retry(async () => {
    const initiatives: InitiativeData[] = [];
    (await firestore.collection(`customers/${customerId}/initiatives`).get()).forEach(
      initiative => {
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
        const data = initiativeSchema.parse(initiative.data());
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

export const fetchIdentities = async (
  customerId: number
): Promise<{ list: IdentityData[]; accountMap: AccountToIdentityRecord }> => {
  return await retry(async () => {
    const identities: IdentityData[] = [];
    const accountMap: AccountToIdentityRecord = {};
    (await firestore.collection(`customers/${customerId}/identities`).get()).forEach(identity => {
      const data = identitySchema.parse(identity.data());
      identities.push({
        id: identity.id,
        email: data.email,
        displayName: data.displayName,
        accounts: data.accounts ?? [],
      });
      data.accounts?.forEach(account => {
        if (account.id) {
          accountMap[account.id] = identity.id;
        } else if (account.name) {
          accountMap[account.name] = identity.id;
        }
      });
    });
    return {
      list: identities.sort((a, b) => displayName(a).localeCompare(displayName(b))),
      accountMap,
    };
  }, retryProps('Retrying fetchIdentities...'));
};

export const fetchTicketPriorityMap = async (customerId: number): Promise<TicketRecord> => {
  const cacheKey = makeTicketsCacheKey(customerId);
  const cached: TicketRecord | undefined = ticketsCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  return await retry(async () => {
    const tickets: TicketRecord = {};
    (await firestore.collection(`customers/${customerId}/tickets`).get()).forEach(ticket => {
      const data = ticketSchema.parse(ticket.data());
      tickets[ticket.id] = data.priority;
    });
    ticketsCache.set(cacheKey, tickets);
    return tickets;
  }, retryProps('Retrying fetchTicketsMap...'));
};

export const fetchTicketPriorities = async (
  customerId: number,
  ticketIds: string[]
): Promise<TicketRecord> => {
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
              const data = ticketSchema.parse(ticket.data());
              tickets[ticket.id] = data.priority;
            })
          )
      );
    }
    await Promise.all(batches);
    return tickets;
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
          const data = accountSchema.parse(account.data());
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
          const data = accountToReviewSchema.parse(account.data());
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
  includesMetadata = false,
}: {
  customerId: number;
  startDate: number;
  endDate?: number;
  userIds?: string[];
  includesMetadata?: boolean;
}) => {
  return await retry(async bail => {
    let query =
      userIds ?
        firestore
          .collection(`customers/${customerId}/activities`)
          .where('actorAccountId', 'in', userIds)
      : firestore.collection(`customers/${customerId}/activities`);
    query = query.orderBy('createdTimestamp').startAt(startDate);
    if (endDate) {
      query = query.endAt(endDate);
    }
    const activityDocs = await withMetricsAsync<FirebaseFirestore.QuerySnapshot>(
      () => query.limit(20000).get(), // FIXME limit
      { metricsName: 'fetcher:getActivities' }
    );
    const activities: ActivityMap = new Map();
    activityDocs.forEach(activity => {
      const props = activitySchema.safeParse(activity.data());
      if (!props.success) {
        bail(new ParseError('Failed to parse activities. ' + props.error.message));
        return emptyActivity; // not used, bail() will throw
      }
      activities.set(activity.id, {
        action: props.data.action,
        actorId: props.data.actorAccountId,
        artifact: props.data.artifact,
        createdTimestamp: props.data.createdTimestamp,
        initiativeId: props.data.initiative,
        priority: props.data.priority,
        event: props.data.event,
        ...(includesMetadata && { metadata: props.data.metadata as ActivityMetadata }),
        objectId: props.data.objectId, // for debugging
      });
    });
    return activities;
  }, retryProps('Retrying fetchActivities...'));
};
