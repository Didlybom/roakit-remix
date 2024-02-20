import { z } from 'zod';

export interface GitHubRow {
  id: string;
  timestamp: number;
  repositoryName?: string;
  author?: { name?: string; url?: string };
  ref?: { label?: string; url?: string };
  activity?: {
    title?: string;
    created?: string;
    changedFiles?: number;
    comments?: number;
    commits?: number;
    commitMessages?: string[];
  };
}

export const gitHubEventSchema = z.object({
  repository: z.object({ name: z.string() }).optional(),
  sender: z.object({ login: z.string(), html_url: z.string().optional() }).optional(),

  // pull_request
  pull_request: z
    .object({
      title: z.string(),
      created_at: z.string(),
      changed_files: z.number(),
      deletions: z.number(),
      comments: z.number(),
      commits: z.number(),
      head: z.object({ ref: z.string() }),
      html_url: z.string().optional(),
    })
    .optional(),

  // push
  commits: z.object({ message: z.string() }).array().optional(),

  // release
  action: z.string().optional(),
  release: z.object({ body: z.string() }).optional(),
});
