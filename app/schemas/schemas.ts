import { z } from 'zod';

export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

export const initiativeSchema = z.object({
  label: z.string().optional(),
});

export const activitySchema = z.object({
  action: z.string(),
  actorId: z.string(),
  date: z.number(),
  type: z.string(),
});

export interface InitiativeData {
  id: string;
  label?: string;
}

export interface ActivityData {
  id: string;
  action: string;
  actorId: string;
  type: string;
  date: number;
  initiative: string;
}

export interface SettingsData {
  customerId: number;
  feeds: {
    secret?: string | undefined;
    feedId: string;
    type: string;
    clientId: string;
  }[];
  initiatives: InitiativeData[];
}
