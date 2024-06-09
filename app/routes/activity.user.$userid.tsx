import { GitHub as GitHubIcon, OpenInNew as OpenInNewIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  FormGroup,
  Unstable_Grid2 as Grid,
  IconButton,
  Link,
  Popover,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from '@remix-run/react';
import dayjs from 'dayjs';
import pino from 'pino';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MapperType, compileActivityMappers, mapActivity } from '../activityMapper/activityMapper';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import {
  actionColDef,
  dataGridCommonProps,
  dateColdDef,
  descriptionColDef,
  metadataActionsColDef,
  priorityColDef,
} from '../components/datagrid/dataGridCommon';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import { artifactActions, buildArtifactActionKey, identifyAccounts } from '../types/activityFeed';
import type { AccountToIdentityRecord, ActivityRecord, Artifact } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate, endOfDay, formatYYYYMMDD } from '../utils/dateUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  errorAlert,
  internalLinkSx,
  loaderErrorResponse,
  loginWithRedirect,
  stickySx,
} from '../utils/jsxUtils';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { View } from '../utils/rbac';
import { caseInsensitiveCompare, removeSpaces } from '../utils/stringUtils';
import { ActivityResponse } from './fetcher.activities.($userid)';

const logger = pino({ name: 'route:activity.user' });

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'User';
  if (data?.userId && data.userId !== ALL) {
    title = data.actors[data.userId]?.name ?? 'User';
  }
  return [{ title: `${title} Activity | ROAKIT` }];
};

export const shouldRevalidate = () => false;

const VIEW = View.ActivityUser;

const ALL = '*';
const SEARCH_PARAM_ACTION = 'action';

interface UserActivityRow {
  id: string;
  date: Date;
  action: string;
  eventType?: string;
  event?: string;
  artifact: Artifact;
  initiativeId: string;
  launchItemId: string;
  priority?: number;
  actorId?: string;
  metadata: unknown;
  objectId?: string;
}

