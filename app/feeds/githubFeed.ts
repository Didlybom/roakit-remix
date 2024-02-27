import firebase from 'firebase/compat/app';
import { z } from 'zod';
import { findJiraProjects } from '~/utils/stringUtils';

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

export enum GitHubEventType {
  PullRequest = 'pull_request',
  PullRequestReviewComment = 'pull_request_review_comment',
  Push = 'push',
  Release = 'release',
}

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

export let rowsByAuthor: Record<string, { url: string | undefined; rows: GitHubRow[] }> | null; // all the events aggregated by author
export let rowsByJira: Record<string, GitHubRow[]> | null; // all the events aggregated by JIRA project

export const gitHubRows = (snapshot: firebase.firestore.QuerySnapshot): GitHubRow[] => {
  const rows: GitHubRow[] = [];
  snapshot.forEach(doc => {
    const docData = doc.data();
    const props = gitHubEventSchema.safeParse(docData.properties);
    if (!props.success) {
      throw Error('Failed to parse GitHub events. ' + props.error.message);
    }
    const data = props.data;
    if (data.release && data.action !== 'released') {
      return;
    }
    let author;
    if (docData.name === GitHubEventType.PullRequest && data.pull_request?.assignee) {
      author = { name: data.pull_request.assignee.login, url: data.pull_request.assignee.html_url };
    } else if (docData.name === GitHubEventType.PullRequestReviewComment && data.comment?.user) {
      author = {
        name: data.comment.user.login,
        url: data.comment.user.html_url,
      };
    }
    if (!author) {
      author = data.sender ? { name: data.sender.login, url: data.sender.html_url } : undefined;
    }
    const row = {
      id: doc.id,
      timestamp: docData.eventTimestamp as number,
      repositoryName: data.repository?.name,
      author,
      ref:
        data.pull_request?.head.ref ?
          {
            label: data.pull_request.head.ref,
            url: data.comment?.html_url ?? data.pull_request.html_url,
          }
        : undefined,
      activity: {
        title:
          data.pull_request?.title ??
          (data.commits ? data.commits[0]?.message : undefined) ??
          data.release?.body,
        created: data.pull_request?.created_at,
        changedFiles: data.pull_request?.changed_files,
        comments: data.pull_request?.comments,
        commits: data.pull_request?.commits ?? data.commits?.length,
        commitMessages: data.commits?.map(c => c.message),
        ...(data.comment && {
          pullRequestComment: { comment: data.comment.body, url: data.comment.html_url },
        }),
      },
    };
    if (row.author?.name) {
      if (!rowsByAuthor) {
        rowsByAuthor = {};
      }
      if (!(row.author.name in rowsByAuthor)) {
        rowsByAuthor[row.author.name] = { url: row.author.url, rows: [] };
      }
      if (!rowsByAuthor[row.author.name].rows.find(r => r.id === row.id)) {
        rowsByAuthor[row.author.name].rows.push(row);
      }
    }
    const jiraProjects = findJiraProjects(row.activity.title + ' ' + row.ref?.label);
    if (jiraProjects.length) {
      if (!rowsByJira) {
        rowsByJira = {};
      }
      jiraProjects.forEach(jiraProject => {
        if (!(jiraProject in rowsByJira!)) {
          rowsByJira![jiraProject] = [];
        }
        if (!rowsByJira![jiraProject].find(r => r.id === row.id)) {
          rowsByJira![jiraProject].push(row);
        }
      });
    }
    rows.push(row);
  });
  return rows;
};
