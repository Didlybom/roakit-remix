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
      id: z.string(),
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
  aiSummary: z.string().optional(),
  userSummary: z.string().optional(),
  aiTeamSummary: z.string().optional(),
  userTeamSummary: z.string().optional(),
  createdTimestamp: z.number().optional(),
  lastUpdatedTimestamp: z.number().optional(),
});