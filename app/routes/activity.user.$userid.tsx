import GitHubIcon from '@mui/icons-material/GitHub';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  FormGroup,
  IconButton,
  Link,
  Popover,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import grey from '@mui/material/colors/grey';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoaderFunctionArgs, MetaFunction, redirect } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useNavigation,
} from '@remix-run/react';
import pino from 'pino';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchTicketMap,
} from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import {
  artifactActions,
  buildArtifactActionKey,
  identifyAccounts,
  inferPriority,
} from '../schemas/activityFeed';
import {
  AccountToIdentityRecord,
  ActivityRecord,
  Artifact,
  TicketRecord,
} from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import {
  actionColDef,
  dataGridCommonProps,
  dateColdDef,
  metadataActionsColDef,
  priorityColDef,
  summaryColDef,
} from '../utils/dataGridUtils';
import { DateRange } from '../utils/dateUtils';
import { internalLinkSx, stickySx } from '../utils/jsxUtils';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { caseInsensitiveCompare, removeSpaces } from '../utils/stringUtils';
import { ActivityResponse } from './fetcher.activities.$daterange.$userid';

const logger = pino({ name: 'route:activity.user' });

const ALL = '*';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'User';
  if (data?.userId && data.userId !== ALL) {
    title = data.actors[data.userId]?.name ?? 'User';
  }
  return [{ title: `${title} Activity | ROAKIT` }];
};

interface UserActivityRow {
  id: string;
  date: Date;
  action: string;
  event?: string;
  artifact: Artifact;
  initiativeId: string;
  priority?: number;
  actorId?: string;
  metadata: unknown;
  objectId?: string;
}

const userActivityRows = (
  snapshot: ActivityRecord,
  tickets: TicketRecord,
  accountMap: AccountToIdentityRecord
): UserActivityRow[] => {
  const rows: UserActivityRow[] = [];
  Object.keys(snapshot).forEach(activityId => {
    console.log('asd');
    const activity = snapshot[activityId];
    let priority = activity.priority;
    if (priority == null || priority === -1) {
      priority = activity.metadata ? inferPriority(tickets, activity.metadata) : -1;
    }
    const row: UserActivityRow = {
      id: activityId,
      date: new Date(activity.createdTimestamp),
      action: activity.action,
      event: activity.event,
      artifact: activity.artifact,
      initiativeId: activity.initiativeId,
      priority,
      metadata: activity.metadata,
      actorId:
        activity.actorId ?
          accountMap[activity.actorId] ?? activity.actorId // resolve identity
        : undefined,
      objectId: activity.objectId,
    };
    rows.push(row);
  });
  return rows;
};

