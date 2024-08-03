import {
  Close as CloseIcon,
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
  useNavigate,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { VariableSizeList } from 'react-window';
import { getActivityUrl } from '../activityProcessors/activityDescription';
import { artifacts, reactionCount, reactionNames } from '../activityProcessors/activityFeed';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  compileActivityMappers,
  mapActivity,
  MapperType,
} from '../activityProcessors/activityMapper';
import ActivityCard from '../components/ActivityCard';
import App from '../components/App';
import AutoRefreshingRelativeDate from '../components/AutoRefreshingRelativeData';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import ClickableAvatar from '../components/ClickableAvatar';
import type { CodePopoverContent } from '../components/CodePopover';
import CodePopover from '../components/CodePopover';
import FilterMenu from '../components/FilterMenu';
import HelperText from '../components/HelperText';
import InfiniteList from '../components/InfiniteList';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchLaunchItemMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import { type Activity, type Initiative } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { formatMonthDayTime } from '../utils/dateUtils';
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

export const shouldRevalidate = () => false;

const VIEW = View.Feed;

const SEARCH_PARAM_LAUNCH = 'launch';
const SEARCH_PARAM_ARTIFACT = 'artifact';

const PAGE_SIZE = 50;

const FILTER_WIDTH = 220;

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

const launchFilterOptions = createFilterOptions({
  stringify: (option: Initiative) => option.key + ' ' + option.label,
});

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW, params);
  try {
    const [launchItems, accounts, identities] = await Promise.all([
      //  fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    const userIdentity = identities.list.find(identity => identity.email === sessionData.email);
    if (!userIdentity) {
      throw new Response('Identity not found', { status: 500 });
    }

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const activityUserIds =
      params.userid ?
        getAllPossibleActivityUserIds(params.userid, identities.list, identities.accountMap)
      : [];

    return {
      ...sessionData,
      userId: params.userid,
      identityId: userIdentity.id,
      activityUserIds,
      launchItems,
      actors,
      accountMap: identities.accountMap,
      identities: identities.list,
    };
  } catch (e) {
    getLogger('route:activities').error(e);
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
  const sessionData = await loadSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;
  const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
  await firestore
    .doc(`customers/${sessionData.customerId!}/activities/${actionRequest.activityId}`)
    .set({ reactions: { like: { [identity.id]: actionRequest.plusOne } } }, { merge: true });

  return { status: { code: 'reacted' } };
};

type ActivityRow = Activity & { note?: string };

export default function Feed() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const loaderData = useLoaderData<typeof loader>();
  const moreActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const moreFetchedActivities = moreActivitiesFetcher.data;
  const newActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const newFetchedActivities = newActivitiesFetcher.data;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [launchFilter, setLaunchFilter] = useState(
    searchParams.get(SEARCH_PARAM_LAUNCH)?.split(',') ?? []
  );
  const [artifactFilter, setArtifactFilter] = useState(
    searchParams.get(SEARCH_PARAM_ARTIFACT)?.split(',') ?? []
  );
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [snackMessage, setSnackMessage] = useState('');
  const [showFiltersForMobile, setShowFiltersForMobile] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [listScrollOffset, setListScrollOffset] = useState(0);
  const listRef = useRef<VariableSizeList | null>(null);
  const heightsRef = useRef<number[]>([]);

  let launchItemsByKey = new Map<string, Initiative>();
  Object.keys(loaderData.launchItems).forEach(id => {
    launchItemsByKey.set(loaderData.launchItems[id].key, { id, ...loaderData.launchItems[id] });
  });
  launchItemsByKey = new Map([...launchItemsByKey.entries()].sort());

  const loadMoreRows = () => {
    let query = `/fetcher/activities/page?limit=${PAGE_SIZE}&combine=true&withTotal=false`;
    if (launchFilter.length) {
      query += `&launchIds=${launchFilter.map(k => launchItemsByKey.get(k)!.id).join(',')}`;
    }
    if (artifactFilter.length) {
      query += `&artifacts=${artifactFilter.join(',')}`;
    }
    // if concerned with activities at the same millisecond, use a doc snapshot instead of createdTimestamp (requiring fetching it though)
    // https://firebase.google.com/docs/firestore/query-data/query-cursors#use_a_document_snapshot_to_define_the_query_cursor
    if (activities.length) {
      query += `&startAfter=${activities[activities.length - 1].createdTimestamp}`;
    }
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds.join(',')}`;
    }
    moreActivitiesFetcher.load(query);
  };

  const loadNewRows = () => {
    if (newActivitiesFetcher.state !== 'idle') return;

    let query = `/fetcher/activities/page?limit=1000&combine=true&withTotal=false`; // if there are more than 1000 activities between now and activity[0] we'll miss some
    if (artifactFilter.length) {
      query += `&artifacts=${artifactFilter.join(',')}`;
    }
    if (activities.length) {
      query += `&endBefore=${activities[0].createdTimestamp}`;
    }
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds}`;
    }
    newActivitiesFetcher.load(query); // FIXME this causes rerendering even when there are no new activities
  };

  const buildAndFilterActivityRows = useCallback(
    (fetchedActivities: ActivityPageResponse['activities']) => {
      const activityRows: ActivityRow[] = [];
      fetchedActivities?.forEach((activity: Activity) => {
        let mapping;
        if (!activity.initiativeId || activity.launchItemId == null) {
          mapping = mapActivity(activity);
        }
        const { initiativeId, ...activityFields } = activity;
        // activity.launchItemId is '', not null, if user explicitly unset it (perhaps because they didn't like the mapping)
        let launchItemId = '';
        if (activity.launchItemId != null) {
          launchItemId = activity.launchItemId;
        } else {
          launchItemId = mapping?.launchItems[0] ?? '';
        }
        if (
          launchFilter.length === 0 ||
          (launchItemId && launchFilter.includes(loaderData.launchItems[launchItemId].key))
        ) {
          activityRows.push({
            ...activityFields,
            actorId:
              activity.actorId ?
                (loaderData.accountMap[activity.actorId] ?? activity.actorId) // resolve identity
              : undefined,
            initiativeId: initiativeId || mapping?.initiatives[0] || '',
            launchItemId,
          });
        }
      });
      return activityRows;
    },
    [launchFilter, loaderData.accountMap, loaderData.launchItems]
  );

  const clear = () => {
    setActivities([]);
    setIsLoading(true);
    listRef.current?.scrollToItem(0);
  };

  useEffect(() => {
    if (loaderData.launchItems) {
      compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
    }
  }, [loaderData.launchItems]);

  // handle cookie expired errors
  useEffect(() => {
    if (
      moreFetchedActivities?.error?.status === 401 ||
      newFetchedActivities?.error?.status === 401
    ) {
      navigate(loginWithRedirectUrl());
    }
  }, [moreFetchedActivities?.error, navigate, newFetchedActivities?.error?.status]);

  // handle fetched activities
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

  useEffect(() => {
    if (!newFetchedActivities?.activities) return;
    setIsLoading(false);
    setActivities(activities => [
      ...buildAndFilterActivityRows(newFetchedActivities.activities),
      ...activities,
    ]);
  }, [buildAndFilterActivityRows, newFetchedActivities?.activities]);

  const isActivityRowLoaded = (activityIndex: number) => activityIndex < activities.length;

  const rowElement = (index: number) => {
    if (index === 0) {
      return (
        <HelperText sx={{ justifyContent: 'start', ml: '44px', mb: 1 }}>
          This feed auto-refreshes when scrolled to the top. Click{' '}
          <RefreshIcon sx={{ width: 16, height: 16, verticalAlign: 'middle' }} /> in the header to
          scroll back to the top.
        </HelperText>
      );
    }

    const activityIndex = index - 1;

    if (!isActivityRowLoaded(activityIndex)) {
      return (
        <Box display="flex" justifyContent="center" pr={3}>
          <CircularProgress size={30} />
        </Box>
      );
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
    const userName = activity.actorId ? loaderData.actors[activity.actorId]?.name : undefined;
    const userUrl = activity.actorId ? `/feed/${encodeURI(activity.actorId)}` : undefined;

    const activityUrl = activity.metadata ? getActivityUrl(activity) : undefined;
    let sourceIcon;
    let sourceTitle;
    if (activityUrl) {
      if (activityUrl.type === 'jira') {
        sourceIcon = <JiraIcon width={16} height={16} />;
        sourceTitle = 'Jira';
      } else if (activityUrl.type === 'confluence') {
        sourceIcon = <ConfluenceIcon width={14} height={14} />;
        sourceTitle = 'Confluence';
      } else if (activityUrl.type === 'github') {
        sourceIcon = <GitHubIcon sx={{ width: 16, height: 16 }} />;
        sourceTitle = 'GitHub';
      }
    }

    return (
      <Stack direction="row" mb={2}>
        <ClickableAvatar name={userName} href={userUrl} sx={{ mr: 1 }} />
        <Stack flexGrow={1} minWidth={0}>
          <Stack useFlexGap direction="row" spacing="4px" mb="4px" alignItems="center">
            {userUrl && (
              <Link
                href={userUrl}
                sx={{
                  fontWeight: 600,
                  color: theme.palette.text.primary,
                  ...ellipsisSx,
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {userName ?? 'unknown'}
              </Link>
            )}
            <Tooltip title={formatMonthDayTime(activity.timestamp)}>
              <Box fontSize="14px" color={theme.palette.grey[500]} sx={{ whiteSpace: 'nowrap' }}>
                • <AutoRefreshingRelativeDate date={activity.timestamp} />
              </Box>
            </Tooltip>
            <Box flexGrow={1} />
            <Tooltip title={`{ ${event} }`}>
              <Box fontSize="12px" color={theme.palette.grey[500]} sx={{ whiteSpace: 'nowrap' }}>
                {activity.artifact} {activity.action}
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
                  <Box fontSize="12px" sx={{ visibility: { xs: 'hidden', sm: 'visible' } }}>
                    {sourceTitle}
                  </Box>
                </Button>
              </Tooltip>
            )}
            <Box flexGrow={1} />
            {activity.launchItemId != null && (
              <Tooltip title={loaderData.launchItems[activity.launchItemId]?.label}>
                <Box color={loaderData.launchItems[activity.launchItemId]?.color ?? undefined}>
                  {loaderData.launchItems[activity.launchItemId]?.key}
                </Box>
              </Tooltip>
            )}
            {activity.priority != null && (
              <>
                <Box color={priorityColors[activity.priority]} sx={desktopDisplaySx}>
                  {priorityLabels[activity.priority]}
                </Box>
                <Box
                  fontWeight={600}
                  color={priorityColors[activity.priority]}
                  sx={mobileDisplaySx}
                >
                  {prioritySymbols[activity.priority]}
                </Box>
              </>
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
      showPulse={listScrollOffset === 0}
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
          pt={3}
          sx={{
            opacity: showFiltersForMobile ? 0.2 : undefined,
            borderRight: { xs: undefined, sm: `1px solid ${theme.palette.grey[200]}` },
          }}
        >
          <InfiniteList
            height={`calc(100vh - ${HEADER_HEIGHT + 22}px)`}
            head={feedStyles}
            itemCount={activities.length + 2} /* +1 helper text, +1 'loading more' */
            isItemLoaded={index => isActivityRowLoaded(index - 1)}
            rowElement={rowElement}
            loadMoreItems={moreActivitiesFetcher.state === 'idle' ? loadMoreRows : () => {}}
            loadNewItems={loadNewRows}
            setRef={ref => (listRef.current = ref)}
            setListScrollOffset={setListScrollOffset}
            rowHeights={heightsRef.current}
            setRowHeights={heights => (heightsRef.current = heights)}
          />
        </Box>
        <Stack mt={3} ml={{ xs: 0, sm: 3 }} mr={{ xs: 2, sm: 3 }}>
          {listScrollOffset === 0 && (
            <ToggleButton
              value="checked"
              size="small"
              selected={showFiltersForMobile}
              onChange={() => setShowFiltersForMobile(!showFiltersForMobile)}
              sx={{ width: 'fit-content', mb: 3, ...mobileDisplaySx }}
            >
              {showFiltersForMobile ?
                <CloseIcon />
              : <FilterIcon />}
            </ToggleButton>
          )}
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              ...(!showFiltersForMobile && desktopDisplaySx),
              ...(showFiltersForMobile && {
                position: 'absolute',
                top: HEADER_HEIGHT + 70,
                right: 65,
              }),
            }}
          >
            <Stack spacing={3}>
              <Autocomplete
                multiple
                disableClearable
                size="small"
                sx={{ width: FILTER_WIDTH }}
                value={launchFilter.map(key => launchItemsByKey.get(key)!)}
                options={[...launchItemsByKey.values()]}
                isOptionEqualToValue={(option, value) => option.key === value.key}
                filterOptions={launchFilterOptions}
                onChange={(_e, options) => {
                  const keys = options.map(option => option.key);
                  setLaunchFilter(keys);
                  setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_LAUNCH, keys));
                  clear();
                  loadNewRows();
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
                    placeholder={launchFilter.length === 0 ? 'Launch Items' : undefined}
                    InputProps={{
                      ...params.InputProps,
                      ...(launchFilter.length === 0 && {
                        startAdornment: (
                          <InputAdornment position="start" sx={{ ml: '8px', mr: 0 }}>
                            <FilterIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }),
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
                label="Artifacts"
                multiple
                chips={true}
                sx={{ width: FILTER_WIDTH }}
                selectedValue={artifactFilter}
                items={[
                  ...[...artifacts].map(([key, artifact]) => ({
                    value: key,
                    label: artifact.label,
                  })),
                ]}
                onChange={values => {
                  setArtifactFilter(values as string[]);
                  setSearchParams(prev => getSearchParam(prev, SEARCH_PARAM_ARTIFACT, values));
                  clear();
                }}
              />
              <Autocomplete
                size="small"
                sx={{ width: FILTER_WIDTH }}
                value={
                  loaderData.userId ?
                    {
                      value: loaderData.userId,
                      label: loaderData.actors[loaderData.userId].name,
                    }
                  : null
                }
                options={loaderData.identities.map(identity => ({
                  value: identity.id,
                  label: identity.displayName,
                }))}
                disableClearable={loaderData.userId == null}
                isOptionEqualToValue={(option, value) => option.value === value.value}
                onChange={(_e, option) => {
                  setIsLoading(true);
                  window.open(
                    '/feed/' +
                      (option != null ? `${option.value}/` : '') +
                      (launchFilter.length ? `?launch=${encodeURI(launchFilter.join(','))}` : '') +
                      (artifactFilter.length ?
                        `?artifact=${encodeURI(artifactFilter.join(','))}`
                      : ''),
                    '_self'
                  );
                }}
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
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <InputAdornment position="start" sx={{ ml: 1, mr: 0 }}>
                          {loaderData.userId ?
                            <ClickableAvatar
                              size={20}
                              fontSize={9}
                              name={loaderData.actors[loaderData.userId].name}
                            />
                          : <OpenInNewIcon fontSize="small" />}
                        </InputAdornment>
                      ),
                    }}
                  />
                )}
              />
            </Stack>
          </Paper>
        </Stack>
      </Stack>
    </App>
  );
}
