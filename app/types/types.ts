import type { Role } from '../utils/userUtils';

export type InitiativeData = {
  id: string;
  label?: string;
  counters: {
    activities: ActivityCount;
  };
  countersLastUpdated: number;
};

export type InitiativeRecord = Record<InitiativeData['id'], Omit<InitiativeData, 'id'>>;

export type AccountData = {
  id: string;
  type: string;
  name: string;
  url?: string;
};
export type AccountMap = Map<AccountData['id'], Omit<AccountData, 'id'>>;

export interface IdentityData {
  id: string;
  email?: string;
  displayName?: string;
  managerId?: string;
  reportIds?: string[];
  user?: { id: string; role?: Role };
  accounts: { feedId: number; type: string; id: AccountData['id']; name?: string; url?: string }[];
}

export type AccountToIdentityRecord = Record<AccountData['id'], IdentityData['id']>;

export type ActorData = {
  id: string;
  name: string;
  email?: string;
  accounts?: { id: string; type: string; url?: string }[];
};
export type ActorRecord = Record<ActorData['id'], Omit<ActorData, 'id'>>;

export type TicketData = {
  key: string;
  id?: string;
  summary?: string;
  uri?: string;
  priority?: number;
  project?: {
    id?: string;
    key: string;
    name?: string;
    uri?: string;
  };
  lastUpdatedTimestamp?: number;
};

export type TicketRecord = Record<TicketData['key'], TicketData['priority']>;

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg';

export type ActivityChangeLog = {
  field: string;
  oldValue?: string;
  newValue?: string;
};

export type ActivityMetadata = {
  codeAction?: string;
  issue?: { key: string; summary?: string; uri?: string };
  attachment?: { filename: string; mimeType?: string };
  sprint?: { name: string; state: string };
  worklog?: unknown;
  pullRequest?: { ref: string; codeAction: string; title: string; uri?: string };
  pullRequestComment?: { body: string; uri?: string };
  commits?: { message: string; url?: string }[];
  comment?: { body: string };
  changeLog?: ActivityChangeLog[];
};

export type ActivityData = {
  id: string;
  action: string;
  event?: string;
  actorId?: string;
  artifact: Artifact;
  createdTimestamp: number;
  initiativeId: string;
  priority?: number;
  metadata?: ActivityMetadata;
  note?: string;
  objectId?: string; // for debugging
};

export type ActivityMap = Map<ActivityData['id'], Omit<ActivityData, 'id'>>;
export type ActivityRecord = Record<ActivityData['id'], Omit<ActivityData, 'id'>>;

export type ActivityCount = {
  code: number;
  codeOrg: number;
  task: number;
  taskOrg: number;
};

export type SettingsData = {
  feeds: {
    secret?: string | undefined;
    feedId: string;
    type: string;
    clientId: string;
    bannedEvents?: Record<string, boolean>;
    bannedAccounts?: Record<string, boolean>;
  }[];
  initiatives: InitiativeData[];
};

export type Summary = {
  identityId: string;
  aiSummary?: string;
  userSummary?: string;
  aiTeamSummary?: string;
  userTeamSummary?: string;
};

export type DaySummaries = Record<string, Summary>;
