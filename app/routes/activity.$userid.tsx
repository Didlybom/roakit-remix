import {
  RssFeed as FeedIcon,
  GitHub as GitHubIcon,
  AccountTree as GroupIcon,
  OpenInNew as OpenInNewIcon,
  SortByAlpha as SortByAlphaIcon,
  Timelapse as SortByEffortIcon,
  Functions as SortByTotalIcon,
  Sort as SortIcon,
  ZoomOutMap as ZoomOutIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  Grid2 as Grid,
  IconButton,
  Link,
  Pagination,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import type { GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import { DataGrid } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from '@remix-run/react';
import dayjs from 'dayjs';
import pluralize from 'pluralize';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';
import App from '../components/App';
import type { BoxPopoverContent } from '../components/BoxPopover';
import BoxPopover from '../components/BoxPopover';
import type { CodePopoverContent } from '../components/CodePopover';
import CodePopover from '../components/CodePopover';
import {
  actionColDef,
  actorColDef,
  dataGridCommonProps,
  dateColDef,
  descriptionColDef,
  priorityColDef,
  sortComparatorKeepingNullAtTheBottom,
  viewJsonActionsColDef,
} from '../components/datagrid/dataGridCommon';
import SearchField from '../components/forms/SearchField';
import FilterMenu from '../components/forms/SelectFilter';
import SmallChip from '../components/SmallChip';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import JiraIcon from '../icons/Jira';
import { getActivityDescription } from '../processors/activityDescription';
import {
  accountUrlToWeb,
  activitiesTotalEffort,
  artifactActions,
  buildArtifactActionKey,
} from '../processors/activityFeed';
import { identifyAccounts } from '../processors/activityIdentifier';
import { compileActivityMappers, mapActivity } from '../processors/activityMapper';
import {
  PHASES,
  type Account,
  type AccountToIdentityRecord,
  type Activity,
  type ActivityRecord,
} from '../types/types';
import { loadAndValidateSession } from '../utils/authUtils.server';
import {
  DateRange,
  dateFilterToStartDate,
  endOfDay,
  formatYYYYMMDD,
  type DateRangeEnding,
} from '../utils/dateUtils';
import { RoakitError } from '../utils/errorUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  HEADER_HEIGHT,
  desktopDisplaySx,
  errorAlert,
  getSearchParam,
  linkSx,
  loaderErrorResponse,
  loginWithRedirectUrl,
  verticalStickyBarSx,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { groupByArray, sortMap } from '../utils/mapUtils';
import { View } from '../utils/rbac';
import { caseInsensitiveCompare, removeSpaces } from '../utils/stringUtils';
import theme from '../utils/theme';
import type { ActivityResponse } from './fetcher.activities.($userid)';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'User';
  if (data?.userId && data.userId !== ALL) {
    title = data.actors[data.userId]?.name ?? 'Contributor';
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
  Object.entries(snapshot).forEach(([activityId, activity]) => {
    const row: Activity = {
      ...activity,
      actorId:
        activity.actorId ?
          (accountMap[activity.actorId] ?? activity.actorId) // resolve identity
        : undefined,
    };
    rows.push(row);
  });
  return rows;
};

enum GroupBy {
  Contributor = 'contributor',
  Initiative = 'initiative',
}

enum SortActorsBy {
  Name = 'name',
  Total = 'total',
  Effort = 'effort',
}

const groupActivityKey: Record<GroupBy, keyof Activity> = {
  [GroupBy.Contributor]: 'actorId',
  [GroupBy.Initiative]: 'initiativeId',
};

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW);

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
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const userIdentity = identities.list.find(identity => identity.email === sessionData.email);
    if (!userIdentity) {
      throw new RoakitError('Identity not found', { httpStatus: 500 });
    }

    const userId = params.userid;
    const activityUserIds =
      userId && userId !== ALL ?
        getAllPossibleActivityUserIds([userId], identities.list, identities.accountMap)
      : [];

    return {
      ...sessionData,
      userId,
      identityId: userIdentity.id,
      activityUserIds,
      initiatives,
      actors,
      accountMap: identities.accountMap,
    };
  } catch (e) {
    getLogger('route:activity.user').error(e);
    throw loaderErrorResponse(e);
  }
};

