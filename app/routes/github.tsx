import GitHubIcon from '@mui/icons-material/GitHub';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import {
  Alert,
  Box,
  Chip,
  IconButton,
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
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import memoize from 'fast-memoize';
import firebase from 'firebase/compat/app';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import App from '../components/App';
import LinkifyJira from '../components/LinkifyJira';
import TabPanel from '../components/TabPanel';
import { firestore as firestoreClient } from '../firebase.client';
import JiraIcon from '../icons/Jira';
import {
  GitHubEventType,
  GitHubRow,
  gitHubRows,
  rowsByAuthor,
  rowsByJira,
} from '../schemas/githubFeed';
import { loadSession } from '../utils/authUtils.server';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  dateFilterToStartDate,
  formatMonthDay,
} from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import {
  actorColdDef,
  dataGridCommonProps,
  dateColdDef,
  disabledNotOpaqueSx,
  ellipsisSx,
  stickySx,
} from '../utils/jsxUtils';
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
  const isHydrated = useHydrated();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const prevDateFilter = usePrevious(dateFilter);
  const [showBy, setShowBy] = useState<ActivityView>(ActivityView.Jira);
  const [scrollToAuthor, setScrollToAuthor] = useState<string | undefined>(undefined);
  const [scrollToJira, setScrollToJira] = useState<string | undefined>(undefined);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [error, setError] = useState('');
  const pluralizeMemo = memoize(pluralize);

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const [gitHubPRs, setGithubPRs] = useState<GitHubRow[]>([]);
  const [gitHubPRComments, setGithubPRComments] = useState<GitHubRow[]>([]);
  const [gitHubPushes, setGithubPushes] = useState<GitHubRow[]>([]);
  const [gitHubReleases, setGithubReleases] = useState<GitHubRow[]>([]);

  const handleJiraClick = useCallback((jira: string) => {
    setShowBy(ActivityView.Jira);
    setScrollToJira(jira);
    setPopover(null);
  }, []);

  const gitHubColumns = useMemo<GridColDef[]>(
    () => [
      dateColdDef(),
      { field: 'repositoryName', headerName: 'Repo.', width: 120 },
      actorColdDef({
        headerName: 'Author',
        width: 120,
        renderCell: (params: GridRenderCellParams) => {
          const fields = params.value as GitHubRow['actor'];
          return !fields ? '' : (
              <Link
                title={fields.name}
                onClick={() => {
                  setShowBy(ActivityView.Author);
                  setScrollToAuthor(fields.name);
                }}
                sx={{
                  cursor: 'pointer',
                  textDecoration: 'none',
                  borderBottom: 'dotted 1px',
                  ...ellipsisSx,
                }}
              >
                {fields.name}
              </Link>
            );
        },
      }),
      {
        field: 'ref',
        headerName: 'Ref.',
        width: 90,
        sortComparator: (a: GitHubRow['ref'], b: GitHubRow['ref']) =>
          (a?.label ?? '').localeCompare(b?.label ?? ''),
        renderCell: params => {
          const fields = params.value as GitHubRow['ref'];
          return !fields ? '' : (
              <Link href={fields.url} title={fields.label} sx={{ ...ellipsisSx }}>
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
                    setPopover({
                      element: e.currentTarget,
                      content: (
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
                      ),
                    });
                  }}
                  sx={{ cursor: 'pointer' }}
                >
                  {activity}
                </Link>
              }
              {fields?.pullRequestComment && (
                <Typography variant="caption" sx={{ ...ellipsisSx }}>
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
    try {
      switch (type) {
        case GitHubEventType.PullRequest:
          setGithubPRs(gitHubRows(querySnapshot));
          break;
        case GitHubEventType.PullRequestReviewComment:
          setGithubPRComments(gitHubRows(querySnapshot));
          break;
        case GitHubEventType.Push:
          setGithubPushes(gitHubRows(querySnapshot));
          break;
        case GitHubEventType.Release:
          setGithubReleases(gitHubRows(querySnapshot));
          break;
      }
      setGotSnapshot(true);
    } catch (e: unknown) {
      setError(errMsg(e, `Error parsing GitHub ${type} events`));
    }
  };

  // Firestore listeners
  useEffect(() => {
    if (!dateFilter) {
      return;
    }
    setGotSnapshot(false);
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
        setTimeout(
          () =>
            window.scrollTo({
              top: element.getBoundingClientRect().top + window.scrollY - 54,
              behavior: 'smooth',
            }),
          0
        );
      }
    }
  }, [scrollToAuthor]);

  useEffect(() => {
    if (scrollToJira) {
      const element = document.getElementById(jiraElementId(scrollToJira));
      setScrollToJira(undefined);
      if (element) {
        setTimeout(
          () =>
            window.scrollTo({
              top: element.getBoundingClientRect().top + window.scrollY - 58,
              behavior: 'smooth',
            }),
          0
        );
      }
    }
  }, [scrollToJira]);

  const filteredGitHubRowsByAuthor = rowsByAuthor;
  const filteredGitHubRowsByJira = rowsByJira;
  if (filteredGitHubRowsByAuthor && dateFilter) {
    const startDate = dateFilterToStartDate(dateFilter)!;
    Object.keys(filteredGitHubRowsByAuthor).forEach(author => {
      filteredGitHubRowsByAuthor[author].rows = filteredGitHubRowsByAuthor[author].rows.filter(
        row => row.date.getTime() >= startDate
      );
      if (filteredGitHubRowsByAuthor[author].rows.length === 0) {
        delete filteredGitHubRowsByAuthor[author];
      }
    });
  }
  if (filteredGitHubRowsByJira && dateFilter) {
    const startDate = dateFilterToStartDate(dateFilter)!;
    Object.keys(filteredGitHubRowsByJira).forEach(jira => {
      filteredGitHubRowsByJira[jira] = filteredGitHubRowsByJira[jira].filter(
        row => row.date.getTime() >= startDate
      );
      if (filteredGitHubRowsByJira[jira].length === 0) {
        delete filteredGitHubRowsByJira[jira];
      }
    });
  }

  const sortedAuthors = caseInsensitiveSort(Object.keys(filteredGitHubRowsByAuthor));
  const sortedJiras = caseInsensitiveSort(Object.keys(filteredGitHubRowsByJira));

  return (
    <App
      view="github"
      isLoggedIn={sessionData.isLoggedIn}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
    >
      <Popover
        id={popover?.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={() => setPopover(null)}
        onClick={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Typography sx={{ p: 2 }}>{popover?.content}</Typography>
      </Popover>
      <Stack sx={{ mt: 3 }}>
        <Stack direction="row" spacing={2} sx={{ ml: 2, mb: 1 }}>
          {[
            { viewBy: ActivityView.Jira, label: 'By Jira', icon: <JiraIcon /> },
            { viewBy: ActivityView.Author, label: 'By Author', icon: <SupervisorAccountIcon /> },
            { viewBy: ActivityView.All, label: 'By GitHub Action', icon: <GitHubIcon /> },
          ].map((p, i) => (
            <Chip
              key={i}
              disabled={showBy === p.viewBy}
              color={showBy === p.viewBy ? 'primary' : 'default'}
              variant={showBy === p.viewBy ? 'filled' : 'outlined'}
              onClick={() => setShowBy(p.viewBy)}
              label={p.label}
              icon={p.icon}
              sx={{ ...(showBy === p.viewBy && { ...disabledNotOpaqueSx }) }}
            />
          ))}
        </Stack>
        {showBy === ActivityView.Jira && !sortedJiras.length && gotSnapshot && (
          <Typography textAlign="center" sx={{ m: 4 }}>
            Nothing to show for these dates
          </Typography>
        )}
        {showBy === ActivityView.Jira && sortedJiras && (
          <Stack direction="row" sx={{ ml: 2 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ position: 'relative', mt: '15px' }}>
                <Box sx={{ ...stickySx }}>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
              {sortedJiras.map((jira, i) => (
                <Box id={jiraElementId(jira)} key={i} sx={{ m: 2 }}>
                  <Stack direction="row">
                    <Box sx={{ position: 'relative' }}>
                      <Box width="50px" sx={{ mt: 1, writingMode: 'vertical-rl' }}>
                        <Typography color="GrayText" variant="h6">
                          {jira}
                        </Typography>
                      </Box>
                    </Box>
                    <DataGrid
                      columns={gitHubColumns}
                      rows={rowsByJira[jira]}
                      {...dataGridCommonProps}
                    />
                  </Stack>
                </Box>
              ))}
            </Box>
          </Stack>
        )}
        {showBy === ActivityView.Author && !sortedAuthors.length && gotSnapshot && (
          <Typography textAlign="center" sx={{ m: 4 }}>
            Nothing to show for these dates
          </Typography>
        )}
        {showBy === ActivityView.Author && sortedAuthors && (
          <Stack direction="row" sx={{ ml: 2 }}>
            <Box sx={{ display: 'flex' }}>
              <Box sx={{ position: 'relative', mt: '25px' }}>
                <Box sx={{ ...stickySx }}>
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
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
                    rows={rowsByAuthor[author].rows}
                    {...dataGridCommonProps}
                  />
                </Box>
              ))}
            </Box>
          </Stack>
        )}
        {showBy === ActivityView.All && gotSnapshot && (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', my: 1 }}>
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
            <TabPanel value={view} index={EventTab.PullRequest}>
              <DataGrid columns={gitHubColumns} rows={gitHubPRs} {...dataGridCommonProps} />
            </TabPanel>
            <TabPanel value={view} index={EventTab.PullRequestComment}>
              <DataGrid columns={gitHubColumns} rows={gitHubPRComments} {...dataGridCommonProps} />
            </TabPanel>
            <TabPanel value={view} index={EventTab.Push}>
              <DataGrid
                columns={gitHubPushesColumns}
                rows={gitHubPushes}
                {...dataGridCommonProps}
              />
            </TabPanel>
            <TabPanel value={view} index={EventTab.Release}>
              <DataGrid
                columns={gitHubPushesColumns}
                rows={gitHubReleases}
                {...dataGridCommonProps}
              />
            </TabPanel>
          </>
        )}
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
