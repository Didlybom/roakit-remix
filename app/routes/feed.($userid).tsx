import {
  DataObject as DataObjectIcon,
  Timelapse as EffortIcon,
  FilterList as FilterIcon,
  GitHub as GitHubIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
  ThumbUpAlt as ThumbUpIcon,
  ThumbUpOffAlt as ThumbUpOffIcon,
} from '@mui/icons-material';
import {
  Autocomplete,
  Backdrop,
  Badge,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  createFilterOptions,
  GlobalStyles,
  IconButton,
  InputAdornment,
  Link,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  Tooltip,
} from '@mui/material';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useLocation,
  useNavigate,
  useSearchParams,
  useSubmit,
  type ShouldRevalidateFunction,
} from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VariableSizeList } from 'react-window';
import type InfiniteLoader from 'react-window-infinite-loader';
import ActivityCard from '../components/ActivityCard';
import App from '../components/App';
import AutoRefreshingRelativeDate from '../components/AutoRefreshingRelativeData';
import { ClickableAvatar } from '../components/Avatars';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import type { CodePopoverContent } from '../components/CodePopover';
import CodePopover from '../components/CodePopover';
import FilterMenu from '../components/forms/SelectFilter';
import HelperText from '../components/HelperText';
import InfiniteList from '../components/InfiniteList';
import Pulse from '../components/navigation/Pulse';
import {
  fetchAccountMap,
  fetchGroups,
  fetchIdentities,
  fetchInitiativeMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import { upsertLike } from '../firestore.server/updaters.server';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import { getActivityAction, getActivityUrl } from '../processors/activityDescription';
import {
  accountUrlToWeb,
  activityTypes,
  confluenceSourceName,
  gitHubSourceName,
  inferTicketStatus,
  jiraSourceName,
  reactionCount,
  reactionNames,
} from '../processors/activityFeed';
import { identifyAccounts } from '../processors/activityIdentifier';
import { compileActivityMappers, mapActivity } from '../processors/activityMapper';
import { type Activity, type Initiative } from '../types/types';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { formatMonthDayTime } from '../utils/dateUtils';
import { RoakitError } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  desktopDisplaySx,
  ellipsisSx,
  errorAlert,
  getSearchParam,
  HEADER_HEIGHT,
  loaderErrorResponse,
  loginWithRedirectUrl,
  mobileDisplaySx,
  type SelectOption,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import { pluralizeMemo } from '../utils/stringUtils';
import theme, {
  getThemeContrastText,
  priorityColors,
  priorityLabels,
  prioritySymbols,
} from '../utils/theme';
import type { ActivityPageResponse } from './fetcher.activities.page';

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'Work';
  if (data?.userId) {
    title = data.actors[data.userId]?.name ?? 'Work';
  }
  return [{ title: `${title} Feed | ROAKIT` }];
};

const SEARCH_PARAM_INITIATIVE = 'initiative';
const SEARCH_PARAM_ARTIFACT = 'activityType';
const GROUP_PARAM_PREFIX = 'group:';

export const shouldRevalidate: ShouldRevalidateFunction = ({ currentParams, nextParams }) =>
  currentParams.userid !== nextParams.userid;

const VIEW = View.Feed;

const PAGE_SIZE = 50;

const FILTER_WIDTH = 230;

const feedStyles = (
  <GlobalStyles
    styles={{
      a: {
        color: theme.palette.primary.main,
        textDecoration: 'none',
        '&:hover': { textDecoration: 'underline' },
      },
      em: { fontStyle: 'normal' },
      'h1, h2, h3, h4': { fontSize: 'inherit' },
      p: { marginTop: 0 },
      code: {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '11px',
        backgroundColor: theme.palette.grey[50],
        border: '1px solid divider',
        borderRadius: '5px',
        padding: '1px 4px',
        textWrap: 'wrap',
      },
      table: {
        color: theme.palette.grey[500],
        fontSize: 'small',
        textAlign: 'left',
        borderCollapse: 'collapse',
      },
      'th, td': {
        border: '0.5px solid divider',
        padding: '4px',
      },
      th: {
        backgroundColor: theme.palette.grey[50],
      },
    }}
  />
);

