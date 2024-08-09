import type { AccountToIdentityRecord, Identity } from '../types/types';

/**
 *  Returns all user ids candidate as activity keys (activities can use both identityIds and accountIds)
 */
export const getAllPossibleActivityUserIds = (
  knownUserIds: string[],
  identities: Identity[],
  accountMap: AccountToIdentityRecord
) => {
  const userIds = new Set(knownUserIds);
  let identityId: string;
  knownUserIds.forEach(knownUserId => {
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
      .filter(accountId => accountId != null)
      .forEach(accountId => userIds.add(accountId));
  });
  return [...userIds];
};
