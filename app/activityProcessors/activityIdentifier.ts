import type {
  AccountMap,
  AccountToIdentityRecord,
  Activity,
  ActorRecord,
  Identity,
} from '../types/types';

export const identifyAccounts = (
  accounts: AccountMap,
  identities: Identity[],
  identityAccountMap: AccountToIdentityRecord
) => {
  const actors: ActorRecord = {};

  accounts.forEach((account, accountId) => {
    const identityId = identityAccountMap[accountId];
    if (identityId) {
      const identity = identities.find(i => i.id === identityId);
      if (!identity) {
        return;
      }
      if (!actors[identityId]) {
        actors[identityId] = {
          name: identity.displayName ?? identityId,
          email: identity.email,
          accounts: identity.accounts.map(a => ({ id: a.id, type: a.type, url: a.url })),
        };
      }
      // add account url if identity doesn't have it
      const identityAccount = actors[identityId].accounts?.find(a => a.id === accountId);
      if (identityAccount && !identityAccount?.url) {
        identityAccount.url = account.url;
      }
    } else {
      // no identity, use the accountId as key
      actors[accountId] = {
        name: account.name || accountId,
        ...(account.url && { urls: [{ type: account.type, url: account.url }] }),
      };
    }
  });

  // add the identities without accounts
  identities
    .filter(identity => !actors[identity.id])
    .forEach(identity => {
      actors[identity.id] = {
        name: identity.displayName ?? identity.id,
        email: identity.email,
      };
    });

  return actors;
};

export const identifyActivities = (activities: Activity[], accountMap: AccountToIdentityRecord) => {
  activities.forEach(activity => {
    if (activity.actorId && accountMap[activity.actorId]) {
      activity.actorId = accountMap[activity.actorId];
    }
  });
  return activities;
};
