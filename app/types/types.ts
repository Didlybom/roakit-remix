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

export type Artifact = 'code' | 'codeOrg' | 'task' | 'taskOrg' | 'doc' | 'docOrg';

export type Phase = 'design' | 'dev' | 'test' | 'deploy' | 'stabilize' | 'ops';

export const PHASES = new Map<string, { sortOrder: number; label: string }>([
  ['design', { sortOrder: 1, label: 'Design' }],
  ['dev', { sortOrder: 2, label: 'Develop' }],
  ['test', { sortOrder: 3, label: 'Test' }],
  ['deploy', { sortOrder: 4, label: 'Deploy' }],
  ['stabilize', { sortOrder: 5, label: 'Stabilize' }],
  ['ops', { sortOrder: 6, label: 'Operate' }],
]);

export const CUSTOM_EVENT = 'custom';

export type CustomerSettings = {
  name?: string;
  ticketBaseUrl?: string;
};

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
    activities: ArtifactCount;
  };
  countersLastUpdated?: number;
};

export type InitiativeRecord = Record<Initiative['id'], Omit<Initiative, 'id'>>;

export type Account = {
  id: string;
  type: string;
  name?: string;
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
  accounts?: Account[];
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

export type ActivityChangeLog = {
  field: string;
  oldValue?: string;
  newValue?: string;
  oldId?: string;
  newId?: string;
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
  oldParent?: { id: string; title: string };
  newParent?: { id: string; title: string };
  pullRequest?: { ref: string; codeAction: string; title: string; uri?: string };
  pullRequestComment?: { body: string; uri?: string };
  pullRequestIssue?: { title: string; uri?: string };
  commits?: { message: string; url?: string }[];
  comment?: {
    id: string;
    body: string;
    uri?: string;
    parent?: { type: string; title: string; uri?: string };
  };
  comments?: {
    id: string;
    body: string;
    uri?: string;
    parent?: { type: string; title: string; uri?: string };
  }[];
  label?: {
    name: string;
    contentType: string;
    contentUri?: string;
    uri?: string;
    spaceKey?: string;
  };
  changeLog?: ActivityChangeLog[];
};

export type Reactions = { like: Record<Identity['id'], boolean> };

export type Activity = {
  id: string;
  action: string;
  eventType?: string;
  event?: string;
  actorId?: string;
  artifact: Artifact;
  createdTimestamp: number;
  timestamp: number;
  initiativeId: string;
  launchItemId?: string | null;
  effort?: number | null;
  phase?: Phase | null;
  priority?: number;
  description?: string | null;
  metadata?: ActivityMetadata;
  reactions?: Reactions;
  note?: string;
  objectId?: string; // for debugging
  combinedIds?: string[];
};

export type ActivityRecord = Record<Activity['id'], Activity>;

export type ArtifactCount = {
  code: number;
  codeOrg: number;
  task: number;
  taskOrg: number;
  doc: number;
  docOrg: number;
};

export type PhaseCount = {
  design: number;
  dev: number;
  test: number;
  deploy: number;
  stabilize: number;
  ops: number;
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
