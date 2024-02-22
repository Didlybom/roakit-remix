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
  CircularProgress,
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
  Tooltip,
  Typography,
} from '@mui/material';
//import Grid from '@mui/material/Unstable_Grid2/Grid2';
import Grid from '@mui/material/Grid';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { startOfToday } from 'date-fns/startOfToday';
import { subWeeks } from 'date-fns/subWeeks';
import memoize from 'fast-memoize';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import pluralize from 'pluralize';
import { SyntheticEvent, useEffect, useMemo, useState } from 'react';
import usePrevious from 'use-previous';
import { GitHubRow, gitHubEventSchema } from '../feeds/githubFeed';
import { firestore as firestoreClient } from '../firebase.client';
import Header from '../src/Header';
import TabPanel from '../src/TabPanel';
import { formatMonthDay, formatMonthDayTime, formatRelative } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { linkifyJira } from '../utils/jsxUtils';
import { SessionData, getSessionData } from '../utils/sessionCookie.server';
import { caseInsensitiveSort, findJiraProjects, removeSpaces } from '../utils/stringUtils';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

enum GitHubEventType {
  PullRequest = 'pull_request',
  PullRequestReviewComment = 'pull_request_review_comment',
  Push = 'push',
  Release = 'release',
}

enum ActivityView {
  All,
  Author,
  Jira,
}

enum GitHubView {
  PullRequest = 0,
  PullRequestComment = 1,
  Push = 2,
  Release = 3,
}

enum DateFilter {
  TwoWeeks = 'TwoWeeks',
  OneWeek = 'OneWeek',
  OneDay = 'OneDay',
}

