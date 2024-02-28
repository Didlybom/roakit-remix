import firebase from 'firebase/compat/app';
import { z } from 'zod';

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

  // comment_created
  comment: z
    .object({
      author: zuser,
      body: z.string(),
    })
    .optional(),
});

export enum JiraEventType {
  IssueCreated = 'jira:issue_created',
  CommentCreated = 'comment_created',
}

export interface JiraRow {
  id: string;
  timestamp: number;
  project?: { key: string; name: string };
  author?: { name?: string };
  ref?: { label: string; url: string };
  priority?: { id: number; name: string };
  activity?: {
    title?: string;
    created?: string;
    description?: string;
    comment?: string;
  };
}

export const jiraRows = (snapshot: firebase.firestore.QuerySnapshot): JiraRow[] => {
  const rows: JiraRow[] = [];
  snapshot.forEach(doc => {
    const docData = doc.data();
    const props = jiraEventSchema.safeParse(docData.properties);
    if (!props.success) {
      throw Error('Failed to parse Jira events. ' + props.error.message);
    }
    const data = props.data;
    let author;
    if (docData.name === JiraEventType.IssueCreated) {
      author = { name: data.issue?.fields?.creator?.displayName };
    } else if (docData.name === JiraEventType.CommentCreated) {
      author = { name: data.comment?.author.displayName };
    }
    const row = {
      id: doc.id,
      timestamp: docData.eventTimestamp as number,
      author,
      project: { ...data.issue.fields.project },
      ref: { label: data.issue.key, url: data.issue.self },
      priority: { id: +data.issue.fields.priority.id, name: data.issue.fields.priority.name },
      activity: {
        title: data.issue.fields.summary,
        description: data.issue.fields.description ?? undefined,
        comment: data.comment?.body,
      },
    };
    rows.push(row);
  });
  return rows;
};
