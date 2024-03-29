import { z } from 'zod';

export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

export const actorSchema = z.object({
  accountName: z.string().optional(),
  accountUri: z.string().optional(),
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

export const ticketSchema = z.object({
  id: z.string(),
  summary: z.string(),
  priority: z.number().optional(),
  uri: z.string().optional(),
  project: z
    .object({ id: z.string(), key: z.string(), name: z.string(), uri: z.string().optional() })
    .optional(),
  lastLastUpdatedTimestamp: z.number().optional(),
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
  metadata: z.any(),
  note: z.string().optional(),
  objectId: z.string().optional(), // for debugging
});

export interface InitiativeData {
  id: string;
  label?: string;
  counters: {
    activities: ActivityCount;
  };
  countersLastUpdated: number;
}

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

export type InitiativeMap = Record<InitiativeData['id'], Omit<InitiativeData, 'id'>>;

export type TicketMap = Record<TicketData['key'], Omit<TicketData, 'key'>>;

export interface ActorData {
  id: string;
  name?: string;
  url?: string;
}

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg';

export interface ActivityData {
  id: string;
  action: string;
  event?: string;
  actorId?: string;
  artifact: Artifact;
  createdTimestamp: number;
  initiativeId: string;
  priority?: number;
  metadata: unknown;
  note?: string;
  objectId?: string; // for debugging
}

export type ActivityMap = Record<ActivityData['id'], Omit<ActivityData, 'id' | 'metadata'>>;

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
  }[];
  initiatives: InitiativeData[];
}