// verify JWT, load initiatives and users
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve initiatives, tickets, and users
    const [initiatives, accounts, identities, tickets] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchTicketMap(sessionData.customerId!),
    ]);

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const userId = params.userid;

    // all user ids candidate as activity keys (activities can use both identityIds and accountIds)
    const activityUserIds: string[] = [];
    if (userId && userId !== ALL) {
      const userIds = new Set([userId]);
      let identityId: string;
      if (identities.accountMap[userId]) {
        // if params.userId is not an identity, add the identity
        identityId = identities.accountMap[userId];
        userIds.add(identityId);
      } else {
        identityId = userId;
      }
      // add the other accounts for the identity
      identities.list
        .filter(identity => identity.id === identityId)
        .flatMap(identity => identity.accounts)
        .map(account => account.id)
        .filter(accountId => accountId !== undefined)
        .forEach(accountId => userIds.add(accountId!));

      activityUserIds.push(...userIds);
    }

    return {
      ...sessionData,
      userId,
      activityUserIds,
      initiatives,
      tickets,
      actors,
      accountMap: identities.accountMap,
    };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function UserActivity() {
  const sessionData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const location = useLocation();
  const activitiesFetcher = useFetcher();
  const activityResponse = activitiesFetcher.data as ActivityResponse;
  const [actionFilter, setActionFilter] = useState(''); // see effect with location.hash dependency below
  const [dateFilter, setDateFilter] = useState(sessionData.dateFilter ?? DateRange.OneDay);
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [scrollToActor, setScrollToActor] = useState<string | undefined>(undefined);
  const [showOnlyActor, setShowOnlyActor] = useState<string | undefined>(undefined);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const snapshot = useRef<{ key: string; values: UserActivityRow[] }[]>();
  const [activities, setActivities] = useState<Map<string, UserActivityRow[]>>(new Map());

  const actorElementId = (actor: string) => `ACTOR-${removeSpaces(actor)}`;

  const sortAndSetUserActivities = useCallback(() => {
    if (snapshot.current) {
      const filteredSnapshot: { key: string; values: UserActivityRow[] }[] = [];
      if (actionFilter) {
        snapshot.current.forEach(user => {
          const values = user.values.filter(
            a => buildArtifactActionKey(a.artifact, a.action) === actionFilter
          );
          if (values.length > 0) {
            filteredSnapshot.push({ key: user.key, values });
          }
        });
      }
      setActivities(
        sortMap(actionFilter ? filteredSnapshot : snapshot.current, (a, b) =>
          sortAlphabetically ?
            caseInsensitiveCompare(
              sessionData.actors[a.key]?.name ?? '',
              sessionData.actors[b.key]?.name ?? ''
            )
          : b.count - a.count
        )
      );
    }
  }, [sessionData.actors, actionFilter, sortAlphabetically]);

  const setRows = useCallback(
    (querySnapshot: ActivityRecord) => {
      snapshot.current = groupByArray(
        userActivityRows(querySnapshot, sessionData.tickets, sessionData.accountMap),
        'actorId'
      );
      sortAndSetUserActivities();
      setGotSnapshot(true);
    },
    [sessionData.accountMap, sessionData.tickets, sortAndSetUserActivities]
  );

  useEffect(() => {
    console.log('adsasd');
    setActionFilter(location.hash?.slice(1) ?? '');
  }, [location.hash]);

  // load activities
  useEffect(() => {
    setGotSnapshot(false);
    const userIds = sessionData.userId === ALL ? ALL : sessionData.activityUserIds.join(',');
    activitiesFetcher.load(`/fetcher/activities/${dateFilter}/${userIds}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  useEffect(() => {
    setGotSnapshot(false);
    if (activityResponse?.activities) {
      setRows(activityResponse.activities);
    }
  }, [activityResponse?.activities, setRows]);

  useEffect(() => {
    sortAndSetUserActivities();
  }, [actionFilter, sortAlphabetically, sortAndSetUserActivities]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToActor) {
      const element = document.getElementById(actorElementId(scrollToActor));
      setScrollToActor(undefined);
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
  }, [scrollToActor]);

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColdDef({ field: 'date' }),
      actionColDef({ field: 'action' }),
      { field: 'artifact', headerName: 'Artifact' },
      priorityColDef({ field: 'priority' }),
      {
        field: 'initiativeId',
        headerName: 'Initiative',
        renderCell: params => {
          const initiativeId = params.value as string;
          return initiativeId ?
              <Box title={sessionData.initiatives[initiativeId]?.label}>{initiativeId}</Box>
            : <Box color={grey[400]}>unset</Box>;
        },
      },
      summaryColDef({ field: 'metadata' }, (element, content) => setPopover({ element, content })),
      metadataActionsColDef({}, (element: HTMLElement, metadata: unknown) =>
        setCodePopover({ element, content: metadata })
      ),
    ],
    [sessionData.initiatives]
  );

  const grids = [...activities]
    .filter(([actorId]) => !showOnlyActor || actorId === showOnlyActor)
    .filter((_, i) => showOnlyActor || i <= 9)
    .map(([actorId, rows], i) => {
      const actor = sessionData.actors[actorId];
      return (
        !!rows.length && (
          <Stack id={actorElementId(actorId ?? '-')} key={i} sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              alignItems="center"
              color={grey[600]}
              sx={{ display: 'flex', mb: 1 }}
            >
              <Box sx={{ mr: 1, textWrap: 'nowrap' }}>{actor?.name ?? 'Unknown user'}</Box>
              {actor?.urls?.map((url, i) => (
                <IconButton
                  key={i}
                  component="a"
                  href={url.url}
                  target="_blank"
                  size="small"
                  color="primary"
                >
                  {url.type === 'github' && <GitHubIcon sx={{ width: 15, height: 15 }} />}
                  {url.type === 'jira' && <JiraIcon width={15} height={15} />}
                </IconButton>
              ))}
              {sessionData.userId === ALL && actorId && (
                <IconButton
                  component="a"
                  href={
                    `/activity/user/${encodeURI(actorId)}` +
                    (actionFilter ? `#${actionFilter}` : '')
                  }
                  size="small"
                >
                  <OpenInNewIcon fontSize="small" />
                </IconButton>
              )}
            </Typography>
            <DataGrid
              columns={columns}
              rows={rows}
              {...dataGridCommonProps}
              rowHeight={50}
              slots={{
                noRowsOverlay: () => (
                  <Box height="75px" display="flex" alignItems="center" justifyContent="center">
                    No activity for these dates
                  </Box>
                ),
              }}
            />
          </Stack>
        )
      );
    });

  return (
    <App
      view="activity.user"
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || navigation.state !== 'idle'}
    >
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={sessionData.customerId}
      />
      <Popover
        id={popover?.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={() => setPopover(null)}
        onClick={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ py: 1 }}>{popover?.content}</Box>
      </Popover>
      <Stack sx={{ m: 3 }}>
        <Stack direction="row">
          {sessionData.userId === ALL && (
            <Box sx={{ display: 'flex', mr: 2 }}>
              <Box sx={{ position: 'relative' }}>
                <Box fontSize="small" color={grey[700]} sx={{ ...stickySx }}>
                  <FormGroup sx={{ mb: 2, ml: 2 }}>
                    {activities.size > 0 && gotSnapshot && (
                      <FormControlLabel
                        control={
                          <Switch
                            size="small"
                            checked={sortAlphabetically}
                            onChange={e => {
                              setSortAlphabetically(e.target.checked);
                              window.scrollTo({ top: 0 });
                            }}
                          />
                        }
                        label="Sort alphabetically"
                        title="Sort alphabetically or by activity count"
                        disableTypography
                      />
                    )}
                  </FormGroup>
                  {[...activities.keys()].map((actorId, i) => (
                    <Box key={i} sx={{ mb: i === 9 ? 2 : undefined }}>
                      <Link
                        sx={internalLinkSx}
                        onClick={() => {
                          if (i <= 9 && !showOnlyActor) {
                            setScrollToActor(actorId);
                          } else {
                            setShowOnlyActor(actorId);
                          }
                        }}
                      >
                        {sessionData.actors[actorId]?.name ?? 'Unknown'}
                      </Link>
                      {` (${activities.get(actorId)?.length ?? 0})`}
                    </Box>
                  ))}
                </Box>
              </Box>
            </Box>
          )}
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Grid container columns={2} spacing={2} alignItems="center" sx={{ mb: 2 }}>
              <Grid>
                {sessionData.userId !== ALL && (
                  <Button
                    variant="outlined"
                    href={'/activity/user/*' + (actionFilter ? `#${actionFilter}` : '')}
                    sx={{ textWrap: 'nowrap' }}
                  >
                    {'See all contributors'}
                  </Button>
                )}
              </Grid>
              <Grid flex={1}>
                <FilterMenu
                  selectedValue={actionFilter ?? ''}
                  items={[
                    { value: '', label: 'None', color: grey[500] },
                    ...[...artifactActions].map(([key, action]) => {
                      return { value: key, label: action.label };
                    }),
                  ]}
                  onChange={
                    e => {
                      if (e.target.value) {
                        navigate({ hash: e.target.value });
                      } else {
                        history.pushState(
                          '',
                          document.title,
                          window.location.pathname + window.location.search
                        ); // see https://stackoverflow.com/a/5298684/290343 if we use navigate, it causes the page to reload
                        setActionFilter('');
                      }
                    }
                    //  navigate({ hash: e.target.value ? `#${e.target.value}` : undefined })
                  }
                  sx={{ justifyContent: 'right' }}
                />
              </Grid>
            </Grid>
            {grids}
          </Stack>
        </Stack>
        {activityResponse?.error?.message && (
          <Alert severity="error" sx={{ mb: 1 }}>
            {activityResponse.error.message}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