const userActivityRows = (
  snapshot: ActivityRecord,
  accountMap: AccountToIdentityRecord
): UserActivityRow[] => {
  const rows: UserActivityRow[] = [];
  Object.keys(snapshot).forEach(activityId => {
    const activity = snapshot[activityId];
    const row: UserActivityRow = {
      id: activityId,
      date: new Date(activity.createdTimestamp),
      action: activity.action,
      eventType: activity.eventType,
      event: activity.event,
      artifact: activity.artifact,
      initiativeId: activity.initiativeId,
      launchItemId: activity.launchItemId,
      priority: activity.priority,
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

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);

  // validate url
  const { searchParams } = new URL(request.url);
  if (searchParams.get(SEARCH_PARAM_ACTION) != null) {
    const allActions = [...artifactActions.keys()];
    if (
      !searchParams
        .get(SEARCH_PARAM_ACTION)!
        .split(',')
        .every(actionParam => allActions.includes(actionParam))
    ) {
      throw new Response('Invalid action param', { status: 400 });
    }
  }

  try {
    const [initiatives, launchItems, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const userId = params.userid;
    const activityUserIds =
      userId && userId !== ALL ?
        getAllPossibleActivityUserIds(userId, identities.list, identities.accountMap)
      : [];

    return {
      ...sessionData,
      userId,
      activityUserIds,
      initiatives,
      launchItems,
      actors,
      accountMap: identities.accountMap,
    };
  } catch (e) {
    logger.error(e);
    throw loaderErrorResponse(e);
  }
};

export default function UserActivity() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activitiesFetcher = useFetcher();
  const fetchedActivity = activitiesFetcher.data as ActivityResponse;
  const [actionFilter, setActionFilter] = useState(
    searchParams.get(SEARCH_PARAM_ACTION)?.split(',') ?? []
  );
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
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
      if (actionFilter.length) {
        snapshot.current.forEach(userSnapshot => {
          const values = userSnapshot.values.filter(a =>
            actionFilter.includes(buildArtifactActionKey(a.artifact, a.action))
          );
          if (values.length) {
            filteredSnapshot.push({ key: userSnapshot.key, values });
          }
        });
      }
      setActivities(
        sortMap(actionFilter.length ? filteredSnapshot : snapshot.current, (a, b) =>
          sortAlphabetically ?
            caseInsensitiveCompare(
              loaderData.actors[a.key]?.name ?? '',
              loaderData.actors[b.key]?.name ?? ''
            )
          : b.count - a.count
        )
      );
    }
  }, [loaderData.actors, actionFilter, sortAlphabetically]);

  const setRows = useCallback(
    (querySnapshot: ActivityRecord) => {
      snapshot.current = groupByArray(
        userActivityRows(querySnapshot, loaderData.accountMap),
        'actorId'
      );
      sortAndSetUserActivities();
      setGotSnapshot(true);
    },
    [loaderData.accountMap, sortAndSetUserActivities]
  );

  useEffect(() => {
    if (loaderData.initiatives) {
      compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    }
    if (loaderData.launchItems) {
      compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
    }
  }, [loaderData.initiatives, loaderData.launchItems]);

  // load activities
  useEffect(() => {
    setGotSnapshot(false);
    const userIds = loaderData.userId === ALL ? ALL : loaderData.activityUserIds.join(',');
    const endDay = dayjs(dateFilter.endDay);
    activitiesFetcher.load(
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
      `/fetcher/activities/${userIds}?userList=true&start=${dateFilterToStartDate(dateFilter.dateRange, dayjs(dateFilter.endDay))}&end=${endOfDay(endDay)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]); // activitiesFetcher must be omitted

  useEffect(() => {
    if (fetchedActivity?.error?.status === 401) {
      navigate(loginWithRedirect());
    }
  }, [fetchedActivity?.error, navigate]);

  useEffect(() => {
    setGotSnapshot(false);
    if (fetchedActivity?.activities) {
      Object.values(fetchedActivity?.activities).forEach(activity => {
        if (!activity.initiativeId || !activity.launchItemId) {
          const mapping = mapActivity(activity);
          if (!activity.initiativeId) {
            activity.initiativeId = mapping.initiatives[0] ?? '';
          }
          if (!activity.launchItemId) {
            activity.launchItemId = mapping.launchItems[0] ?? '';
          }
        }
      });
      setRows(fetchedActivity.activities);
    }
  }, [fetchedActivity?.activities, setRows]);

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
      priorityColDef({ field: 'priority' }),
      {
        field: 'launchItemId',
        headerName: 'Launch',
        renderCell: params => {
          const launchItemId = params.value as string;
          return launchItemId ?
              <Box title={loaderData.launchItems[launchItemId]?.label}>
                {loaderData.launchItems[launchItemId]?.key}
              </Box>
            : <Box color={grey[400]}>unset</Box>;
        },
      },
      {
        field: 'initiativeId',
        headerName: 'Goal',
        renderCell: params => {
          const initiativeId = params.value as string;
          return initiativeId ?
              <Box title={loaderData.initiatives[initiativeId]?.label}>
                {loaderData.initiatives[initiativeId]?.key}
              </Box>
            : <Box color={grey[400]}>unset</Box>;
        },
      },

      descriptionColDef({ field: 'metadata' }, (element, content) =>
        setPopover({ element, content })
      ),
      metadataActionsColDef({}, (element: HTMLElement, metadata: unknown) =>
        setCodePopover({ element, content: metadata })
      ),
    ],
    [loaderData.initiatives, loaderData.launchItems]
  );

  let activityCount = 0;

  const actorList = [...activities.keys()].map((actorId, i) => {
    const actorActivityCount = activities.get(actorId)?.length ?? 0;
    activityCount += actorActivityCount;
    return (
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
          {loaderData.actors[actorId]?.name ?? 'Unknown'}
        </Link>
        {` (${actorActivityCount})`}
      </Box>
    );
  });

  const grids = [...activities]
    .filter(([actorId]) => !showOnlyActor || actorId === showOnlyActor)
    .filter((_, i) => showOnlyActor || i <= 9)
    .map(([actorId, rows], i) => {
      const actor = loaderData.actors[actorId];
      return (
        !!rows.length && (
          <Stack id={actorElementId(actorId ?? '-')} key={i} sx={{ mb: 3 }}>
            <Typography
              variant="h6"
              display="flex"
              alignItems="center"
              color={grey[600]}
              fontSize="1.1rem"
              mb={1}
            >
              <Box sx={{ mr: 1, textWrap: 'nowrap' }}>{actor?.name ?? 'Unknown user'}</Box>
              {actor?.accounts
                ?.filter(account => account.url)
                .map((account, i) => (
                  <IconButton
                    key={i}
                    component="a"
                    href={account.url}
                    target="_blank"
                    size="small"
                    color="primary"
                  >
                    {account.type === 'github' && <GitHubIcon sx={{ width: 15, height: 15 }} />}
                    {account.type === 'jira' && <JiraIcon width={15} height={15} />}
                  </IconButton>
                ))}
              {loaderData.userId === ALL && actorId && (
                <IconButton
                  component="a"
                  href={
                    `/activity/user/${encodeURI(actorId)}` +
                    (actionFilter ? `#${actionFilter.join(',')}` : '')
                  }
                  size="small"
                >
                  <OpenInNewIcon sx={{ width: 15, height: 15 }} />
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
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || navigation.state !== 'idle'}
    >
      {errorAlert(fetchedActivity?.error?.message)}
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyBuckets: true }}
      />
      <Popover
        id={popover?.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={() => setPopover(null)}
        onClick={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box py={1}>{popover?.content}</Box>
      </Popover>
      <Stack m={3}>
        <Stack direction="row">
          {loaderData.userId === ALL && (
            <Box display="flex" mr={2}>
              <Box sx={{ position: 'relative' }}>
                <Box fontSize="small" color={grey[700]} sx={{ ...stickySx }}>
                  <FormGroup sx={{ mb: 2, ml: 2 }}>
                    {activities.size > 0 && (
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
                  {actorList}
                </Box>
              </Box>
            </Box>
          )}
          <Stack flex={1} minWidth={0}>
            <Grid container columns={2} spacing={2} alignItems="center" mb={1}>
              <Grid>
                {loaderData.userId !== ALL && (
                  <Button
                    variant="outlined"
                    href={
                      '/activity/user/*' +
                      (actionFilter.length ? `?action=${actionFilter.join(',')}` : '')
                    }
                    sx={{ textTransform: 'none', textWrap: 'nowrap' }}
                  >
                    {'See all contributors'}
                  </Button>
                )}
              </Grid>
              <Grid flex={1}>
                <FilterMenu
                  multiple
                  selectedValue={actionFilter ?? ''}
                  items={[
                    ...[...artifactActions].map(([key, action]) => ({
                      value: key,
                      label: action.label,
                    })),
                  ]}
                  onChange={values => {
                    setActionFilter(values as string[]);
                    setSearchParams(prev => {
                      if (values.length) {
                        prev.set(SEARCH_PARAM_ACTION, (values as string[]).join(','));
                      } else {
                        prev.delete(SEARCH_PARAM_ACTION);
                      }
                      return prev;
                    });
                  }}
                  sx={{ justifyContent: 'right' }}
                />
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="right">
              {!!activityCount && (
                <Typography variant="subtitle2">
                  {activityCount.toLocaleString()} {pluralize('activity', activityCount)}
                </Typography>
              )}
            </Box>
            {grids}
          </Stack>
        </Stack>
      </Stack>
    </App>
  );
}
