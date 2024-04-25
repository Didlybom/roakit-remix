import { z } from 'zod';

export const bannedRecordSchema = z.record(z.string(), z.boolean());
export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
  bannedEvents: bannedRecordSchema.optional(),
  bannedAccounts: bannedRecordSchema.optional(),
});

export const initiativeSchema = z.object({
  label: z.string().optional(),
  counters: z
    .object({
      activities: z.object({
        code: z.number(),
        codeOrg: z.number(),
        task: z.number(),
        taskOrg: z.number(),
      }),
    })
    .optional(),
  countersLastUpdated: z.number().optional(),
});

export const accountSchema = z.object({
  accountName: z.string(),
  accountUri: z.string().optional(),
});

export const accountToReviewSchema = z.object({
  createdDate: z.number(),
  accountName: z.string(),
  accountUri: z.string().optional(),
});

export const identitySchema = z.object({
  email: z.string().optional(),
  displayName: z.string().optional(),
  managerId: z.string().optional(),
  accounts: z
    .object({
      feedId: z.number(),
      type: z.string(),
      id: z.string().optional(),
      name: z.string().optional(),
      url: z.string().optional(),
    })
    .array()
    .optional(),
  lastLastUpdatedTimestamp: z.number().optional(),
});

export const ticketSchema = z.object({
  id: z.string(),
  summary: z.string(),
  priority: z.number().optional(),
  uri: z.string().optional(),
  project: z
    .object({ id: z.string(), key: z.string(), name: z.string(), uri: z.string().optional() })
    .optional(),
  lastUpdatedTimestamp: z.number().optional(),
});

export const ARTIFACTS = ['code', 'codeOrg', 'task', 'taskOrg'] as const;

export const activitySchema = z.object({
  action: z.string(),
  event: z.string().optional(),
  actorAccountId: z.string().optional(),
  createdTimestamp: z.number(),
  artifact: z.enum(ARTIFACTS),
  initiative: z.string(),
  priority: z.number().optional(),
  metadata: z.any(), // we only strongly typed the parsed objects for now, see schemas.ts#ActivityMetadata
  note: z.string().optional(),
  objectId: z.string().optional(), // for debugging
});

export const summarySchema = z.object({
  aiSummary: z.string(),
  userSummary: z.string().optional(),
  createdTimestamp: z.number().optional(),
  lastUpdatedTimestamp: z.number().optional(),
});

export interface InitiativeData {
  id: string;
  label?: string;
  counters: {
    activities: ActivityCount;
  };
  countersLastUpdated: number;
}

export type InitiativeRecord = Record<InitiativeData['id'], Omit<InitiativeData, 'id'>>;

export interface AccountData {
  id: string;
  type: string;
  name: string;
  url?: string;
}
export type AccountMap = Map<AccountData['id'], Omit<AccountData, 'id'>>;

export interface IdentityData {
  id: string;
  email?: string;
  displayName?: string;
  managerId?: string;
  accounts: { feedId: number; type: string; id?: AccountData['id']; name?: string; url?: string }[];
}

export type AccountToIdentityRecord = Record<AccountData['id'], IdentityData['id']>;

export const displayName = (id: IdentityData) => id.displayName || id.email || id.id;

export interface ActorData {
  id: string;
  name: string;
  email?: string;
  urls?: { type: string; url: string }[];
}
export type ActorRecord = Record<ActorData['id'], Omit<ActorData, 'id'>>;

export interface TicketData {
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
}

export type TicketRecord = Record<TicketData['key'], TicketData['priority']>;

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg';

export interface ActivityChangeLog {
  field: string;
  oldValue?: string;
  newValue?: string;
}

export interface ActivityMetadata {
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
}

export interface ActivityData {
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
}

export type ActivityMap = Map<ActivityData['id'], Omit<ActivityData, 'id'>>;
export type ActivityRecord = Record<ActivityData['id'], Omit<ActivityData, 'id'>>;

export interface ActivityCount {
  code: number;
  codeOrg: number;
  task: number;
  taskOrg: number;
}

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

export interface SettingsData {
  feeds: {
    secret?: string | undefined;
    feedId: string;
    type: string;
    clientId: string;
    bannedEvents?: Record<string, boolean>;
    bannedAccounts?: Record<string, boolean>;
  }[];
  initiatives: InitiativeData[];
}
