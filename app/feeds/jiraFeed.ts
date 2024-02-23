import { z } from 'zod';

export interface JiraRow {
  id: string;
  timestamp: number;
  project?: { key: string; name: string };
  author?: { name?: string };
  ref?: { label: string; url: string };
  priority?: string;
  activity?: {
    title?: string;
    created?: string;
    description?: string;
    comment?: string;
  };
}

const zuser = z.object({ accountId: z.string(), displayName: z.string() });

export const jiraEventSchema = z.object({
  // jira:issue_created
  issue: z.object({
    key: z.string(),
    self: z.string(),
    fields: z.object({
      created: z.string().optional(),
      creator: zuser.optional(),
      summary: z.string(),
      description: z.string().optional().nullable(),
      priority: z.object({
        id: z.string(),
        name: z.string(),
      }),
      project: z.object({
        key: z.string(),
        name: z.string(),
      }),
    }),
  }),

  //comment_created
  comment: z
    .object({
      author: zuser,
      body: z.string(),
    })
    .optional(),
});
