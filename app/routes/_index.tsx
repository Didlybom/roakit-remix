import GitHubIcon from '@mui/icons-material/GitHub';
import Timeline from '@mui/lab/Timeline';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import {
  Alert,
  Box,
  Button,
  Divider,
  IconButton,
  LinearProgress,
  Link,
  List,
  ListItem,
  ListItemText,
  Popover,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { startOfToday } from 'date-fns/startOfToday';
import { subWeeks } from 'date-fns/subWeeks';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import pluralize from 'pluralize';
import { Fragment, SyntheticEvent, useEffect, useMemo, useState } from 'react';
import { LinkIt } from 'react-linkify-it';
import { z } from 'zod';
import { firestore as firestoreClient } from '~/firebase.client';
import Header from '~/src/Header';
import TabPanel from '~/src/TabPanel';
import { formatDayMonth } from '~/utils/dateUtils';
import { errMsg } from '~/utils/errorUtils';
import { SessionData, getSessionData } from '~/utils/sessionCookie.server';
import {
  JIRA_REGEXP,
  caseInsensitiveSort,
  findJiraTickets,
  removeSpaces,
} from '~/utils/stringUtils';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

enum EventType {
  PullRequest = 'pull_request',
  Push = 'push',
  Release = 'release',
}

enum DateFilter {
  All = 'All',
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  OneDay = 'OneDay',
}

const dateFilters: Record<DateFilter, string> = {
  [DateFilter.All]: 'all',
  [DateFilter.TwoWeeks]: '2 weeks',
  [DateFilter.OneWeek]: '1 week',
  [DateFilter.OneDay]: '1 day',
};

const dateFilterToStartDate = (dateFilter: DateFilter) => {
  switch (dateFilter) {
    case DateFilter.TwoWeeks:
      return subWeeks(startOfToday(), 2).getTime();
    case DateFilter.OneWeek:
      return subWeeks(startOfToday(), 1).getTime();
    case DateFilter.OneDay:
      return startOfToday().getTime();
    default:
      return null;
  }
};

interface GitHubRow {
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

const gitHubEventSchema = z.object({
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

let gitHubRowsByAuthor: Record<string, { url: string | undefined; rows: GitHubRow[] }> | null; // all the events aggregated by author
let gitHubRowsByJira: Record<string, GitHubRow[]> | null; // all the events aggregated by JIRA project

const githubRows = (snapshot: firebase.firestore.QuerySnapshot): GitHubRow[] => {
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
    const author = { name: data.sender?.login, url: data.sender?.html_url };
    const row = {
      id: doc.id,
      timestamp: docData.eventTimestamp as number,
      repositoryName: data.repository?.name,
      author,
      ref: { label: data.pull_request?.head.ref, url: data.pull_request?.html_url },
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
      },
    };
    if (author?.name) {
      if (!gitHubRowsByAuthor) {
        gitHubRowsByAuthor = {};
      }
      if (!(author.name in gitHubRowsByAuthor)) {
        gitHubRowsByAuthor[author.name] = { url: author.url, rows: [] };
      }
      if (!gitHubRowsByAuthor[author.name].rows.find(r => r.id === row.id)) {
        gitHubRowsByAuthor[author.name].rows.push(row);
      }
    }
    const jiraTickets = findJiraTickets(row.activity.title + ' ' + row.ref.label);
    if (jiraTickets.length) {
      if (!gitHubRowsByJira) {
        gitHubRowsByJira = {};
      }
      jiraTickets.forEach(jiraTicket => {
        if (!(jiraTicket in gitHubRowsByJira!)) {
          gitHubRowsByJira![jiraTicket] = [];
        }
        if (!gitHubRowsByJira![jiraTicket].find(r => r.id === row.id)) {
          gitHubRowsByJira![jiraTicket].push(row);
        }
      });
    }
    rows.push(row);
  });
  return rows;
};

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const sessionData = useLoaderData<typeof loader>();
  const [tabValue, setTabValue] = useState(0);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DateFilter.All);
  const [showBy, setShowBy] = useState<'all' | 'author' | 'jira'>('all');
  const [scrollToAuthor, setScrollToAuthor] = useState<string | undefined>(undefined);
  const [scrollToJira, setScrollToJira] = useState<string | undefined>(undefined);
  const [popoverElement, setPopoverElement] = useState<HTMLElement | null>(null);
  const [popoverContent, setPopoverContent] = useState<JSX.Element | undefined>(undefined);

  const [gitHubPRs, setGithubPRs] = useState<GitHubRow[]>([]);
  const [gitHubPushes, setGithubPushes] = useState<GitHubRow[]>([]);
  const [gitHubReleases, setGithubReleases] = useState<GitHubRow[]>([]);

  const [gitHubError, setGitHubError] = useState('');

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const linkifyJira = (content: string | JSX.Element | JSX.Element[] | undefined) => (
    <LinkIt
      component={(jira: string) => (
        <Link
          key={jira} // FIXME we should use key param from the callback but for soem reasons that makes it requiring 2 clicks
          onClick={() => {
            setShowBy('jira');
            setScrollToJira(jira);
            setPopoverElement(null);
          }}
          sx={{ cursor: 'pointer' }}
        >
          {jira}
        </Link>
      )}
      regex={JIRA_REGEXP}
    >
      {content}
    </LinkIt>
  );

  const gitHubColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'timestamp',
        headerName: 'Date',
        type: 'dateTime',
        valueGetter: params => new Date(params.value as number),
        valueFormatter: params => formatDayMonth(params.value as Date),
        width: 100,
      },
      { field: 'repositoryName', headerName: 'Repository', width: 150 },
      {
        field: 'author',
        headerName: 'Author',
        width: 150,
        sortComparator: (a: GitHubRow['author'], b: GitHubRow['author']) =>
          (a?.name ?? '').localeCompare(b?.name ?? ''),
        renderCell: params => {
          const fields = params.value as GitHubRow['author'];
          return fields?.url ?
              <Link
                onClick={() => {
                  setShowBy('author');
                  setScrollToAuthor(fields.name);
                }}
                sx={{ cursor: 'pointer' }}
              >
                {fields.name}
              </Link>
            : fields?.name;
        },
      },
      {
        field: 'ref',
        headerName: 'Reference',
        width: 300,
        sortComparator: (a: GitHubRow['ref'], b: GitHubRow['ref']) =>
          (a?.label ?? '').localeCompare(b?.label ?? ''),
        renderCell: params => {
          const fields = params.value as GitHubRow['ref'];
          return fields?.url ? <Link href={fields.url}>{fields.label}</Link> : fields?.label;
        },
      },
      {
        field: 'activity',
        headerName: 'Activity',
        minWidth: 300,
        flex: 1,
        sortComparator: (a: GitHubRow['activity'], b: GitHubRow['activity']) =>
          (a?.title ?? '').localeCompare(b?.title ?? ''),
        renderCell: params => {
          const fields = params.value as GitHubRow['activity'];
          const title = fields?.title ?? '';
          let activity = '';
          if (fields) {
            if (fields.created) {
              activity += `Created ${formatDayMonth(new Date(fields.created))}, `;
            }
            if (fields.changedFiles) {
              activity += `${fields.changedFiles} changed ${pluralize('file', fields.changedFiles)}, `;
            }
            if (fields.comments) {
              activity += `${fields.comments} ${pluralize('comment', fields.comments)}, `;
            }
            if (fields.commits && !fields.commitMessages) {
              activity += `${fields.commits} ${pluralize('commit', fields.commits)}, `;
            }
            if (fields.commitMessages && fields.commitMessages.length > 1) {
              activity += `and ${fields.commitMessages.length - 1} more ${pluralize('commit', fields.commitMessages.length - 1)}, `;
            }
          }
          if (activity) {
            activity = activity.slice(0, -2);
          }
          return (
            <Stack>
              <Typography variant="body2">{linkifyJira(title)}</Typography>
              {!fields?.commitMessages?.length ?
                <Typography variant="caption">{activity}</Typography>
              : <Link
                  variant="caption"
                  onClick={e => {
                    setPopoverContent(
                      <List dense={true}>
                        {linkifyJira(
                          fields.commitMessages?.map((message, i) => (
                            <ListItem key={i}>
                              <ListItemText>{message}</ListItemText>
                            </ListItem>
                          ))
                        )}
                      </List>
                    );
                    setPopoverElement(e.currentTarget);
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  {activity}
                </Link>
              }
            </Stack>
          );
        },
      },
    ],
    []
  );

  const gitHubPushesColumns = useMemo<GridColDef[]>(() => {
    const gitHubPushesColumns = [...gitHubColumns];
    gitHubPushesColumns.splice(3, 1); // remove Reference
    return gitHubPushesColumns;
  }, [gitHubColumns]);

  const gitHubByAuthorColumns = useMemo<GridColDef[]>(() => {
    const gitHubByAuthorColumns = [...gitHubPushesColumns];
    gitHubByAuthorColumns.splice(2, 1); // remove Author
    return gitHubByAuthorColumns;
  }, [gitHubPushesColumns]);

  const authorElementId = (author: string) => `AUTHOR-${removeSpaces(author)}`;
  const jiraElementId = (jira: string) => `JIRA-${removeSpaces(jira)}`;

  // Firestore listeners
  useEffect(() => {
    const setGitHubRows = (type: EventType, querySnapshot: firebase.firestore.QuerySnapshot) => {
      try {
        switch (type) {
          case EventType.PullRequest:
            setGithubPRs(githubRows(querySnapshot));
            break;
          case EventType.Push:
            setGithubPushes(githubRows(querySnapshot));
            break;
          case EventType.Release:
            setGithubReleases(githubRows(querySnapshot));
            break;
        }
      } catch (e: unknown) {
        setGitHubError(errMsg(e, `Error parsing GitHub ${type} events`));
      }
    };
    const unsubscribe: Record<string, () => void> = {};
    Object.values(EventType).map((type: EventType) => {
      let query = firestoreClient
        .collection(
          `customers/${sessionData.customerId}/feeds/1/events/${type}/instances` // FIXME feedId
        )
        .orderBy('eventTimestamp', 'desc')
        .limit(1000); // FIXME limit
      const startDate = dateFilterToStartDate(dateFilter);
      if (startDate) {
        query = query.where('eventTimestamp', '>=', startDate);
      }
      unsubscribe[type] = query.onSnapshot(
        snapshot => setGitHubRows(type, snapshot),
        error => setGitHubError(error.message)
      );
    });
    return () => Object.keys(unsubscribe).forEach(k => unsubscribe[k]());
  }, [dateFilter, sessionData.customerId]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToAuthor) {
      const element = document.getElementById(authorElementId(scrollToAuthor));
      setScrollToAuthor(undefined);
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 1);
      }
    }
  }, [scrollToAuthor]);

  useEffect(() => {
    if (scrollToJira) {
      const element = document.getElementById(jiraElementId(scrollToJira));
      setScrollToJira(undefined);
      if (element) {
        setTimeout(() => element.scrollIntoView({ behavior: 'smooth', block: 'start' }), 1);
      }
    }
  }, [scrollToJira]);

  const filteredGitHubRowsByAuthor = gitHubRowsByAuthor;
  const filteredGitHubRowsByJira = gitHubRowsByJira;
  if (dateFilter !== DateFilter.All && filteredGitHubRowsByAuthor) {
    const startDate = dateFilterToStartDate(dateFilter)!;
    Object.keys(filteredGitHubRowsByAuthor).forEach(author => {
      filteredGitHubRowsByAuthor[author].rows = filteredGitHubRowsByAuthor[author].rows.filter(
        row => row.timestamp >= startDate
      );
      if (filteredGitHubRowsByAuthor[author].rows.length === 0) {
        delete filteredGitHubRowsByAuthor[author];
      }
    });
  }
  if (dateFilter !== DateFilter.All && filteredGitHubRowsByJira) {
    const startDate = dateFilterToStartDate(dateFilter)!;
    Object.keys(filteredGitHubRowsByJira).forEach(jira => {
      filteredGitHubRowsByJira[jira] = filteredGitHubRowsByJira[jira].filter(
        row => row.timestamp >= startDate
      );
      if (filteredGitHubRowsByJira[jira].length === 0) {
        delete filteredGitHubRowsByJira[jira];
      }
    });
  }

  const dataGridCommonProps = {
    rowHeight: 75,
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    initialState: {
      sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' as GridSortDirection }] },
    },
  };

  return (
    <Fragment>
      <Header isLoggedIn={sessionData.isLoggedIn} />
      <Popover
        id={popoverElement ? 'popover' : undefined}
        open={!!popoverElement}
        anchorEl={popoverElement}
        onClose={() => setPopoverElement(null)}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'left',
        }}
      >
        <Typography sx={{ p: 2 }}>{popoverContent}</Typography>
      </Popover>
      {sessionData.isLoggedIn && (
        <Stack sx={{ mt: 3 }}>
          <Stack direction="row">
            <Button disabled={showBy === 'all'} onClick={() => setShowBy('all')}>
              All GitHub Activity
            </Button>
            <Divider orientation="vertical" variant="middle" flexItem />
            <Button disabled={showBy === 'author'} onClick={() => setShowBy('author')}>
              By Author
            </Button>
            <Divider orientation="vertical" variant="middle" flexItem />
            <Button disabled={showBy === 'jira'} onClick={() => setShowBy('jira')}>
              By JIRA
            </Button>
          </Stack>
          <Grid container direction={{ xs: 'column', md: 'row' }}>
            <Grid>
              <Timeline
                sx={{
                  rotate: { xs: '-90deg', md: 'none' },
                  maxHeight: 100,
                  maxWidth: 120,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  [`& .${timelineItemClasses.root}:before`]: { flex: 0, padding: 0 },
                }}
              >
                {Object.keys(dateFilters).map(date => (
                  <TimelineItem key={date} sx={{ minHeight: 50 }}>
                    <TimelineSeparator>
                      <TimelineDot />
                      {(date as DateFilter) !== DateFilter.OneDay && <TimelineConnector />}
                    </TimelineSeparator>
                    <TimelineContent sx={{ pt: '3px' }}>
                      <Button
                        size="small"
                        disabled={dateFilter === (date as DateFilter)}
                        onClick={() => setDateFilter(date as DateFilter)}
                        sx={{ justifyContent: 'left' }}
                      >
                        <Box sx={{ whiteSpace: 'nowrap' }}>{dateFilters[date as DateFilter]}</Box>
                      </Button>
                    </TimelineContent>
                  </TimelineItem>
                ))}
              </Timeline>
            </Grid>
            <Grid sx={{ flex: 1 }}>
              {showBy === 'all' && (
                <Box>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
                    <Tabs value={tabValue} onChange={handleTabChange} aria-label="Activities">
                      <Tab label="Pull Requests" id="tab-0" />
                      <Tab label="Pushes" id="tab-1" />
                      <Tab label="Releases" id="tab-2" />
                    </Tabs>
                  </Box>
                  {(!gitHubPRs.length || !gitHubPushes.length) && (
                    <LinearProgress sx={{ mt: 5, mb: 5 }} />
                  )}
                  <TabPanel value={tabValue} index={0}>
                    {!!gitHubPRs.length && (
                      <DataGrid
                        columns={gitHubColumns}
                        rows={gitHubPRs}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    )}
                  </TabPanel>
                  <TabPanel value={tabValue} index={1}>
                    {!!gitHubPushes.length && (
                      <DataGrid
                        columns={gitHubPushesColumns}
                        rows={gitHubPushes}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    )}
                  </TabPanel>
                  <TabPanel value={tabValue} index={2}>
                    {!!gitHubPushes.length && (
                      <DataGrid
                        columns={gitHubPushesColumns}
                        rows={gitHubReleases}
                        rowHeight={75}
                        density="compact"
                        disableRowSelectionOnClick={true}
                        disableColumnMenu={true}
                        initialState={{
                          sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' }] },
                        }}
                      ></DataGrid>
                    )}
                  </TabPanel>
                </Box>
              )}
              {showBy === 'author' && !filteredGitHubRowsByAuthor && (
                <LinearProgress sx={{ mt: 5, mb: 5 }} />
              )}
              {showBy === 'author' && filteredGitHubRowsByAuthor && (
                <Box>
                  {caseInsensitiveSort(Object.keys(filteredGitHubRowsByAuthor)).map(author => (
                    <Box id={authorElementId(author)} key={author} sx={{ m: 2 }}>
                      <Stack direction="row" alignItems="center">
                        <Typography color="GrayText" variant="h6">
                          {author}
                        </Typography>
                        {gitHubRowsByAuthor?.[author]?.url && (
                          <IconButton href={gitHubRowsByAuthor[author].url ?? ''}>
                            <GitHubIcon fontSize="small" />
                          </IconButton>
                        )}
                      </Stack>
                      <DataGrid
                        columns={gitHubByAuthorColumns}
                        rows={gitHubRowsByAuthor![author].rows}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    </Box>
                  ))}
                </Box>
              )}
              {showBy === 'jira' && !filteredGitHubRowsByJira && (
                <LinearProgress sx={{ mt: 5, mb: 5 }} />
              )}
              {showBy === 'jira' && filteredGitHubRowsByJira && (
                <Box>
                  {caseInsensitiveSort(Object.keys(filteredGitHubRowsByJira)).map(jira => (
                    <Box id={jiraElementId(jira)} key={jira} sx={{ m: 2 }}>
                      <Link id={`JIRA:${jira}`} />
                      <Typography color="GrayText" variant="h6">
                        {jira}
                      </Typography>
                      <DataGrid
                        columns={gitHubColumns}
                        rows={gitHubRowsByJira![jira]}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    </Box>
                  ))}
                </Box>
              )}
            </Grid>
          </Grid>
          {gitHubError && <Alert severity="error">{gitHubError}</Alert>}
        </Stack>
      )}
      <Typography align="center" variant="h6" sx={{ mt: 5, mb: 5 }}>
        Under construction...
      </Typography>
    </Fragment>
  );
}