const initiativeFilterOptions = createFilterOptions({
  stringify: (option: Initiative) => option.key + ' ' + option.label,
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);
  try {
    const [initiatives, accounts, identities, groups] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
      fetchGroups(sessionData.customerId!),
    ]);

    const userIdentity = identities.list.find(identity => identity.email === sessionData.email);
    if (!userIdentity) {
      throw new RoakitError('Identity not found', { httpStatus: 500 });
    }

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    let userId;
    let groupId;
    let activityUserIds: string[] = [];
    if (params.userid && !params.userid?.startsWith(GROUP_PARAM_PREFIX)) {
      userId = params.userid;
      activityUserIds = getAllPossibleActivityUserIds(
        [params.userid],
        identities.list,
        identities.accountMap
      );
    }
    if (params.userid && params.userid?.startsWith(GROUP_PARAM_PREFIX)) {
      groupId = params.userid.slice(GROUP_PARAM_PREFIX.length);
    }

    if (userId && !actors[userId]) {
      throw new RoakitError('Contributor not found', { httpStatus: 404 });
    }

    if (groupId && !groups.find(g => g.id === groupId)) {
      throw new RoakitError('Group not found', { httpStatus: 404 });
    }

    return {
      ...sessionData,
      userId,
      groupId,
      identityId: userIdentity.id,
      activityUserIds,
      initiatives,
      actors,
      accountMap: identities.accountMap,
      identities: identities.list,
      groups,
    };
  } catch (e) {
    getLogger('route:feed').error(e);
    throw loaderErrorResponse(e);
  }
};

interface ActionRequest {
  activityId: string;
  reaction: 'like';
  plusOne: boolean;
}

interface ActionResponse {
  status?: { code: 'reacted'; message?: string };
  error?: string;
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;
  const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
  await upsertLike(
    sessionData.customerId!,
    actionRequest.activityId,
    identity.id,
    actionRequest.plusOne
  );

  return { status: { code: 'reacted' } };
};

type ActivityRow = Activity & { note?: string };

