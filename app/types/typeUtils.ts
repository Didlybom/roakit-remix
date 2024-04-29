import type { ActivityData, IdentityData } from './types';

export const displayName = (id: IdentityData) => id.displayName || id.email || id.id;

export const emptyActivity: ActivityData = {
  id: '',
  action: '',
  actorId: '-1',
  artifact: 'code',
  createdTimestamp: -1,
  initiativeId: '-1',
  priority: -1,
  metadata: {},
};