export default function UserActivity() {
  const loaderData = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activitiesFetcher = useFetcher<ActivityResponse>();
  const fetchedActivity = activitiesFetcher.data;
  const [actionFilter, setActionFilter] = useState(
    searchParams.get(SEARCH_PARAM_ACTION)?.split(',') ?? []
  );
  const [groupBy, setGroupBy] = useState<GroupBy | null>(
    searchParams.get(SEARCH_PARAM_GROUPBY) as GroupBy
  );
  const [searchFilter, setSearchFilter] = useState('');
  const [searchTerm] = useDebounce(searchFilter.trim().toLowerCase(), 50);
  const [dateFilter, setDateFilter] = useState(
    loaderData.dateFilter ?? { dateRange: DateRange.OneDay, endDay: formatYYYYMMDD(dayjs()) }
  );
  const [sortActors, setSortActors] = useState<SortActorsBy>(SortActorsBy.Total);
  const [scrollToGroup, setScrollToGroup] = useState<string | null | undefined>(null);
  const [showOnlyActor, setShowOnlyActor] = useState<string | null>(null);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const snapshot = useRef<{ key: string | null; values: Activity[] }[]>();
  const [activities, setActivities] = useState<Map<string | null, Activity[]>>(new Map());
  const [totalActivityCount, setTotalActivityCount] = useState<number | null>(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });

  const groupElementId = (id: string) => `GROUP-${id ? removeSpaces(id) : id}`;

  const reset = useCallback(() => {
    setActivities(new Map());
    setTotalActivityCount(null);
    setIsRendering(true);
    setPaginationModel({ ...paginationModel, page: 0 });
  }, [paginationModel]);

  const sortAndSetUserActivities = useCallback(() => {
    const getLabelForKey = (key: string | null) => {
      if (key == null) {
        return 'ZZZ';
      }
      if (groupBy === GroupBy.Contributor) {
        return loaderData.actors[key]?.name ?? 'ZZZ';
      }
      if (groupBy === GroupBy.Initiative) {
        return loaderData.initiatives[key]?.label ?? 'ZZZ';
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
            (a, b) => {
              if (sortActors === SortActorsBy.Name) {
                return caseInsensitiveCompare(getLabelForKey(a.key), getLabelForKey(b.key));
              }
              if (sortActors === SortActorsBy.Total) {
                if (!a.key) return 1;
                if (!b.key) return -1;
                return b.values.length - a.values.length;
              }
              if (sortActors === SortActorsBy.Effort) {
                return (
                  b.values.reduce((total, el) => total + (el.effort ?? 0), 0) -
                  a.values.reduce((total, el) => total + (el.effort ?? 0), 0)
                );
              }
              return 0;
            }
          : null
        )
      );
    }
  }, [groupBy, loaderData.actors, loaderData.initiatives, actionFilter, sortActors]);

  const fetchActivities = useCallback((dateFilter: DateRangeEnding) => {
    setIsRendering(true);
    const userIds = loaderData.userId === ALL ? ALL : loaderData.activityUserIds.join(',');
    const endDay = Math.min(endOfDay(dateFilter.endDay), Date.now());
    activitiesFetcher.load(
      `/fetcher/activities/${userIds}?userList=true&start=${dateFilterToStartDate(dateFilter.dateRange, dayjs(dateFilter.endDay))}&end=${endDay}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    compileActivityMappers(loaderData.initiatives);
  }, [loaderData.initiatives]);

  // load activities
  useEffect(() => {
    fetchActivities(dateFilter);
  }, [dateFilter, fetchActivities]);

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
        if (!activity.initiativeId) {
          activity.initiativeId = mapActivity(activity)[0] ?? '';
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
  }, [actionFilter, sortActors, sortAndSetUserActivities]);

  // Auto scrollers
  useEffect(() => {
    if (scrollToGroup != null) {
      const element = document.getElementById(groupElementId(scrollToGroup));
      setScrollToGroup(null);
      if (element) {
        setTimeout(
          () =>
            window.scrollTo({
              top: element.getBoundingClientRect().top + window.scrollY - HEADER_HEIGHT - 3,
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
        valueGetter: (value: number) => (value ? new Date(value) : value),
      }),
      ...(groupBy !== GroupBy.Contributor && loaderData.userId === ALL ?
        [
          actorColDef(
            {
              field: 'actorId',
              valueGetter: (value: string) =>
                value ?
                  ({ id: value, name: loaderData.actors[value]?.name ?? 'unknown' } as Account)
                : null,
            },
            true /* show link */
          ),
        ]
      : []),
      actionColDef({ field: 'action' }),
      ...(groupBy !== GroupBy.Initiative ?
        [
          {
            field: 'initiativeId',
            headerName: 'Initiative',
            valueGetter: (value: string) => loaderData.initiatives[value]?.key,
            getSortComparator: sortComparatorKeepingNullAtTheBottom,
            renderCell: (params: GridRenderCellParams<Activity, string>) => {
              const activity = params.row;
              return activity.initiativeId ?
                  <Link
                    onClick={() => {
                      reset();
                      setGroupBy(GroupBy.Initiative);
                      setSearchParams(
                        prev => getSearchParam(prev, SEARCH_PARAM_GROUPBY, GroupBy.Initiative),
                        { preventScrollReset: true }
                      );
                      setTimeout(() => setScrollToGroup(activity.initiativeId), 0);
                    }}
                    title={loaderData.initiatives[activity.initiativeId]?.label}
                    sx={linkSx}
                    color={loaderData.initiatives[activity.initiativeId]?.color ?? undefined}
                  >
                    {params.value}
                  </Link>
                : null;
            },
          },
        ]
      : []),
      descriptionColDef(
        { field: 'metadata' },
        (element, content) => setPopover({ element, content }),
        {
          ticketBaseUrl: loaderData.customerSettings?.ticketBaseUrl,
          actors: loaderData.actors,
          accountMap: loaderData.accountMap,
        }
      ),
      priorityColDef({ field: 'priority' }),
      {
        field: 'phase',
        headerName: 'Phase',
        valueGetter: (value: string) => PHASES.get(value)?.label ?? value,
      },
      { field: 'effort', headerName: 'Hours' },
      viewJsonActionsColDef({}, (element: HTMLElement, content: unknown) =>
        setCodePopover({ element, content })
      ),
    ],
    [
      groupBy,
      loaderData.userId,
      loaderData.customerSettings?.ticketBaseUrl,
      loaderData.actors,
      loaderData.accountMap,
      loaderData.initiatives,
      reset,
      setSearchParams,
    ]
  );

  const actorHeader = useCallback(
    (actorId: string) => {
      const actor = loaderData.actors[actorId];
      return (
        <Typography
          variant={loaderData.userId === ALL ? 'h6' : 'h3'}
          color={theme.palette.grey[600]}
          fontSize="1.1rem"
        >
          <Stack direction="row" alignItems="center">
            <Box sx={{ mr: 1, textWrap: 'nowrap' }}>{actor?.name ?? 'Unknown user'}</Box>
            {actor?.accounts
              ?.filter(account => account.url)
              .map((account, i) => (
                <IconButton
                  key={i}
                  component="a"
                  href={accountUrlToWeb(account)}
                  target="_blank"
                  title="Go to external profile"
                  size="small"
                  color="primary"
                >
                  {account.type === 'github' && <GitHubIcon sx={{ width: 15, height: 15 }} />}
                  {account.type === 'jira' && <JiraIcon sx={{ width: 15, height: 15 }} />}
                </IconButton>
              ))}
            {loaderData.userId === ALL && actorId && (
              <IconButton
                component="a"
                href={
                  `/activity/${encodeURI(actorId)}` +
                  (actionFilter.length ? `?action=${actionFilter.join(',')}` : '')
                }
                title="Open in single view"
                size="small"
                color="primary"
              >
                <OpenInNewIcon sx={{ width: 15, height: 15 }} />
              </IconButton>
            )}
            <IconButton
              component="a"
              href={`/feed/${encodeURI(actorId)}`}
              title="Go to feed"
              size="small"
              color="primary"
            >
              <FeedIcon sx={{ width: 15, height: 15 }} />
            </IconButton>
          </Stack>
        </Typography>
      );
    },
    [actionFilter, loaderData.actors, loaderData.userId]
  );

  const [actorList, actorActivityCount] = useMemo(() => {
    if (loaderData.userId !== ALL || groupBy !== GroupBy.Contributor) {
      return [null, null];
    }
    let actorActivityCount = 0;
    const actorList = [...activities.keys()].map((actorId, i) => {
      const actorActivities = activities.get(actorId);
      const activityCount = actorActivities?.length ?? 0;
      const effortTotal = actorActivities ? activitiesTotalEffort(actorActivities) : undefined;
      actorActivityCount += activityCount;
      const activityCountString = activityCount.toLocaleString();
      return (
        <Box
          key={i}
          mb={sortActors !== SortActorsBy.Name && i === 9 ? 2 : undefined}
          color={actorId ? undefined : theme.palette.grey[500]}
        >
          <Link
            sx={linkSx}
            color={actorId ? undefined : theme.palette.grey[500]}
            onClick={() => {
              if (sortActors !== SortActorsBy.Name && i <= 9 && showOnlyActor == null) {
                setScrollToGroup(actorId);
              } else {
                setShowOnlyActor(actorId ?? '');
                window.scrollTo({ top: 0 });
              }
            }}
          >
            {loaderData.actors[actorId ?? '']?.name ?? 'Unknown'}
          </Link>
          <SmallChip
            label={
              effortTotal != null ?
                `${activityCountString} / ${effortTotal}`
              : `${activityCountString}`
            }
            tooltip={
              effortTotal != null ?
                `${activityCountString} ${pluralize('activity', activityCount)} / effort: ${effortTotal.toLocaleString()}`
              : `${activityCountString} ${pluralize('activity', activityCount)}`
            }
            sx={{ ml: '5px', mt: '-2px' }}
          />
        </Box>
      );
    });
    return [actorList, actorActivityCount];
  }, [activities, groupBy, loaderData.actors, loaderData.userId, showOnlyActor, sortActors]);

  const [initiativeList, initiativeActivityCount] = useMemo(() => {
    if (groupBy !== GroupBy.Initiative) {
      return [null, null];
    }
    let initiativeActivityCount = 0;
    const initiativeList = [...activities.keys()].map((initiativeId, i) => {
      const activityCount = activities.get(initiativeId)?.length ?? 0;
      initiativeActivityCount += activityCount;
      let label;
      if (!initiativeId) {
        label = 'No initiative';
      } else {
        label = loaderData.initiatives[initiativeId]?.label || 'Unknown initiative';
      }
      return (
        <Box
          key={i}
          mb={i === 9 ? 2 : undefined}
          mt={initiativeId ? undefined : 2}
          color={initiativeId ? undefined : theme.palette.grey[500]}
        >
          <Link
            sx={{
              ...linkSx,
              '&:hover': {
                color:
                  initiativeId ?
                    loaderData.initiatives[initiativeId]?.color || undefined
                  : undefined,
              },
            }}
            color={initiativeId ? undefined : theme.palette.grey[500]}
            onClick={() => setScrollToGroup(initiativeId)}
          >
            {label}
          </Link>
          <SmallChip label={`${activityCount}`} sx={{ ml: '5px', mt: '-2px' }} />
        </Box>
      );
    });
    return [initiativeList, initiativeActivityCount];
  }, [activities, groupBy, loaderData.initiatives]);

  let activityCount = actorActivityCount ?? initiativeActivityCount;

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
              const summary = getActivityDescription(activity, { format: 'Grid' }); // FIXME consider precalculating
              return summary && summary.toLowerCase().indexOf(searchTerm) >= 0;
            })
          : rows;
        return !filteredRows?.length || actorId == null ?
            null
          : <Stack id={groupElementId(actorId)} key={i} sx={{ mb: 3 }}>
              <Box mb={1}>{actorHeader(actorId)}</Box>
              <DataGrid
                columns={columns}
                rows={filteredRows}
                loading={isRendering}
                {...dataGridCommonProps}
                rowHeight={50}
              />
            </Stack>;
      });
  }, [activities, actorHeader, columns, groupBy, isRendering, searchTerm, showOnlyActor]);

  const gridsByInitiative = useMemo(() => {
    if (groupBy !== GroupBy.Initiative) {
      return null;
    }
    return [...activities].map(([initiativeId, rows], i) => {
      let initiativeKey;
      let initiativeLabel;
      if (!initiativeId) {
        initiativeKey = '';
        initiativeLabel = 'No initiative';
      } else {
        initiativeKey = loaderData.initiatives[initiativeId]?.key ?? '';
        initiativeLabel = loaderData.initiatives[initiativeId]?.label ?? 'Unknown initiative';
      }
      const filteredRows =
        searchTerm ?
          rows.filter(activity => {
            if (
              activity.actorId &&
              (loaderData.actors[activity.actorId]?.name.toLowerCase().indexOf(searchTerm) ?? -1) >=
                0
            ) {
              return true;
            }
            const description = getActivityDescription(activity, { format: 'Grid' }); // FIXME consider precalculating
            return description && description.toLowerCase().indexOf(searchTerm) >= 0;
          })
        : rows;
      return !filteredRows?.length || initiativeId == null ?
          null
        : <Stack id={groupElementId(initiativeId)} key={i} sx={{ mb: 3 }}>
            <Stack
              direction="row"
              spacing={1}
              divider={<Divider orientation="vertical" flexItem />}
              color={theme.palette.grey[initiativeId ? 600 : 400]}
              mb={1}
              sx={{ textWrap: 'nowrap' }}
            >
              {initiativeKey && (
                <Typography
                  variant="h6"
                  fontSize="1.1rem"
                  fontWeight={600}
                  color={loaderData.initiatives[initiativeId]?.color || undefined}
                >
                  {initiativeKey}
                </Typography>
              )}
              <Typography variant="h6" fontSize="1.1rem">
                {initiativeLabel}
              </Typography>
            </Stack>
            <DataGrid
              columns={columns}
              rows={filteredRows}
              loading={isRendering}
              {...dataGridCommonProps}
              rowHeight={50}
            />
          </Stack>;
    });
  }, [
    activities,
    columns,
    groupBy,
    isRendering,
    loaderData.actors,
    loaderData.initiatives,
    searchTerm,
  ]);

  const [gridsUngrouped, ungroupedActivityCount] = useMemo(() => {
    if (groupBy != null) {
      return [null, null];
    }
    const rows = activities.get(null)!;
    const filteredRows =
      searchTerm ?
        rows.filter(activity => {
          if (
            activity.actorId &&
            (loaderData.actors[activity.actorId]?.name.toLowerCase().indexOf(searchTerm) ?? -1) >= 0
          ) {
            return true;
          }
          const description = getActivityDescription(activity, { format: 'Grid' }); // FIXME consider precalculating
          return description && description.toLowerCase().indexOf(searchTerm) >= 0;
        })
      : rows;
    return [
      !filteredRows?.length ?
        null
      : <>
          <Pagination
            siblingCount={0}
            count={Math.round(filteredRows.length / paginationModel.pageSize)}
            page={paginationModel.page + 1}
            showFirstButton
            showLastButton
            onChange={(_, page) => setPaginationModel({ ...paginationModel, page: page - 1 })}
            size="small"
            sx={{ mb: 1 }}
          />
          <DataGrid
            columns={columns}
            rows={filteredRows}
            loading={isRendering}
            {...dataGridCommonProps}
            rowHeight={50}
            sx={{ mt: 1 }}
            paginationModel={paginationModel}
            onPaginationModelChange={newPaginationModel => setPaginationModel(newPaginationModel)}
          />
        </>,
      filteredRows?.length,
    ];
  }, [activities, columns, groupBy, isRendering, loaderData.actors, paginationModel, searchTerm]);

  if (groupBy == null) {
    activityCount = ungroupedActivityCount;
  }

  const navBar =
    (
      groupBy &&
      (loaderData.userId === ALL || groupBy === GroupBy.Initiative) &&
      activities.size > 0
    ) ?
      <Box mr={2} sx={desktopDisplaySx}>
        <Box sx={{ position: 'relative' }}>
          <Box fontSize="small" color={theme.palette.grey[700]} sx={verticalStickyBarSx}>
            <FormControl sx={{ mb: 2 }}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <SortIcon fontSize="small" />
                <ToggleButtonGroup
                  size="small"
                  value={sortActors}
                  exclusive
                  onChange={(_, sortValue) => {
                    setIsRendering(true);
                    setSortActors(sortValue as SortActorsBy);
                    window.scrollTo({ top: 0 });
                  }}
                  sx={{ '& .MuiToggleButton-root': { py: '2px', textTransform: 'none' } }}
                >
                  <ToggleButton
                    value={SortActorsBy.Name}
                    title={
                      groupBy === GroupBy.Initiative ?
                        'Sort navigation list by initiative'
                      : "Sort navigation list by contributor's name"
                    }
                  >
                    <SortByAlphaIcon sx={{ width: 18, height: 18 }} />
                  </ToggleButton>
                  <ToggleButton
                    value={SortActorsBy.Total}
                    title="Sort navigation list by total number of activities"
                  >
                    <SortByTotalIcon sx={{ width: 18, height: 18 }} />
                  </ToggleButton>
                  <ToggleButton
                    value={SortActorsBy.Effort}
                    title="Sort  navigation list by hours spent on all activities"
                  >
                    <SortByEffortIcon sx={{ width: 18, height: 18 }} />
                  </ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </FormControl>
            {actorList}
            {initiativeList}
          </Box>
        </Box>
      </Box>
    : null;

  const filterBar = (
    <Grid container spacing={2} alignItems="center">
      {loaderData.userId !== ALL && <Grid>{actorHeader(loaderData.userId!)}</Grid>}
      <Grid flex={1} />
      <Grid>
        {loaderData.userId !== ALL && (
          <Button
            variant="text"
            href={
              '/activity/*?groupby=' +
              (groupBy === GroupBy.Initiative ? 'initiative' : 'contributor') +
              (actionFilter.length ? `&action=${actionFilter.join(',')}` : '')
            }
            endIcon={<ZoomOutIcon fontSize="small" />}
            sx={{ mr: 1, textTransform: 'none', textWrap: 'nowrap' }}
          >
            {'All contributors'}
          </Button>
        )}
      </Grid>
      <Grid>
        <Grid container spacing={3}>
          <Grid>
            <SearchField
              title={
                groupBy === GroupBy.Contributor ?
                  'Search descriptions'
                : 'Search descriptions and contributors'
              }
              value={searchFilter}
              setValue={setSearchFilter}
              sx={{ width: { xs: '11ch', sm: '12ch' }, minWidth: { xs: '100px', sm: '160px' } }}
            />
          </Grid>
          <Grid>
            <FilterMenu
              label="Group by"
              icon={<GroupIcon fontSize="small" />}
              selectedValue={groupBy ?? ''}
              items={[
                { value: '', label: 'None', color: theme.palette.grey[500] },
                ...(loaderData.userId === ALL ?
                  [{ value: GroupBy.Contributor, label: 'Contributor' }]
                : []),
                { value: GroupBy.Initiative, label: 'Initiative' },
              ]}
              onChange={value => {
                reset();
                setGroupBy((value as GroupBy) || null); // will trigger effect to re-set activities
                setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_GROUPBY, value));
              }}
            />
          </Grid>
          <Grid>
            <FilterMenu
              label="Action"
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
                setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_ACTION, values));
              }}
            />
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );

  const totalIndicator = (
    <Box display="flex" justifyContent="right" mt={1}>
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
  );

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => {
        reset();
        setDateFilter(dateRange);
      }}
      onDateRangeRefresh={() => {
        setPaginationModel({ ...paginationModel, page: 0 });
        fetchActivities(dateFilter);
      }}
      showProgress={isRendering || navigation.state !== 'idle'}
    >
      {errorAlert(fetchedActivity?.error?.message)}
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{
          linkifyObjectId: true,
          linkifyActivityId: !!loaderData.email?.endsWith('@roakit.com'),
        }}
      />
      <BoxPopover popover={popover} onClose={() => setPopover(null)} showClose={true} />
      <Stack m={3} direction="row">
        {navBar}
        <Stack flex={1} minWidth={0}>
          {filterBar}
          {totalIndicator}
          {gridsByContributor}
          {gridsByInitiative}
          {gridsUngrouped}
        </Stack>
      </Stack>
    </App>
  );
}
