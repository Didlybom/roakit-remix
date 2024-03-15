import { z } from 'zod';

export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

export const actorSchema = z.object({
  accountName: z.string().optional(),
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

export const ARTIFACTS = ['code', 'codeOrg', 'task', 'taskOrg'] as const;

export const activitySchema = z.object({
  action: z.string(),
  actorAccountId: z.string(),
  createdTimestamp: z.number(),
  artifact: z.enum(ARTIFACTS),
  initiative: z.string(),
  priority: z.number().optional(),
  metadata: z.any(),
});

export interface InitiativeData {
  id: string;
  label?: string;
  counters: {
    activities: ActivityCount;
  };
  countersLastUpdated: number;
}

export type InitiativeMap = Record<InitiativeData['id'], Omit<InitiativeData, 'id'>>;

export interface ActorData {
  id: string;
  name?: string;
  url?: string;
}

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg';

export interface ActivityData {
  id: string;
  action: string;
  actorId: string;
  artifact: Artifact;
  createdTimestamp: number;
  initiativeId: string;
  priorityId?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: any;
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
  priorityId: -1,
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
