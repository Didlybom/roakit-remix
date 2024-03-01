import GitHubIcon from '@mui/icons-material/GitHub';
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
  Tooltip,
  Typography,
} from '@mui/material';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import memoize from 'fast-memoize';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import { loadSession } from '~/utils/authUtils.server';
import Header from '../components/Header';
import LinkifyJira from '../components/LinkifyJira';
import TabPanel from '../components/TabPanel';
import {
  GitHubEventType,
  GitHubRow,
  gitHubRows,
  rowsByAuthor,
  rowsByJira,
} from '../feeds/githubFeed';
import { firestore as firestoreClient } from '../firebase.client';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  dateFilterToStartDate,
  formatMonthDay,
  formatMonthDayTime,
  formatRelative,
} from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { caseInsensitiveSort, removeSpaces } from '../utils/stringUtils';

enum ActivityView {
  All,
  Author,
  Jira,
}

enum EventTab {
  PullRequest = 0,
  PullRequestComment = 1,
  Push = 2,
  Release = 3,
}

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return sessionData;
};

export default function Index() {
  const sessionData = useLoaderData<typeof loader>();
  const [view, setView] = useState<EventTab>(EventTab.PullRequest);
  const [dateFilter, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const [showBy, setShowBy] = useState<ActivityView>(ActivityView.Jira);
  const [scrollToAuthor, setScrollToAuthor] = useState<string | undefined>(undefined);
  const [scrollToJira, setScrollToJira] = useState<string | undefined>(undefined);
  const [popoverElement, setPopoverElement] = useState<HTMLElement | null>(null);
  const [popoverContent, setPopoverContent] = useState<JSX.Element | undefined>(undefined);

  const [areRowsSet, setAreRowsSet] = useState(false);
  const [gitHubPRs, setGithubPRs] = useState<GitHubRow[]>([]);
  const [gitHubPRComments, setGithubPRComments] = useState<GitHubRow[]>([]);
  const [gitHubPushes, setGithubPushes] = useState<GitHubRow[]>([]);
  const [gitHubReleases, setGithubReleases] = useState<GitHubRow[]>([]);

  const prevDateFilter = usePrevious(dateFilter);

  const [error, setError] = useState('');

  const pluralizeMemo = memoize(pluralize);

  const handleJiraClick = useCallback((jira: string) => {
    setShowBy(ActivityView.Jira);
    setScrollToJira(jira);
    setPopoverElement(null);
  }, []);

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
                sx={{ cursor: 'pointer', textDecoration: 'none', borderBottom: 'dotted 1px' }}
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
            <Stack sx={{ overflowX: 'scroll', mt: '5px' }}>
              <Typography variant="body2">
                {showBy === ActivityView.Jira ?
                  title
                : <LinkifyJira content={title} onClick={jira => handleJiraClick(jira)} />}
              </Typography>
              {!fields?.commitMessages?.length ?
                <Typography variant="caption">{activity}</Typography>
              : <Link
                  variant="caption"
                  onClick={e => {
                    setPopoverContent(
                      <List dense={true}>
                        <LinkifyJira
                          content={fields.commitMessages?.map((message, i) => (
                            <ListItem key={i}>
                              <ListItemText>{message}</ListItemText>
                            </ListItem>
                          ))}
                          onClick={jira => handleJiraClick(jira)}
                        />
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
                <Typography variant="caption" sx={{ overflowX: 'clip', textOverflow: 'ellipsis' }}>
                  {fields.pullRequestComment.comment}
                </Typography>
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
    [handleJiraClick, pluralizeMemo, showBy]
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

  const setRows = (type: GitHubEventType, querySnapshot: firebase.firestore.QuerySnapshot) => {
    setAreRowsSet(true);
    try {
      switch (type) {
        case GitHubEventType.PullRequest:
          return setGithubPRs(gitHubRows(querySnapshot));
        case GitHubEventType.PullRequestReviewComment:
          return setGithubPRComments(gitHubRows(querySnapshot));
        case GitHubEventType.Push:
          return setGithubPushes(gitHubRows(querySnapshot));
        case GitHubEventType.Release:
          return setGithubReleases(gitHubRows(querySnapshot));
      }
    } catch (e: unknown) {
      setError(errMsg(e, `Error parsing GitHub ${type} events`));
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
        .orderBy('eventTimestamp')
        .startAt(startDate)
        .limit(1000); // FIXME limit
      unsubscribe[type] = query.onSnapshot(
        snapshot => setRows(type, snapshot),
        error => setError(error.message)
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

  const filteredGitHubRowsByAuthor = rowsByAuthor;
  const filteredGitHubRowsByJira = rowsByJira;
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
      <Header
        isLoggedIn={sessionData.isLoggedIn}
        view="github"
        dateRange={dateFilter}
        onDateRangeSelect={dateRange => setDateFilter(dateRange)}
        showProgress={prevDateFilter && dateFilter !== prevDateFilter}
      />
      <Popover
        id={popoverElement ? 'popover' : undefined}
        open={!!popoverElement}
        anchorEl={popoverElement}
        onClose={() => setPopoverElement(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Typography sx={{ p: 2 }}>{popoverContent}</Typography>
      </Popover>
      <Stack sx={{ m: 2 }}>
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
        {showBy === ActivityView.Jira && !filteredGitHubRowsByJira && (
          <LinearProgress sx={{ my: 5 }} />
        )}
        {showBy === ActivityView.Jira && sortedJiras && (
          <Stack direction="row" sx={{ ml: 2 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ position: 'relative', mt: '15px' }}>
                <Box
                  sx={{
                    textWrap: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    maxHeight: '100vh',
                    overflowY: 'auto',
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
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              {sortedJiras.map((jira, i) => (
                <Box id={jiraElementId(jira)} key={i} sx={{ m: 2 }}>
                  <Stack direction="row">
                    <Box sx={{ position: 'relative' }}>
                      <Box
                        sx={{
                          mt: 1,
                          inlineSize: 'fit-content',
                          transform: 'rotate(-90deg)',
                        }}
                      >
                        <Typography color="GrayText" variant="h6">
                          {jira}
                        </Typography>
                      </Box>
                    </Box>
                    <DataGrid
                      columns={gitHubColumns}
                      rows={rowsByJira![jira]}
                      {...dataGridCommonProps}
                    ></DataGrid>
                  </Stack>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
        {showBy === ActivityView.Author && !filteredGitHubRowsByAuthor && (
          <LinearProgress sx={{ my: 5 }} />
        )}
        {showBy === ActivityView.Author && sortedAuthors && (
          <Stack direction="row" sx={{ ml: 2 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ position: 'relative', mt: '25px' }}>
                <Box
                  sx={{
                    textWrap: 'nowrap',
                    position: 'sticky',
                    top: 0,
                    maxHeight: '100vh',
                    overflowY: 'auto',
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
              </Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              {sortedAuthors.map(author => (
                <Box id={authorElementId(author)} key={author} sx={{ m: 2 }}>
                  <Stack direction="row" alignItems="center">
                    <Typography color="GrayText" variant="h6">
                      {author}
                    </Typography>
                    {rowsByAuthor?.[author]?.url && (
                      <IconButton href={rowsByAuthor[author].url ?? ''}>
                        <GitHubIcon fontSize="small" />
                      </IconButton>
                    )}
                  </Stack>
                  <DataGrid
                    columns={gitHubByAuthorColumns}
                    rows={rowsByAuthor![author].rows}
                    {...dataGridCommonProps}
                  ></DataGrid>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
        {showBy === ActivityView.All && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
              <Tabs
                variant="scrollable"
                value={view}
                onChange={(e, newValue: EventTab) => setView(newValue)}
              >
                <Tab label="Pull Requests" id={`tab-${EventTab.PullRequest}`} />
                <Tab label="Discussion" id={`tab-${EventTab.PullRequestComment}`} />
                <Tab label="Pushes" id={`tab-${EventTab.Push}`} />
                <Tab label="Releases" id={`tab-${EventTab.Release}`} />
              </Tabs>
            </Box>
            {!areRowsSet && <LinearProgress sx={{ my: 5 }} />}
            <TabPanel value={view} index={EventTab.PullRequest}>
              {!!gitHubPRs.length && (
                <DataGrid
                  columns={gitHubColumns}
                  rows={gitHubPRs}
                  {...dataGridCommonProps}
                ></DataGrid>
              )}
            </TabPanel>
            <TabPanel value={view} index={EventTab.PullRequestComment}>
              {!!gitHubPRComments.length && (
                <DataGrid
                  columns={gitHubColumns}
                  rows={gitHubPRComments}
                  {...dataGridCommonProps}
                ></DataGrid>
              )}
            </TabPanel>
            <TabPanel value={view} index={EventTab.Push}>
              {!!gitHubPushes.length && (
                <DataGrid
                  columns={gitHubPushesColumns}
                  rows={gitHubPushes}
                  {...dataGridCommonProps}
                ></DataGrid>
              )}
            </TabPanel>
            <TabPanel value={view} index={EventTab.Release}>
              {!!gitHubReleases.length && (
                <DataGrid
                  columns={gitHubPushesColumns}
                  rows={gitHubReleases}
                  {...dataGridCommonProps}
                ></DataGrid>
              )}
            </TabPanel>
          </>
        )}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </>
  );
}
