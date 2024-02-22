import { z } from 'zod';

export interface GitHubRow {
  id: string;
  timestamp: number;
  repositoryName?: string;
  author?: { name: string; url: string };
  ref?: { label: string; url: string };
  activity?: {
    title?: string;
    created?: string;
    changedFiles?: number;
    comments?: number;
    commits?: number;
    commitMessages?: string[];
    pullRequestComment?: { comment: string; url: string };
  };
}

const zuser = z.object({ login: z.string(), html_url: z.string() });

export const gitHubEventSchema = z.object({
  repository: z.object({ name: z.string() }).optional(),
  sender: zuser.optional(),

  // pull_request
  pull_request: z
    .object({
      title: z.string(),
      assignee: zuser.optional().nullable(),
      created_at: z.string(),
      changed_files: z.number().optional(),
      deletions: z.number().optional(),
      comments: z.number().optional(),
      commits: z.number().optional(),
      head: z.object({ ref: z.string() }),
      html_url: z.string(),
    })
    .optional(),

  // pull_request_review_comment
  comment: z.object({ body: z.string(), html_url: z.string(), user: zuser }).optional(),

  // push
  commits: z.object({ message: z.string() }).array().optional(),

  // release
  action: z.string().optional(),
  release: z.object({ body: z.string() }).optional(),
});