export default function Feed() {
  const navigate = useNavigate();
  const location = useLocation();
  const submit = useSubmit();
  const fetcher = useFetcher();
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof loader>();
  const moreActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const moreFetchedActivities = moreActivitiesFetcher.data;
  const newActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const newFetchedActivities = newActivitiesFetcher.data;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [initiativeFilter, setInitiativeFilter] = useState(
    searchParams.get(SEARCH_PARAM_INITIATIVE)?.split(',') ?? []
  );
  const [artifactFilter, setArtifactFilter] = useState(
    searchParams.get(SEARCH_PARAM_ARTIFACT)?.split(',') ?? []
  );
  const [groupFilter, setGroupFilter] = useState(loaderData.groupId);
  const [actorFilter, setActorFilter] = useState(loaderData.userId);
  const hasFilters = initiativeFilter.length || artifactFilter.length || groupFilter || actorFilter;
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [snackMessage, setSnackMessage] = useState('');
  const [showFiltersForMobile, setShowFiltersForMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [listScrollOffset, setListScrollOffset] = useState(0);
  const listRef = useRef<VariableSizeList | null>(null);
  const listLoaderRef = useRef<InfiniteLoader | null>(null);
  const heightsRef = useRef<number[]>([]);

  let initiativesByKey = new Map<string, Initiative>();
  Object.entries(loaderData.initiatives).forEach(([id, initiative]) =>
    initiativesByKey.set(initiative.key, { id, ...initiative })
  );
  initiativesByKey = new Map([...initiativesByKey.entries()].sort());

  const loadMoreRows = () => {
    let query = `/fetcher/activities/page?limit=${PAGE_SIZE}&combine=true`;
    if (initiativeFilter.length) {
      query += `&initiativeIds=${initiativeFilter.map(k => initiativesByKey.get(k)!.id).join(',')}`;
    }
    if (artifactFilter.length) {
      query += `&activityTypes=${artifactFilter.join(',')}`;
    }
    // if concerned with activities at the same millisecond, use a doc snapshot instead of createdTimestamp (requiring fetching it though)
    // https://firebase.google.com/docs/firestore/query-data/query-cursors#use_a_document_snapshot_to_define_the_query_cursor
    if (activities.length) {
      const oldestActivity = activities[activities.length - 1];
      query += `&startAfter=${oldestActivity.combined?.length ? oldestActivity.combined[0].timestamp : oldestActivity.createdTimestamp}`;
    }
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds.join(',')}`;
    } else if (loaderData.groupId) {
      query += `&groupId=${loaderData.groupId}`;
    }
    moreActivitiesFetcher.load(query);
  };

  const loadNewRows = () => {
    let query = `/fetcher/activities/page?limit=1000&combine=true`; // if there are more than 1000 activities between now and activity[0] we'll miss some
    if (artifactFilter.length) query += `&activityTypes=${artifactFilter.join(',')}`;
    if (activities.length) query += `&endBefore=${activities[0].createdTimestamp}`;
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds.join(',')}`;
    } else if (loaderData.groupId) {
      query += `&groupId=${loaderData.groupId}`;
    }
    newActivitiesFetcher.load(query); // FIXME this causes rerendering even when there are no new activities
  };

  const buildAndFilterActivityRows = useCallback(
    (fetchedActivities: ActivityPageResponse['activities']) => {
      const activityRows: ActivityRow[] = [];
      fetchedActivities?.forEach((activity: Activity) => {
        // activity.initiativeId is '', not null, if user explicitly unset it (perhaps because they didn't like the mapping)
        let initiativeId = '';
        if (activity.initiativeId != null) {
          initiativeId = activity.initiativeId;
        } else {
          initiativeId = mapActivity(activity)[0] ?? '';
        }
        if (
          initiativeFilter.length === 0 ||
          (initiativeId && initiativeFilter.includes(loaderData.initiatives[initiativeId].key))
        ) {
          activityRows.push({
            ...activity,
            actorId:
              activity.actorId ?
                (loaderData.accountMap[activity.actorId] ?? activity.actorId) // resolve identity
              : undefined,
            initiativeId,
          });
        }
      });
      return activityRows;
    },
    [initiativeFilter, loaderData.accountMap, loaderData.initiatives]
  );

  useEffect(() => {
    compileActivityMappers(loaderData.initiatives);
  }, [loaderData.initiatives]);

  // handle cookie expired errors
  useEffect(() => {
    if (
      moreFetchedActivities?.error?.status === 401 ||
      newFetchedActivities?.error?.status === 401
    ) {
      navigate(loginWithRedirectUrl());
    }
  }, [moreFetchedActivities?.error, navigate, newFetchedActivities?.error?.status]);

  // handle fetched new activities
  useEffect(() => {
    if (!moreFetchedActivities?.activities) return;
    setIsLoading(false);
    if (moreFetchedActivities.activities.length > 0) {
      setActivities(activities => [
        ...activities,
        ...buildAndFilterActivityRows(moreFetchedActivities.activities),
      ]);
    }
  }, [moreFetchedActivities?.activities, buildAndFilterActivityRows]);

  // handle fetched older activities
  useEffect(() => {
    if (!newFetchedActivities?.activities) return;
    setIsLoading(false);
    setActivities(activities => [
      ...buildAndFilterActivityRows(newFetchedActivities.activities),
      ...activities,
    ]);
  }, [buildAndFilterActivityRows, newFetchedActivities?.activities]);

  // handle filters
  useEffect(() => {
    setActivities([]);
  }, [artifactFilter, initiativeFilter]);

  // handle actor and group reload
  useEffect(() => {
    setActivities([]);
    setActorFilter(loaderData.userId);
    setGroupFilter(loaderData.groupId);
  }, [loaderData.userId, loaderData.groupId]);

  // refresh page after activities reset by filters
  useEffect(() => {
    if (activities.length === 0) {
      listRef.current?.scrollToItem(0);
      listLoaderRef.current?.resetloadMoreItemsCache(true);
    }
  }, [activities]);

  const isActivityRowLoaded = (activityIndex: number) => activityIndex < activities.length;

  const gotoActor = (actorId: string | undefined) => {
    setActorFilter(actorId);
    setGroupFilter(undefined);
    const href = `/feed/${actorId ?? ''}${location.search}`;
    navigate(href);
    fetcher.submit(href);
  };

  const rowElement = (index: number) => {
    if (index === 0) {
      return (
        <Box>
          {!showFiltersForMobile && (
            <ToggleButton
              value="checked"
              size="small"
              onChange={() => setShowFiltersForMobile(!showFiltersForMobile)}
              sx={{
                width: 'fit-content',
                ml: 2,
                mb: 3,
                float: 'right',
                ...mobileDisplaySx,
              }}
            >
              <Badge color="primary" variant="dot" invisible={!hasFilters}>
                <FilterIcon />
              </Badge>
            </ToggleButton>
          )}
          <HelperText sx={{ justifyContent: 'start', ml: '44px', mb: 2 }}>
            This feed auto-refreshes when scrolled to the top. Click{' '}
            <RefreshIcon sx={{ width: 16, height: 16, verticalAlign: 'middle' }} /> in the header to
            scroll back to the top.
          </HelperText>
        </Box>
      );
    }

    const activityIndex = index - 1;

    if (!isActivityRowLoaded(activityIndex)) {
      return moreActivitiesFetcher.state === 'loading' ?
          <Box display="flex" justifyContent="center" pr={3}>
            <CircularProgress size={30} />
          </Box>
        : <></>;
    }

    const activity = activities[activityIndex];
    const event = `${activity.event} ${
      activity.metadata?.codeAction ?
        Array.isArray(activity.metadata.codeAction) ?
          activity.metadata.codeAction.join(', ')
        : activity.metadata.codeAction
      : ''
    }`;

    const isLiked = activity.reactions?.like[loaderData.identityId];
    const likeCount = activity.reactions ? reactionCount(activity.reactions).like : 0;
    const actor = activity.actorId ? loaderData.actors[activity.actorId] : undefined;
    const actorUrl = activity.actorId ? `/feed/${encodeURI(activity.actorId)}` : undefined;

    const activityUrl = activity.metadata ? getActivityUrl(activity) : undefined;
    let sourceIcon;
    let sourceTitle;
    if (activityUrl) {
      if (activityUrl.type === 'jira') {
        sourceIcon = <JiraIcon sx={{ width: 15, height: 15 }} />;
        sourceTitle = jiraSourceName(activity.metadata);
      } else if (activityUrl.type === 'confluence') {
        sourceIcon = <ConfluenceIcon sx={{ width: 14, height: 14 }} />;
        sourceTitle = confluenceSourceName(activity.metadata);
      } else if (activityUrl.type === 'github') {
        sourceIcon = <GitHubIcon sx={{ width: 16, height: 16 }} />;
        sourceTitle = gitHubSourceName(activity.metadata);
      }
    }
    const status = inferTicketStatus(activity.metadata);
    return (
      <Stack direction="row" mb={2}>
        <ClickableAvatar
          name={actor?.name}
          href={actorUrl}
          onClick={e => {
            e.preventDefault();
            gotoActor(activity.actorId);
          }}
          sx={{ mr: 1 }}
        />
        <Stack flexGrow={1} minWidth={0}>
          <Stack useFlexGap direction="row" spacing="4px" mb="4px" alignItems="center">
            {actorUrl && (
              <Link
                href={actorUrl}
                onClick={e => {
                  e.preventDefault();
                  gotoActor(activity.actorId);
                }}
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  ...ellipsisSx,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {actor?.name ?? 'unknown'}
              </Link>
            )}
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
            <Tooltip title={formatMonthDayTime(activity.timestamp)}>
              <Box fontSize="14px" color={theme.palette.grey[500]} sx={{ whiteSpace: 'nowrap' }}>
                • <AutoRefreshingRelativeDate date={activity.timestamp} />
              </Box>
            </Tooltip>
            <Box flexGrow={1} />
            <Tooltip title={`{ ${event} }`}>
              <Box fontSize="12px" color={theme.palette.grey[500]} sx={{ whiteSpace: 'nowrap' }}>
                {getActivityAction(activity)}
              </Box>
            </Tooltip>
            <IconButton
              size="small"
              title="View JSON"
              onClick={e => setCodePopover({ element: e.currentTarget, content: activity })}
            >
              <DataObjectIcon sx={{ fontSize: '14px' }} />
            </IconButton>
          </Stack>
          <Box
            fontSize="14px"
            sx={{
              border: `1px solid ${theme.palette.grey[200]}`,
              borderRadius: '6px',
              p: 1,
              minHeight: '45px',
              '&:hover': { background: theme.palette.grey[50] },
            }}
          >
            <ActivityCard
              format="Feed"
              activity={activity}
              ticketBaseUrl={loaderData.customerSettings?.ticketBaseUrl}
              actors={loaderData.actors}
              accountMap={loaderData.accountMap}
              setPopover={(element, content) => setPopover({ element, content })}
            />
          </Box>
          <Stack direction="row" fontSize="12px" spacing={2} mt="2px" alignItems="start">
            <Tooltip
              title={
                activity.reactions ? reactionNames(activity.reactions, loaderData.actors).like : ''
              }
            >
              <Button
                size="small"
                sx={{ p: 0, width: 70 }}
                startIcon={
                  isLiked ?
                    <ThumbUpIcon sx={{ width: 16, height: 16 }} />
                  : <ThumbUpOffIcon sx={{ width: 16, height: 16 }} />
                }
                onClick={() => {
                  if (!activity.reactions) {
                    activity.reactions = { like: { [loaderData.identityId]: true } };
                  } else {
                    activity.reactions.like[loaderData.identityId] = !isLiked;
                  }
                  submit(
                    { activityId: activity.id, reaction: 'like', plusOne: !isLiked },
                    postJsonOptions
                  );
                }}
              >
                <Box fontSize="12px" visibility={!likeCount ? 'hidden' : undefined}>
                  {likeCount}
                </Box>
              </Button>
            </Tooltip>
            {activityUrl && sourceIcon && sourceTitle && (
              <Tooltip title="Go to source">
                <Button
                  component="a"
                  href={activityUrl.url}
                  target="_blank"
                  size="small"
                  startIcon={sourceIcon}
                  sx={{ textTransform: 'none', fontWeight: 400, py: 0, px: '4px', minWidth: 0 }}
                >
                  <Box fontSize="12px" sx={ellipsisSx}>
                    {sourceTitle}
                  </Box>
                </Button>
              </Tooltip>
            )}
            <Box flexGrow={1} />
            {activity.initiativeId != null && (
              <Tooltip title={loaderData.initiatives[activity.initiativeId]?.label}>
                <Box color={loaderData.initiatives[activity.initiativeId]?.color ?? undefined}>
                  {loaderData.initiatives[activity.initiativeId]?.key}
                </Box>
              </Tooltip>
            )}
            {activity.priority != null && (
              <Tooltip title={`${priorityLabels[activity.priority]} priority`}>
                <Box fontWeight={600} color={priorityColors[activity.priority]}>
                  {prioritySymbols[activity.priority]}
                </Box>
              </Tooltip>
            )}
            {status && (
              <Box color={theme.palette.grey[500]} sx={ellipsisSx}>
                {status}
              </Box>
            )}
            {activity.phase && <Box>{activity.phase}</Box>}
            {activity.effort && (
              <Tooltip title={`${activity.effort} ${pluralizeMemo('hour', activity.effort)}`}>
                <Stack direction="row" alignItems="center">
                  <EffortIcon sx={{ fontSize: '14px', pr: '4px' }} />
                  {activity.effort}
                </Stack>
              </Tooltip>
            )}
          </Stack>
        </Stack>
      </Stack>
    );
  };

  const realtimeIndicator = (live: boolean) => (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Box fontWeight={600}>{live ? 'Realtime' : 'Latest Activity'}</Box>
      <Stack direction="row">
        {live && (
          <Box mr="12px" mt="4px">
            <Pulse />
          </Box>
        )}
        <Box fontSize="small" color={theme.palette.grey[600]}>
          {live ?
            'Updating live'
          : activities.length +
            ' ' +
            pluralizeMemo('activity', activities.length) +
            (activities.length ?
              ' since ' + formatMonthDayTime(activities[activities.length - 1].createdTimestamp)
            : '')
          }
        </Box>
      </Stack>
    </Paper>
  );

  const filters = (
    <Stack onClick={e => e.stopPropagation()}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={3}>
          <Box fontWeight={600}>Filters</Box>
          <Autocomplete
            multiple
            disableClearable
            size="small"
            sx={{ width: FILTER_WIDTH }}
            value={initiativeFilter.map(key => initiativesByKey.get(key)!)}
            options={[...initiativesByKey.values()]}
            isOptionEqualToValue={(option, value) => option.key === value.key}
            filterOptions={initiativeFilterOptions}
            onChange={(_e, options) => {
              const keys = options.map(option => option.key);
              setInitiativeFilter(keys);
              setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_INITIATIVE, keys));
            }}
            renderOption={(options, option, { selected }) => {
              const { key, ...optionProps } = options;
              return (
                <Stack
                  key={key}
                  direction="row"
                  component="li"
                  ml="-12px"
                  fontSize="small"
                  {...optionProps}
                >
                  <Checkbox
                    checked={selected}
                    size="small"
                    // hard to align checkboxes, see https://github.com/mui/material-ui/issues/39798
                    sx={{
                      mt: -2,
                      color: option.color,
                      '&.Mui-checked': { color: option.color },
                    }}
                  />
                  <Tooltip title={option.label}>
                    <Stack minWidth={0}>
                      <Box fontWeight={500} color={option.color ?? undefined}>
                        {option.key}
                      </Box>
                      <Box fontSize="smaller" sx={ellipsisSx}>
                        {option.label}
                      </Box>
                    </Stack>
                  </Tooltip>
                </Stack>
              );
            }}
            renderInput={params => (
              <TextField
                {...params}
                placeholder={initiativeFilter.length === 0 ? 'Initiatives' : undefined}
                slotProps={{
                  input: {
                    ...params.InputProps,
                    ...(initiativeFilter.length === 0 && {
                      startAdornment: (
                        <InputAdornment position="start" sx={{ ml: '8px', mr: 0 }}>
                          <FilterIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }),
                  },
                }}
              />
            )}
            renderTags={(tags, getTagProps) =>
              tags.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                const color = getThemeContrastText(option.color);
                return (
                  <Tooltip key={index} title={option.label}>
                    <Chip
                      {...tagProps}
                      size="small"
                      label={option.key}
                      sx={{ color, bgcolor: option.color, '& .MuiChip-deleteIcon': { color } }}
                    />
                  </Tooltip>
                );
              })
            }
          ></Autocomplete>
          <FilterMenu
            label="Activity Type"
            multiple
            chips={true}
            sx={{ width: FILTER_WIDTH }}
            selectedValue={artifactFilter}
            items={[
              ...[...activityTypes].map(([key, artifact]) => ({
                value: key,
                label: artifact.label,
              })),
            ]}
            onChange={values => {
              setArtifactFilter(values as string[]);
              setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_ARTIFACT, values));
            }}
          />
          <FilterMenu
            label="User Group"
            icon={<OpenInNewIcon fontSize="small" />}
            chips={true}
            sx={{ width: FILTER_WIDTH }}
            selectedValue={groupFilter ?? ''}
            items={[
              { value: '', label: 'None', color: theme.palette.grey[500] },
              ...loaderData.groups.map(group => ({ value: group.id, label: group.name })),
            ]}
            onChange={value => {
              setActorFilter(undefined);
              setGroupFilter(value as string);
              const href =
                '/feed/' + (value ? `${GROUP_PARAM_PREFIX}${value}` : '') + location.search;
              navigate(href);
              fetcher.submit(href);
            }}
          />
          <Autocomplete
            size="small"
            sx={{ width: FILTER_WIDTH }}
            value={
              actorFilter ?
                { value: actorFilter, label: loaderData.actors[actorFilter]?.name }
              : null
            }
            options={loaderData.identities.map(identity => ({
              value: identity.id,
              label: identity.displayName,
            }))}
            disableClearable={actorFilter == null}
            isOptionEqualToValue={(option, value) => option.value === value.value}
            onChange={(_e, option) => gotoActor(option?.value)}
            renderOption={(props, option: SelectOption) => {
              const { key, ...optionProps } = props;
              return (
                <Box key={key} component="li" fontSize="small" {...optionProps}>
                  <ClickableAvatar size={18} fontSize={9} name={option.label} sx={{ mr: 1 }} />
                  <Box sx={ellipsisSx}>{option.label}</Box>
                </Box>
              );
            }}
            renderInput={params => (
              <TextField
                {...params}
                placeholder="Single Contributor"
                slotProps={{
                  input: {
                    ...params.InputProps,
                    startAdornment: (
                      <InputAdornment position="start" sx={{ ml: 1, mr: 0 }}>
                        {actorFilter ?
                          <ClickableAvatar
                            size={20}
                            fontSize={9}
                            name={loaderData.actors[actorFilter].name}
                          />
                        : <OpenInNewIcon fontSize="small" />}
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          />
        </Stack>
      </Paper>
    </Stack>
  );

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      identityId={loaderData.identityId}
      userName={loaderData.actors[loaderData.identityId]?.name}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      onDateRangeRefresh={() => {
        setIsLoading(true);
        loadNewRows();
        listRef.current?.scrollToItem(0);
      }}
      showProgress={isLoading}
    >
      {errorAlert(moreFetchedActivities?.error?.message)}
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{
          linkifyObjectId: true,
          linkifyActivityId: loaderData.email?.endsWith('@roakit.com'),
        }}
        anchorReference="none"
      />
      <BoxPopover
        popover={popover}
        onClose={() => setPopover(null)}
        showClose={true}
        anchorReference="none"
      />
      <Snackbar
        open={!!snackMessage}
        autoHideDuration={2000}
        onClose={(_, reason) => (reason === 'clickaway' ? null : setSnackMessage(''))}
        message={snackMessage}
      />
      <Stack direction="row" ml={{ xs: 2, sm: 3 }}>
        <Box
          width="100%"
          minWidth={300}
          pt={2}
          sx={{ borderRight: { xs: undefined, sm: `1px solid ${theme.palette.grey[200]}` } }}
        >
          <InfiniteList
            refreshIntervalMs={0}
            height={`calc(100vh - ${HEADER_HEIGHT + 22}px)`}
            rowSx={{ pr: { xs: 2, sm: 3 } }}
            head={feedStyles}
            itemCount={activities.length + 2} /* +1 helper text, +1 'loading more' */
            isItemLoaded={index => isActivityRowLoaded(index - 1)}
            rowElement={rowElement}
            loadMoreItems={moreActivitiesFetcher.state === 'idle' ? loadMoreRows : () => {}}
            loadNewItems={loadNewRows}
            listLoaderRef={listLoaderRef}
            setRef={ref => (listRef.current = ref)}
            setListScrollOffset={setListScrollOffset}
            rowHeights={heightsRef.current}
            setRowHeights={heights => (heightsRef.current = heights)}
          />
        </Box>
        {showFiltersForMobile ?
          <Backdrop open onClick={() => setShowFiltersForMobile(false)}>
            {filters}
          </Backdrop>
        : <Stack m={3} spacing={3} sx={desktopDisplaySx}>
            {realtimeIndicator(listScrollOffset === 0)}
            {filters}
          </Stack>
        }
      </Stack>
    </App>
  );
}
