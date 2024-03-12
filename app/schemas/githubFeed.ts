import firebase from 'firebase/compat/app';
import { z } from 'zod';
import { ParseError } from '../utils/errorUtils';
import { capitalizeAndUseSpaces, findJiraProjects } from '../utils/stringUtils';
import { ActorData } from './schemas';

const zuser = z.object({ login: z.string(), html_url: z.string() });

export const gitHubEventSchema = z.object({
  repository: z.object({ name: z.string() }).optional(),
  sender: zuser.optional(),
  action: z.string().optional(),

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
  release: z.object({ body: z.string() }).optional(),
});

const pullRequestIgnoreActions = [
  'synchronize',
  'auto_merge_enabled',
  'labeled',
  'review_requested',
];

export enum GitHubEventType {
  PullRequest = 'pull_request',
  PullRequestReviewComment = 'pull_request_review_comment',
  Push = 'push',
  Release = 'release',
}

export interface GitHubRow {
  id: string;
  date: Date;
  repositoryName?: string;
  actor?: ActorData;
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

export const rowsByAuthor: Record<string, { url: string | undefined; rows: GitHubRow[] }> = {}; // all the events aggregated by author
export const rowsByJira: Record<string, GitHubRow[]> = {}; // all the events aggregated by JIRA project

export const gitHubRows = (snapshot: firebase.firestore.QuerySnapshot): GitHubRow[] => {
  const rows: GitHubRow[] = [];
  snapshot.forEach(doc => {
    const docData = doc.data();
    const props = gitHubEventSchema.safeParse(docData.properties);
    if (!props.success) {
      throw new ParseError('Failed to parse GitHub events. ' + props.error.message);
    }
    const data = props.data;
    if (data.release && data.action !== 'released') {
      return;
    }
    if (data.pull_request && data.action && pullRequestIgnoreActions.includes(data.action)) {
      return;
    }
    let title;
    if (data.pull_request) {
      title =
        data.comment ?
          data.pull_request.title
        : capitalizeAndUseSpaces(data.action) + ' ' + data.pull_request.title;
    } else if (data.commits) {
      title = data.commits[0]?.message;
    } else {
      title = data.release?.body;
    }
    let actor: ActorData | undefined;
    if (docData.name === GitHubEventType.PullRequest && data.pull_request?.assignee) {
      actor = {
        id: '',
        name: data.pull_request.assignee.login,
        url: data.pull_request.assignee.html_url,
      };
    } else if (docData.name === GitHubEventType.PullRequestReviewComment && data.comment?.user) {
      actor = {
        id: '',
        name: data.comment.user.login,
        url: data.comment.user.html_url,
      };
    }
    if (!actor) {
      actor =
        data.sender ?
          { id: '', name: data.sender.login, url: data.sender.html_url }
        : { id: '', name: 'unknown' };
    }
    const row = {
      id: doc.id,
      date: new Date(docData.eventTimestamp as number),
      repositoryName: data.repository?.name,
      actor,
      ref:
        data.pull_request?.head.ref ?
          {
            label: data.pull_request.head.ref,
            url: data.comment?.html_url ?? data.pull_request.html_url,
          }
        : undefined,
      activity: {
        title,
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
    if (row.actor?.name) {
      if (!(row.actor.name in rowsByAuthor)) {
        rowsByAuthor[row.actor.name] = { url: row.actor.url, rows: [] };
      }
      if (!rowsByAuthor[row.actor.name].rows.find(r => r.id === row.id)) {
        rowsByAuthor[row.actor.name].rows.push(row);
      }
    }
    const jiraProjects = findJiraProjects(row.activity.title + ' ' + row.ref?.label);
    if (jiraProjects.length) {
      jiraProjects.forEach(jiraProject => {
        if (!(jiraProject in rowsByJira)) {
          rowsByJira[jiraProject] = [];
        }
        if (!rowsByJira[jiraProject].find(r => r.id === row.id)) {
          rowsByJira[jiraProject].push(row);
        }
      });
    }
    rows.push(row);
  });
  return rows;
};
