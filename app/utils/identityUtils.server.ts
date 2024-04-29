import type { AccountToIdentityRecord, IdentityData } from '../types/types';

/**
 *  Returns all user ids candidate as activity keys (activities can use both identityIds and accountIds)
 */
export const getAllPossibleActivityUserIds = (
  knownUserId: string,
  identities: IdentityData[],
  accountMap: AccountToIdentityRecord
) => {
  const userIds = new Set([knownUserId]);
  let identityId: string;
  if (accountMap[knownUserId]) {
    // if userId is not an identity, add the identity
    identityId = accountMap[knownUserId];
    userIds.add(identityId);
  } else {
    identityId = knownUserId;
  }
  // add the other accounts for the identity
  identities
    .filter(identity => identity.id === identityId)
    .flatMap(identity => identity.accounts)
    .map(account => account.id)
    .filter(accountId => accountId !== undefined)
    .forEach(accountId => userIds.add(accountId));

  return [...userIds];
};