const dateFilters: Record<DateFilter, string> = {
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
          { label: data.pull_request.head.ref, url: data.pull_request.html_url }
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
      if (!gitHubRowsByAuthor) {
        gitHubRowsByAuthor = {};
      }
      if (!(row.author.name in gitHubRowsByAuthor)) {
        gitHubRowsByAuthor[row.author.name] = { url: row.author.url, rows: [] };
      }
      if (!gitHubRowsByAuthor[row.author.name].rows.find(r => r.id === row.id)) {
        gitHubRowsByAuthor[row.author.name].rows.push(row);
      }
    }
    const jiraProjects = findJiraProjects(row.activity.title + ' ' + row.ref?.label);
    if (jiraProjects.length) {
      if (!gitHubRowsByJira) {
        gitHubRowsByJira = {};
      }
      jiraProjects.forEach(jiraProject => {
        if (!(jiraProject in gitHubRowsByJira!)) {
          gitHubRowsByJira![jiraProject] = [];
        }
        if (!gitHubRowsByJira![jiraProject].find(r => r.id === row.id)) {
          gitHubRowsByJira![jiraProject].push(row);
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
  const [gitHubView, setGitHubView] = useState<GitHubView>(GitHubView.PullRequest);
  const [dateFilter, setDateFilter] = useState<DateFilter>(DateFilter.OneDay);
  const [showBy, setShowBy] = useState<ActivityView>(ActivityView.Jira);
  const [scrollToAuthor, setScrollToAuthor] = useState<string | undefined>(undefined);
  const [scrollToJira, setScrollToJira] = useState<string | undefined>(undefined);
  const [popoverElement, setPopoverElement] = useState<HTMLElement | null>(null);
  const [popoverContent, setPopoverContent] = useState<JSX.Element | undefined>(undefined);

  const [gitHubPRs, setGithubPRs] = useState<GitHubRow[]>([]);
  const [gitHubPRComments, setGithubPRComments] = useState<GitHubRow[]>([]);
  const [gitHubPushes, setGithubPushes] = useState<GitHubRow[]>([]);
  const [gitHubReleases, setGithubReleases] = useState<GitHubRow[]>([]);

  const prevDateFilter = usePrevious(dateFilter);

  const [gitHubError, setGitHubError] = useState('');

  const handleTabChange = (event: SyntheticEvent, newValue: GitHubView) => {
    setGitHubView(newValue);
  };

  const pluralizeMemo = memoize(pluralize);

  const gitHubColumns = useMemo<GridColDef[]>(
    () => [
      {
        field: 'timestamp',
        headerName: 'Date',
        type: 'dateTime',
        valueGetter: params => new Date(params.value as number),
        valueFormatter: params => formatRelative(params.value as Date),
        renderCell: params => {
          return (
            <Tooltip title={formatMonthDayTime(params.value as Date)}>
              <Box>{formatRelative(params.value as Date)}</Box>
            </Tooltip>
          );
        },
        width: 120,
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
          return !fields ? '' : (
              <Link
                onClick={() => {
                  setShowBy(ActivityView.Author);
                  setScrollToAuthor(fields.name);
                }}
                sx={{ cursor: 'pointer' }}
              >
                {fields.name}
              </Link>
            );
        },
      },
      {
        field: 'ref',
        headerName: 'Reference',
        width: 180,
        sortComparator: (a: GitHubRow['ref'], b: GitHubRow['ref']) =>
          (a?.label ?? '').localeCompare(b?.label ?? ''),
        renderCell: params => {
          const fields = params.value as GitHubRow['ref'];
          return !fields ? '' : (
              <Link href={fields.url} title={fields.label} sx={{ overflowX: 'scroll' }}>
                {fields.label}
              </Link>
            );
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
            if (fields.created && !fields?.pullRequestComment) {
              activity += `Created ${formatMonthDay(new Date(fields.created))}, `;
            }
            if (fields.changedFiles) {
              activity += `${fields.changedFiles} changed ${pluralizeMemo('file', fields.changedFiles)}, `;
            }
            if (fields.comments) {
              activity += `${fields.comments} ${pluralizeMemo('comment', fields.comments)}, `;
            }
            if (fields.commits && !fields.commitMessages) {
              activity += `${fields.commits} ${pluralizeMemo('commit', fields.commits)}, `;
            }
            if (fields.commitMessages && fields.commitMessages.length > 1) {
              activity += `and ${fields.commitMessages.length - 1} more ${pluralizeMemo('commit', fields.commitMessages.length - 1)}, `;
            }
          }
          if (activity) {
            activity = activity.slice(0, -2);
          }
          const cell = (
            <Stack sx={{ overflowX: 'scroll' }}>
              <Typography variant="body2">
                {linkifyJira(title, jira => {
                  setShowBy(ActivityView.Jira);
                  setScrollToJira(jira);
                  setPopoverElement(null);
                })}
              </Typography>
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
                          )),
                          jira => {
                            setShowBy(ActivityView.Jira);
                            setScrollToJira(jira);
                            setPopoverElement(null);
                          }
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
              {fields?.pullRequestComment && (
                <Link href={fields.pullRequestComment.url} sx={{ cursor: 'pointer' }}>
                  <Typography
                    variant="caption"
                    sx={{ overflowX: 'clip', textOverflow: 'ellipsis' }}
                  >
                    {fields.pullRequestComment.comment}
                  </Typography>
                </Link>
              )}
            </Stack>
          );
          if (fields?.pullRequestComment) {
            return <Tooltip title={fields.pullRequestComment?.comment}>{cell}</Tooltip>;
          } else {
            return cell;
          }
        },
      },
    ],
    [pluralizeMemo]
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

  const setGitHubRows = (
    type: GitHubEventType,
    querySnapshot: firebase.firestore.QuerySnapshot
  ) => {
    try {
      switch (type) {
        case GitHubEventType.PullRequest:
          return setGithubPRs(githubRows(querySnapshot));
        case GitHubEventType.PullRequestReviewComment:
          return setGithubPRComments(githubRows(querySnapshot));
        case GitHubEventType.Push:
          return setGithubPushes(githubRows(querySnapshot));
        case GitHubEventType.Release:
          return setGithubReleases(githubRows(querySnapshot));
      }
    } catch (e: unknown) {
      setGitHubError(errMsg(e, `Error parsing GitHub ${type} events`));
    }
  };

  // Firestore listeners
  useEffect(() => {
    const unsubscribe: Record<string, () => void> = {};
    Object.values(GitHubEventType).map((type: GitHubEventType) => {
      const startDate = dateFilterToStartDate(dateFilter);
      const query = firestoreClient
        .collection(
          `customers/${sessionData.customerId}/feeds/1/events/${type}/instances` // FIXME feedId
        )
        .where('eventTimestamp', '>=', startDate)
        .orderBy('eventTimestamp')
        .startAt(startDate)
        .limit(1000); // FIXME limit
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
  if (filteredGitHubRowsByAuthor) {
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
  if (filteredGitHubRowsByJira) {
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

  const sortedAuthors =
    filteredGitHubRowsByAuthor ?
      caseInsensitiveSort(Object.keys(filteredGitHubRowsByAuthor))
    : null;

  const sortedJiras =
    filteredGitHubRowsByJira ? caseInsensitiveSort(Object.keys(filteredGitHubRowsByJira)) : null;

  const dataGridCommonProps = {
    rowHeight: 75,
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    pageSizeOptions: [25, 50, 100],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' as GridSortDirection }] },
    },
  };

  return (
    <>
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
            <Button
              disabled={showBy === ActivityView.Jira}
              onClick={() => setShowBy(ActivityView.Jira)}
            >
              By Jira project
            </Button>
            <Divider orientation="vertical" variant="middle" flexItem />
            <Button
              disabled={showBy === ActivityView.Author}
              onClick={() => setShowBy(ActivityView.Author)}
            >
              By Author
            </Button>
            <Divider orientation="vertical" variant="middle" flexItem />
            <Button
              disabled={showBy === ActivityView.All}
              onClick={() => setShowBy(ActivityView.All)}
            >
              All GitHub Activity
            </Button>
          </Stack>
          <Grid container direction={{ xs: 'column', md: 'row' }}>
            <Grid>
              <Timeline
                sx={{
                  position: { xs: 'static', md: 'sticky' },
                  top: 0,
                  rotate: { xs: '-90deg', md: 'none' },
                  maxHeight: 100,
                  maxWidth: 130,
                  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                  [`& .${timelineItemClasses.root}:before`]: { flex: 0, padding: 0 },
                }}
              >
                {Object.keys(dateFilters).map(date => (
                  <TimelineItem key={date} sx={{ minHeight: 50 }}>
                    <TimelineSeparator>
                      <TimelineDot>
                        {prevDateFilter &&
                          dateFilter !== prevDateFilter &&
                          dateFilter === (date as DateFilter) && (
                            <CircularProgress
                              size={18}
                              sx={{
                                position: 'absolute',
                                top: 9,
                                left: -3,
                                zIndex: 1,
                              }}
                            />
                          )}
                      </TimelineDot>
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
              {showBy === ActivityView.Jira && !filteredGitHubRowsByJira && (
                <LinearProgress sx={{ mt: 5, mb: 5 }} />
              )}
              {showBy === ActivityView.Jira && sortedJiras && (
                <Stack direction="row">
                  <Box
                    sx={{
                      mt: 1,
                      p: 2,
                      textWrap: 'nowrap',
                    }}
                  >
                    {sortedJiras.map((jira, i) => (
                      <Box key={i}>
                        <Link
                          fontSize="small"
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setScrollToJira(jira)}
                        >
                          {jira}
                        </Link>
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {sortedJiras.map((jira, i) => (
                      <Box id={jiraElementId(jira)} key={i} sx={{ ml: 0, mt: 4 }}>
                        <Stack direction="row">
                          <Box sx={{ position: 'relative' }}>
                            <Box
                              sx={{
                                writingMode: 'vertical-rl',
                              }}
                            >
                              <Link id={`JIRA:${jira}`} />
                              <Typography color="GrayText" variant="h6">
                                {jira}
                              </Typography>
                            </Box>
                          </Box>
                          <DataGrid
                            columns={gitHubColumns}
                            rows={gitHubRowsByJira![jira]}
                            {...dataGridCommonProps}
                            sx={{ ml: '10px' }}
                          ></DataGrid>
                        </Stack>
                      </Box>
                    ))}
                  </Box>
                </Stack>
              )}
              {showBy === ActivityView.Author && !filteredGitHubRowsByAuthor && (
                <LinearProgress sx={{ mt: 5, mb: 5 }} />
              )}
              {showBy === ActivityView.Author && sortedAuthors && (
                <Stack direction="row">
                  <Box
                    sx={{
                      mt: 1,
                      p: 2,
                      textWrap: 'nowrap',
                    }}
                  >
                    {sortedAuthors.map((author, i) => (
                      <Box key={i}>
                        <Link
                          fontSize="small"
                          sx={{ cursor: 'pointer' }}
                          onClick={() => setScrollToAuthor(author)}
                        >
                          {author}
                        </Link>
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    {sortedAuthors.map(author => (
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
                </Stack>
              )}
              {showBy === ActivityView.All && (
                <Box>
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
                    <Tabs value={gitHubView} onChange={handleTabChange} aria-label="Activities">
                      <Tab label="PR Assignments" id={`tab-${GitHubView.PullRequest}`} />
                      <Tab label="PR Discussion" id={`tab-${GitHubView.PullRequestComment}`} />
                      <Tab label="Pushes" id={`tab-${GitHubView.Push}`} />
                      <Tab label="Releases" id={`tab-${GitHubView.Release}`} />
                    </Tabs>
                  </Box>
                  {(!gitHubPRs.length || !gitHubPushes.length) && (
                    <LinearProgress sx={{ mt: 5, mb: 5 }} />
                  )}
                  <TabPanel value={gitHubView} index={GitHubView.PullRequest}>
                    {!!gitHubPRs.length && (
                      <DataGrid
                        columns={gitHubColumns}
                        rows={gitHubPRs}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    )}
                  </TabPanel>
                  {(!gitHubPRComments.length || !gitHubPushes.length) && (
                    <LinearProgress sx={{ mt: 5, mb: 5 }} />
                  )}
                  <TabPanel value={gitHubView} index={GitHubView.PullRequestComment}>
                    {!!gitHubPRComments.length && (
                      <DataGrid
                        columns={gitHubColumns}
                        rows={gitHubPRComments}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    )}
                  </TabPanel>
                  <TabPanel value={gitHubView} index={GitHubView.Push}>
                    {!!gitHubPushes.length && (
                      <DataGrid
                        columns={gitHubPushesColumns}
                        rows={gitHubPushes}
                        {...dataGridCommonProps}
                      ></DataGrid>
                    )}
                  </TabPanel>
                  <TabPanel value={gitHubView} index={GitHubView.Release}>
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
            </Grid>
          </Grid>
          {gitHubError && <Alert severity="error">{gitHubError}</Alert>}
        </Stack>
      )}
      <Typography align="center" variant="h6" sx={{ mt: 5, mb: 5 }}>
        Under construction...
      </Typography>
    </>
  );
}
