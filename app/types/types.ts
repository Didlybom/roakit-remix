import type { Role } from '../utils/rbac';

export const GITHUB_FEED_TYPE = 'github';
export const JIRA_FEED_TYPE = 'jira';
export const CONFLUENCE_FEED_TYPE = 'confluence';

export type FeedType = 'github' | 'jira' | 'confluence';

export const GITHUB_FEED_ID = '1';
export const JIRA_FEED_ID = '2';
export const CONFLUENCE_FEED_ID = '3';

export const FEED_TYPES = [
  { type: GITHUB_FEED_TYPE, id: GITHUB_FEED_ID, label: 'GitHub' },
  { type: JIRA_FEED_TYPE, id: JIRA_FEED_ID, label: 'Jira' },
  { type: CONFLUENCE_FEED_TYPE, id: CONFLUENCE_FEED_ID, label: 'Confluence' },
];

export type Initiative = {
  id: string;
  key: string;
  label?: string;
  tags?: string[] | null;
  color?: string | null;
  reference?: string;
  url?: string;
  activityMapper?: string;
  counters?: {
    activities: ActivityCount;
  };
  countersLastUpdated?: number;
};

export type InitiativeRecord = Record<Initiative['id'], Omit<Initiative, 'id'>>;

export type Account = {
  id: string;
  type: string;
  name: string;
  url?: string;
  createdTimestamp?: number;
};
export type AccountMap = Map<Account['id'], Omit<Account, 'id'>>;

export interface Identity {
  id: string;
  email?: string;
  displayName?: string;
  managerId?: string;
  reportIds?: string[];
  user?: { id: string; role?: Role };
  accounts: { feedId: number; type: string; id: Account['id']; name?: string; url?: string }[];
}

export const displayName = (id: Identity) => id.displayName || id.email || id.id;

export type AccountToIdentityRecord = Record<Account['id'], Identity['id']>;

export type Actor = {
  id: string;
  name: string;
  email?: string;
  accounts?: { id: string; type: string; url?: string }[];
};
export type ActorRecord = Record<Actor['id'], Omit<Actor, 'id'>>;

export type Ticket = {
  key: string;
  id?: string;
  summary?: string;
  uri?: string;
  priority?: number;
  project?: {
    id?: string;
    key: string;
    name?: string;
    uri?: string;
  };
  lastUpdatedTimestamp?: number;
};

export type TicketRecord = Record<Ticket['key'], Ticket['priority']>;

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg' | 'doc' | 'docOrg';

export type ActivityChangeLog = {
  field: string;
  oldValue?: string;
  newValue?: string;
};

export type ActivityMetadata = {
  codeAction?: string | string[];
  issue?: { key: string; summary?: string; uri?: string; project?: { id: string } };
  attachment?: { filename: string; mimeType?: string; uri?: string };
  attachments?: {
    files: { filename: string; uri?: string }[];
    parent?: { id: string; type: string; title: string; uri?: string };
  };
  sprint?: { name: string; state: string };
  worklog?: unknown;
  space?: { title: string; uri?: string };
  page?: { id: string; title: string; version?: string; uri?: string };
  pullRequest?: { ref: string; codeAction: string; title: string; uri?: string };
  pullRequestComment?: { body: string; uri?: string };
  commits?: { message: string; url?: string }[];
  comment?: {
    id: string;
    body: string;
    uri?: string;
    parent?: { type: string; title: string; uri?: string };
  };
  label?: {
    name: string;
    contentType: string;
    contentUri?: string;
    uri?: string;
    spaceKey?: string;
  };
  changeLog?: ActivityChangeLog[];
};

export type Activity = {
  id: string;
  action: string;
  eventType?: string;
  event?: string;
  actorId?: string;
  artifact: Artifact;
  timestamp: number;
  initiativeId: string;
  launchItemId?: string;
  effort?: number | null;
  priority?: number;
  metadata?: ActivityMetadata;
  note?: string;
  objectId?: string; // for debugging
  combinedIds?: string[];
};

export type ActivityRecord = Record<Activity['id'], Activity>;

export type ActivityCount = {
  code: number;
  codeOrg: number;
  task: number;
  taskOrg: number;
  doc: number;
  docOrg: number;
};

export type Settings = {
  feeds: {
    secret?: string | undefined;
    feedId: string;
    type: string;
    clientId: string;
    bannedEvents?: Record<string, boolean>;
    bannedAccounts?: Record<string, boolean>;
  }[];
  initiatives: Initiative[];
};

export type Summary = {
  identityId: string;
  aiSummary?: string;
  userSummary?: string;
  aiTeamSummary?: string;
  userTeamSummary?: string;
};

export type DaySummaries = Record<string, Summary>;
