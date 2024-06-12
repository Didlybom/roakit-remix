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
import {
  artifactActions,
  buildArtifactActionKey,
  getSummary,
  identifyAccounts,
} from '../types/activityFeed';
import type {
  AccountData,
  AccountToIdentityRecord,
  ActivityData,
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
): ActivityData[] => {
  const rows: ActivityData[] = [];
  Object.keys(snapshot).forEach(activityId => {
    const activity = snapshot[activityId];
    const row: ActivityData = {
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
  const [groupBy, setGroupBy] = useState(
    (searchParams.get(SEARCH_PARAM_GROUPBY) as GroupBy) ?? GroupBy.Contributor
  );
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [searchTerm] = useDebounce(searchFilter, 50);
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const [sortAlphabetically, setSortAlphabetically] = useState(false);
  const [scrollToGroup, setScrollToGroup] = useState<string | undefined>(undefined);
  const [showOnlyActor, setShowOnlyActor] = useState<string | undefined>(undefined);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );
  const [isRendering, setIsRendering] = useState(false);
  const snapshot = useRef<{ key: string; values: ActivityData[] }[]>();
  const [activities, setActivities] = useState<Map<string, ActivityData[]>>(new Map());

  const groupElementId = (id: string) => `GROUP-${id ? removeSpaces(id) : id}`;

  const sortAndSetUserActivities = useCallback(() => {
    const getLabelForKey = (key: string) =>
      groupBy === GroupBy.Contributor ?
        loaderData.actors[key]?.name ?? 'ZZZ'
      : loaderData.launchItems[key]?.label ?? 'ZZZ';

    if (snapshot.current) {
      const filteredSnapshot: { key: string; values: ActivityData[] }[] = [];
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
            caseInsensitiveCompare(getLabelForKey(a.key), getLabelForKey(b.key))
          : (b.key ? b.count : 0) - (a.key ? a.count : 0)
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
    setIsRendering(false);
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
      Object.values(fetchedActivity.activities).forEach(activity => {
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
      snapshot.current = groupByArray(
        userActivityRows(fetchedActivity.activities, loaderData.accountMap),
        groupBy === GroupBy.Contributor ? 'actorId' : 'launchItemId'
      );
      sortAndSetUserActivities();
      setIsRendering(true);
    }
  }, [fetchedActivity?.activities, groupBy, loaderData.accountMap, sortAndSetUserActivities]);

  useEffect(() => {
    sortAndSetUserActivities();
  }, [actionFilter, sortAlphabetically, sortAndSetUserActivities]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToGroup != null) {
      const element = document.getElementById(groupElementId(scrollToGroup));
      setScrollToGroup(undefined);
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
        field: 'createdTimestamp',
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
      priorityColDef({ field: 'priority' }),
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
                : <Box color={grey[400]}>unset</Box>;
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
    [groupBy, loaderData.userId, loaderData.actors, loaderData.launchItems, loaderData.initiatives]
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
            {loaderData.actors[actorId]?.name ?? 'Unknown'}
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
    if (loaderData.userId !== ALL || groupBy !== GroupBy.Launch) {
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
  }, [activities, groupBy, loaderData.launchItems, loaderData.userId]);

  const activityCount = actorActivityCount ?? launchActivityCount;

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
                (actionFilter ? `#${actionFilter.join(',')}` : '')
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

  const gridsByContributor = useCallback(
    () =>
      groupBy === GroupBy.Contributor ?
        [...activities]
          .filter(([actorId]) => showOnlyActor == null || (actorId ?? '') === showOnlyActor)
          .filter((_, i) => showOnlyActor != null || i <= 9)
          .map(([actorId, rows], i) => {
            const search = searchTerm.trim().toLowerCase();
            const filteredRows =
              search ?
                rows.filter(activity => {
                  if (!activity.metadata) {
                    return false;
                  }
                  const summary = getSummary(activity); // FIXME consider precalculating the summary
                  return summary && summary.toLowerCase().indexOf(search) >= 0;
                })
              : rows;
            return filteredRows.length === 0 ?
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
          })
      : null,
    [activities, actorHeader, columns, groupBy, searchTerm, showOnlyActor]
  );

  const gridsByLaunch = useCallback(() => {
    return groupBy === GroupBy.Launch ?
        <Stack>
          {loaderData.userId !== ALL && <Box mb={1}>{actorHeader(loaderData.userId!)}</Box>}
          {[...activities].map(([launchId, rows], i) => {
            let launchLabel;
            if (!launchId) {
              launchLabel = 'No launch item';
            } else {
              launchLabel = loaderData.launchItems[launchId]?.label ?? 'Unknown launch item';
            }
            const search = searchTerm.trim().toLowerCase();
            const filteredRows =
              search ?
                rows.filter(activity => {
                  if (!activity.metadata) {
                    return false;
                  }
                  const summary = getSummary(activity); // FIXME consider precalculating the summary
                  return summary && summary.toLowerCase().indexOf(search) >= 0;
                })
              : rows;
            return filteredRows.length === 0 ?
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
      : null;
  }, [
    activities,
    actorHeader,
    columns,
    groupBy,
    loaderData.launchItems,
    loaderData.userId,
    searchTerm,
  ]);

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!isRendering || navigation.state !== 'idle'}
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
                              setIsRendering(false);
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
                      '/activity/user/*' +
                      (actionFilter.length ? `?action=${actionFilter.join(',')}` : '')
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
                      selectedValue={groupBy}
                      items={[
                        {
                          value: GroupBy.Contributor,
                          label: loaderData.userId === ALL ? 'by Contributor' : 'None',
                          color: loaderData.userId === ALL ? undefined : grey[500],
                        },
                        { value: GroupBy.Launch, label: 'by Launch' },
                      ]}
                      onChange={value => {
                        setActivities(new Map());
                        setIsRendering(false);
                        setGroupBy(value as GroupBy);
                        setSearchParams(prev => {
                          if (loaderData.userId !== ALL && value == GroupBy.Contributor) {
                            prev.delete(SEARCH_PARAM_GROUPBY);
                          } else {
                            prev.set(SEARCH_PARAM_GROUPBY, value as string);
                          }
                          return prev;
                        });
                      }}
                      label="Group"
                      sx={{ justifyContent: 'right' }}
                    />
                  </Grid>
                  <Grid>
                    <FilterMenu
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
                      sx={{ justifyContent: 'right' }}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
            <Box display="flex" justifyContent="right">
              {!!activityCount && (
                <Typography variant="subtitle2">
                  {activityCount.toLocaleString()} {pluralize('activity', activityCount)}
                </Typography>
              )}
            </Box>
            {groupBy === GroupBy.Contributor ? gridsByContributor() : gridsByLaunch()}
          </Stack>
        </Stack>
      </Stack>
    </App>
  );
}
