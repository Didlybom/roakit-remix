import { z } from 'zod';

export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

export const actorSchema = z.object({
  name: z.string().optional(),
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

export const ACTIVITY_TYPES = ['code', 'codeOrg', 'task', 'taskOrg'] as const;

export const activitySchema = z.object({
  action: z.string(),
  actorId: z.string(),
  date: z.number(),
  type: z.enum(ACTIVITY_TYPES),
  initiativeId: z.string(),
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

export type ActivityType = 'code' | 'codeOrg' | 'task' | 'taskOrg';

export interface ActivityData {
  id: string;
  action: string;
  actorId: string;
  type: ActivityType;
  date: number;
  initiativeId: string;
}

export type ActivityMap = Record<ActivityData['id'], Omit<ActivityData, 'id'>>;

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
  type: 'code',
  date: -1,
  initiativeId: '-1',
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
