import {
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  FormGroup,
  Unstable_Grid2 as Grid,
  IconButton,
  InputAdornment,
  Link,
  Popover,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { DataGrid, GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
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
import { useDebounce } from 'use-debounce';
import { MapperType, compileActivityMappers, mapActivity } from '../activityMapper/activityMapper';
import App from '../components/App';
import CodePopover, { CodePopoverContent } from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import {
  actionColDef,
  actorColDef,
  dataGridCommonProps,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import {
  artifactActions,
  buildArtifactActionKey,
  getSummary,
  identifyAccounts,
} from '../types/activityFeed';
import type {
  AccountData,
  AccountToIdentityRecord,
  Activity,
  ActivityRecord,
} from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate, endOfDay, formatYYYYMMDD } from '../utils/dateUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  errorAlert,
  internalLinkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
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
const SEARCH_PARAM_GROUPBY = 'groupby';

const userActivityRows = (
  snapshot: ActivityRecord,
  accountMap: AccountToIdentityRecord
): Activity[] => {
  const rows: Activity[] = [];
  Object.keys(snapshot).forEach(activityId => {
    const activity = snapshot[activityId];
    const row: Activity = {
      id: activityId,
      ...activity,
      actorId:
        activity.actorId ?
          accountMap[activity.actorId] ?? activity.actorId // resolve identity
        : undefined,
    };
    rows.push(row);
  });
  return rows;
};

enum GroupBy {
  Contributor = 'contributor',
  Launch = 'launch',
}

const groupActivityKey: Record<GroupBy, keyof Activity> = {
  [GroupBy.Contributor]: 'actorId',
  [GroupBy.Launch]: 'launchItemId',
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
  if (
    searchParams.get(SEARCH_PARAM_GROUPBY) &&
    !Object.values<string>(GroupBy).includes(searchParams.get(SEARCH_PARAM_GROUPBY)!)
  ) {
    throw new Response('Invalid groupby param', { status: 400 });
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
  const [groupBy, setGroupBy] = useState<GroupBy | null>(
    searchParams.get(SEARCH_PARAM_GROUPBY) as GroupBy
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchTerm] = useDebounce(searchFilter.trim().toLowerCase(), 50);
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [scrollToGroup, setScrollToGroup] = useState<string | null>(null);
  const [showOnlyActor, setShowOnlyActor] = useState<string | null>(null);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [isRendering, setIsRendering] = useState(false);
  const snapshot = useRef<{ key: string | null; values: Activity[] }[]>();
  const [activities, setActivities] = useState<Map<string | null, Activity[]>>(new Map());
  const [totalActivityCount, setTotalActivityCount] = useState<number | null>(null);

  const groupElementId = (id: string) => `GROUP-${id ? removeSpaces(id) : id}`;

  const sortAndSetUserActivities = useCallback(() => {
    const getLabelForKey = (key: string) => {
      if (groupBy === GroupBy.Contributor) {
        return loaderData.actors[key]?.name ?? 'ZZZ';
      }
      if (groupBy === GroupBy.Launch) {
        return loaderData.launchItems[key]?.label ?? 'ZZZ';
      }
      return '';
    };

    if (snapshot.current) {
      const filteredSnapshot: { key: string | null; values: Activity[] }[] = [];
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
        sortMap(
          actionFilter.length ? filteredSnapshot : snapshot.current,
          groupBy ?
            (a, b) =>
              sortAlphabetically ?
                caseInsensitiveCompare(getLabelForKey(a.key), getLabelForKey(b.key))
              : (b.key ? b.count : 0) - (a.key ? a.count : 0)
          : null
        )
      );
    }
  }, [groupBy, loaderData.actors, loaderData.launchItems, actionFilter, sortAlphabetically]);

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
    setIsRendering(true);
    const userIds = loaderData.userId === ALL ? ALL : loaderData.activityUserIds.join(',');
    const endDay = dayjs(dateFilter.endDay);
    activitiesFetcher.load(
      `/fetcher/activities/${userIds}?userList=true&start=${dateFilterToStartDate(dateFilter.dateRange, dayjs(dateFilter.endDay))}&end=${endOfDay(endDay)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]); // activitiesFetcher must be omitted

  useEffect(() => {
    if (fetchedActivity?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivity?.error, navigate]);

  useEffect(() => {
    if (fetchedActivity?.activities) {
      let activityCount = 0;
      Object.values(fetchedActivity.activities).forEach(activity => {
        activityCount++;
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
      setTotalActivityCount(activityCount);
      snapshot.current = groupByArray(
        userActivityRows(fetchedActivity.activities, loaderData.accountMap),
        groupBy ? groupActivityKey[groupBy] : null
      );
      sortAndSetUserActivities();
      setIsRendering(false);
    }
  }, [fetchedActivity?.activities, groupBy, loaderData.accountMap, sortAndSetUserActivities]);

  useEffect(() => {
    sortAndSetUserActivities();
  }, [actionFilter, sortAlphabetically, sortAndSetUserActivities]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToGroup != null) {
      const element = document.getElementById(groupElementId(scrollToGroup));
      setScrollToGroup(null);
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
  }, [scrollToGroup]);

  const columns = useMemo<GridColDef[]>(
    () => [
      dateColDef({
        field: 'timestamp',
        valueGetter: value => (value ? new Date(value) : value),
      }),
      ...(groupBy !== GroupBy.Contributor && loaderData.userId === ALL ?
        [
          actorColDef({
            field: 'actorId',
            valueGetter: (value: string) =>
              value ?
                ({
                  id: value,
                  name: loaderData.actors[value]?.name ?? 'unknown',
                } as AccountData)
              : '',
          }),
        ]
      : []),
      actionColDef({ field: 'action' }),
      ...(groupBy !== GroupBy.Launch ?
        [
          {
            field: 'launchItemId',
            headerName: 'Launch',
            renderCell: (params: GridRenderCellParams) => {
              const launchItemId = params.value as string;
              return launchItemId ?
                  <Box title={loaderData.launchItems[launchItemId]?.label}>
                    {loaderData.launchItems[launchItemId]?.key}
                  </Box>
                : null;
            },
          },
        ]
      : []),
      {
        field: 'initiativeId',
        headerName: 'Goal',
        renderCell: params => {
          const initiativeId = params.value as string;
          return initiativeId ?
              <Box title={loaderData.initiatives[initiativeId]?.label}>
                {loaderData.initiatives[initiativeId]?.key}
              </Box>
            : null;
        },
      },
      descriptionColDef({ field: 'metadata' }, (element, content) =>
        setPopover({ element, content })
      ),
      priorityColDef({ field: 'priority' }),
      viewJsonActionsColDef({}, (element: HTMLElement, data: unknown) => {
        const { id, ...content } = data as Activity;
        setCodePopover({ element, content: { ...content, activityId: id } });
      }),
    ],
    [groupBy, loaderData.userId, loaderData.actors, loaderData.launchItems, loaderData.initiatives]
  );

  const actorHeader = useCallback(
    (actorId: string) => {
      const actor = loaderData.actors[actorId];
      return (
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
                (actionFilter.length ? `?action=${actionFilter.join(',')}` : '')
              }
              size="small"
            >
              <OpenInNewIcon sx={{ width: 15, height: 15 }} />
            </IconButton>
          )}
        </Typography>
      );
    },
    [actionFilter, loaderData.actors, loaderData.userId]
  );

  const [actorList, actorActivityCount] = useMemo(() => {
    if (loaderData.userId !== ALL || groupBy !== GroupBy.Contributor) {
      return [null, null];
    }
    let activityCount = 0;
    const actorList = [...activities.keys()].map((actorId, i) => {
      const actorActivityCount = activities.get(actorId)?.length ?? 0;
      activityCount += actorActivityCount;
      return (
        <Box
          key={i}
          mb={!sortAlphabetically && i === 9 ? 2 : undefined}
          color={actorId ? undefined : grey[500]}
        >
          <Link
            sx={internalLinkSx}
            color={actorId ? undefined : grey[500]}
            onClick={() => {
              if (!sortAlphabetically && i <= 9 && showOnlyActor == null) {
                setScrollToGroup(actorId);
              } else {
                setShowOnlyActor(actorId ?? '');
              }
            }}
          >
            {loaderData.actors[actorId ?? '']?.name ?? 'Unknown'}
          </Link>
          {` (${actorActivityCount})`}
        </Box>
      );
    });
    return [actorList, activityCount];
  }, [
    activities,
    groupBy,
    loaderData.actors,
    loaderData.userId,
    showOnlyActor,
    sortAlphabetically,
  ]);

  const [launchList, launchActivityCount] = useMemo(() => {
    if (groupBy !== GroupBy.Launch) {
      return [null, null];
    }
    let activityCount = 0;
    const launchList = [...activities.keys()].map((launchId, i) => {
      const launchActivityCount = activities.get(launchId)?.length ?? 0;
      activityCount += launchActivityCount;
      let label;
      if (!launchId) {
        label = 'No launch item';
      } else {
        label = loaderData.launchItems[launchId]?.label ?? 'Unknown launch item';
      }
      return (
        <Box
          key={i}
          mb={i === 9 ? 2 : undefined}
          mt={launchId ? undefined : 2}
          color={launchId ? undefined : grey[500]}
        >
          <Link
            sx={internalLinkSx}
            color={launchId ? undefined : grey[500]}
            onClick={() => setScrollToGroup(launchId)}
          >
            {label}
          </Link>
          {` (${launchActivityCount})`}
        </Box>
      );
    });
    return [launchList, activityCount];
  }, [activities, groupBy, loaderData.launchItems]);

  const activityCount = actorActivityCount ?? launchActivityCount;

  const gridsByContributor = useMemo(() => {
    if (groupBy !== GroupBy.Contributor) {
      return null;
    }
    return [...activities]
      .filter(([actorId]) => showOnlyActor == null || (actorId ?? '') === showOnlyActor)
      .filter((_, i) => showOnlyActor != null || i <= 9)
      .map(([actorId, rows], i) => {
        const filteredRows =
          searchTerm ?
            rows.filter(activity => {
              if (!activity.metadata) {
                return false;
              }
              const summary = getSummary(activity); // FIXME consider precalculating the summary
              return summary && summary.toLowerCase().indexOf(searchTerm) >= 0;
            })
          : rows;
        return !filteredRows?.length || actorId == null ?
            null
          : <Stack id={groupElementId(actorId)} key={i} sx={{ mb: 3 }}>
              {actorHeader(actorId)}
              <DataGrid
                columns={columns}
                rows={filteredRows}
                {...dataGridCommonProps}
                rowHeight={50}
              />
            </Stack>;
      });
  }, [activities, actorHeader, columns, groupBy, searchTerm, showOnlyActor]);

  const gridsByLaunch = useMemo(() => {
    if (groupBy !== GroupBy.Launch) {
      return null;
    }
    return (
      <Stack>
        {loaderData.userId !== ALL && <Box mb={1}>{actorHeader(loaderData.userId!)}</Box>}
        {[...activities].map(([launchId, rows], i) => {
          let launchLabel;
          if (!launchId) {
            launchLabel = 'No launch item';
          } else {
            launchLabel = loaderData.launchItems[launchId]?.label ?? 'Unknown launch item';
          }
          const filteredRows =
            searchTerm ?
              rows.filter(activity => {
                if (!activity.metadata) {
                  return false;
                }
                const summary = getSummary(activity); // FIXME consider precalculating the summary
                return summary && summary.toLowerCase().indexOf(searchTerm) >= 0;
              })
            : rows;
          return !filteredRows?.length || launchId == null ?
              null
            : <Stack id={groupElementId(launchId)} key={i} sx={{ mb: 3 }}>
                <Typography
                  variant="h6"
                  color={grey[launchId ? 600 : 400]}
                  fontSize="1.1rem"
                  mb={1}
                  sx={{ textWrap: 'nowrap' }}
                >
                  {launchLabel}
                </Typography>
                <DataGrid
                  columns={columns}
                  rows={filteredRows}
                  {...dataGridCommonProps}
                  rowHeight={50}
                />
              </Stack>;
        })}
      </Stack>
    );
  }, [
    activities,
    actorHeader,
    columns,
    groupBy,
    loaderData.launchItems,
    loaderData.userId,
    searchTerm,
  ]);

  const gridsUngrouped = useMemo(() => {
    if (groupBy != null) {
      return null;
    }
    const rows = activities.get(null)!;
    const filteredRows =
      searchTerm ?
        rows.filter(activity => {
          if (!activity.metadata) {
            return false;
          }
          const summary = getSummary(activity); // FIXME consider precalculating the summary
          return summary && summary.toLowerCase().indexOf(searchTerm) >= 0;
        })
      : rows;
    return !filteredRows?.length ?
        null
      : <DataGrid
          columns={columns}
          rows={filteredRows}
          {...dataGridCommonProps}
          rowHeight={50}
          sx={{ mt: 1 }}
        />;
  }, [activities, columns, groupBy, searchTerm]);

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={isRendering || navigation.state !== 'idle'}
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
          {groupBy && (loaderData.userId === ALL || groupBy === GroupBy.Launch) && (
            <Box mr={2} display={{ xs: 'none', sm: 'flex' }}>
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
                              setIsRendering(true);
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
                  {launchList}
                </Box>
              </Box>
            </Box>
          )}
          <Stack flex={1} minWidth={0}>
            <Grid container columns={3} spacing={2} alignItems="center" mb={1}>
              <Grid>
                {loaderData.userId !== ALL && (
                  <Button
                    variant="outlined"
                    href={
                      '/activity/user/*?groupby=' +
                      (groupBy === GroupBy.Launch ? 'launch' : 'contributor') +
                      (actionFilter.length ? `&action=${actionFilter.join(',')}` : '')
                    }
                    sx={{ textTransform: 'none', textWrap: 'nowrap' }}
                  >
                    {'See all contributors'}
                  </Button>
                )}
              </Grid>
              <Grid flex={1} />
              <Grid>
                <Grid container spacing={3}>
                  <Grid>
                    <TextField
                      autoComplete="off"
                      value={searchFilter}
                      placeholder="Search"
                      title="Search descriptions"
                      size="small"
                      sx={{ width: '16ch', minWidth: '150px' }}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                      onChange={e => setSearchFilter(e.target.value)}
                    />
                  </Grid>
                  <Grid>
                    <FilterMenu
                      label="Group"
                      selectedValue={groupBy ?? ''}
                      items={[
                        { value: '', label: 'None', color: grey[500] },
                        ...(loaderData.userId === ALL ?
                          [{ value: GroupBy.Contributor, label: 'by Contributor' }]
                        : []),
                        { value: GroupBy.Launch, label: 'by Launch' },
                      ]}
                      onChange={value => {
                        setActivities(new Map());
                        setTotalActivityCount(null);
                        setIsRendering(true);
                        setGroupBy((value as GroupBy) || null); // will trigger effect to re-set activities
                        setSearchParams(prev => {
                          if (value === '') {
                            prev.delete(SEARCH_PARAM_GROUPBY);
                          } else {
                            prev.set(SEARCH_PARAM_GROUPBY, value as string);
                          }
                          return prev;
                        });
                      }}
                    />
                  </Grid>
                  <Grid>
                    <FilterMenu
                      label="Activity Type"
                      multiple
                      selectedValue={actionFilter}
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
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="right">
              {activityCount != null &&
                totalActivityCount != null &&
                activityCount !== totalActivityCount && (
                  <Typography variant="subtitle2">
                    {activityCount.toLocaleString()} / {totalActivityCount.toLocaleString()}{' '}
                    {pluralize('activity', totalActivityCount)}
                  </Typography>
                )}
              {activityCount != null && activityCount === totalActivityCount && (
                <Typography variant="subtitle2">
                  {activityCount.toLocaleString()} {pluralize('activity', activityCount)}
                </Typography>
              )}
            </Box>
            {gridsByContributor}
            {gridsByLaunch}
            {gridsUngrouped}
          </Stack>
        </Stack>
      </Stack>
    </App>
  );
}
