import { z } from 'zod';
import { ParseError } from '../utils/errorUtils';
import { Roles } from '../utils/rbac';

export const bannedRecordSchema = z.record(z.string(), z.boolean());
export const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
  bannedEvents: bannedRecordSchema.optional(),
  bannedAccounts: bannedRecordSchema.optional(),
});

export const initiativeSchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  tags: z.string().array().nullable().optional(),
  color: z.string().nullable().optional(),
  reference: z.string().optional(),
  url: z.string().optional(),
  activityMapper: z.string().optional(),
  counters: z
    .object({
      activities: z.object({
        code: z.number().catch(0),
        codeOrg: z.number().catch(0),
        task: z.number().catch(0),
        taskOrg: z.number().catch(0),
        doc: z.number().catch(0),
        docOrg: z.number().catch(0),
      }),
    })
    .optional(),
  countersLastUpdated: z.number().optional(),
});
export type InitiativeType = z.infer<typeof initiativeSchema>;

export const accountSchema = z.object({
  createdDate: z.number().optional(),
  accountName: z.string().optional(),
  accountUri: z.string().optional(),
});
export type AccountType = z.infer<typeof accountSchema>;

export const customerSchema = z.object({
  name: z.string().optional(),
  ticketBaseUrl: z.string().optional(),
});
export type CustomerType = z.infer<typeof customerSchema>;

export const userSchema = z.object({
  email: z.string(),
  customerId: z.number(),
  role: z.enum(Roles).optional(),
});
export type UserType = z.infer<typeof userSchema>;

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
export type IdentityType = z.infer<typeof identitySchema>;

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
export type TicketType = z.infer<typeof ticketSchema>;

// this needs to be updated and deployed before ingestion adds new artifacts
export const ARTIFACTS = ['code', 'codeOrg', 'task', 'taskOrg', 'doc', 'docOrg'] as const;

export const activitySchema = z.object({
  action: z.string(),
  eventType: z.string().optional(),
  event: z.string().optional(),
  actorAccountId: z.string().optional(),
  createdTimestamp: z.number(),
  eventTimestamp: z.number().optional(),
  artifact: z.string(), //z.enum(ARTIFACTS), // don't use an enum so ingestion backend can be deployed with new artifacts before updating frontend
  initiative: z.string(),
  launchItemId: z.string().optional(),
  phase: z.string().nullable().optional(),
  effort: z.number().nullable().optional(),
  priority: z.number().optional(),
  description: z.string().nullable().optional(),
  metadata: z.any(), // we only strongly typed the parsed objects for now, see schemas.ts#ActivityMetadata
  note: z.string().optional(),
  objectId: z.string().optional(), // for debugging
});
export type ActivityType = z.infer<typeof activitySchema>;

export const summarySchema = z.object({
  identityId: z.string(),
  aiSummary: z.string().optional(),
  userSummary: z.string().optional(),
  aiTeamSummary: z.string().optional(),
  userTeamSummary: z.string().optional(),
  hoursSpent: z.number().optional(),
  createdTimestamp: z.number().optional(),
  lastUpdatedTimestamp: z.number().optional(),
});
export type SummaryType = z.infer<typeof summarySchema>;

export const parse = <T>(
  schema: z.AnyZodObject,
  data: FirebaseFirestore.DocumentData,
  dataName: string
): T => {
  const props = schema.safeParse(data);
  if (!props.success) {
    throw new ParseError(`Failed to parse ${dataName}. ${props.error.message}`);
  }
  return props.data as T;
};
