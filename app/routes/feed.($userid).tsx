import {
  DataObject as DataObjectIcon,
  Timelapse as EffortIcon,
  ThumbUpAlt as ThumbUpIcon,
  ThumbUpOffAlt as ThumbUpOffIcon,
} from '@mui/icons-material';
import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Tooltip,
} from '@mui/material';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
import { reactionCount, reactionNames } from '../activityProcessors/activityFeed';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import {
  MapperType,
  compileActivityMappers,
  mapActivity,
} from '../activityProcessors/activityMapper';
import ActivityCard from '../components/ActivityCard';
import App from '../components/App';
import AutoRefreshingRelativeDate from '../components/AutoRefreshingRelativeData';
import BoxPopover, { type BoxPopoverContent } from '../components/BoxPopover';
import type { CodePopoverContent } from '../components/CodePopover';
import CodePopover from '../components/CodePopover';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import type { Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { postJsonOptions } from '../utils/httpUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  errorAlert,
  loaderErrorResponse,
  loginWithRedirectUrl,
  windowOpen,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import { nameInitials, stringColor } from '../utils/stringUtils';
import theme, { priorityColors, priorityLabels, prioritySymbols } from '../utils/theme';
import type { ActivityPageResponse } from './fetcher.activities.page';

export const meta = () => [{ title: 'Work Feed | ROAKIT' }];

const VIEW = View.Feed;

const PAGE_SIZE = 50;
const THRESHOLD = 50;

const REFRESH_INTERVAL_MS = 15 * 1000;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW, params);
  try {
    const [initiatives, launchItems, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
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
      identityId: userIdentity.id,
      activityUserIds,
      initiatives,
      launchItems,
      actors,
      accountMap: identities.accountMap,
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

export default function ActivityReview() {
  const navigate = useNavigate();
  const submit = useSubmit();
  const loaderData = useLoaderData<typeof loader>();
  const moreActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const moreFetchedActivities = moreActivitiesFetcher.data;
  const newActivitiesFetcher = useFetcher<ActivityPageResponse>();
  const newFetchedActivities = newActivitiesFetcher.data;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [snackMessage, setSnackMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [scrollOffset, setScrollOffset] = useState(0);
  const heightsRef = useRef<number[]>([]);
  const listRef = useRef<VariableSizeList | null>(null);
  const { ref: rootRef } = useResizeDetector({
    handleHeight: false,
    onResize: () => (heightsRef.current = []),
  });

  const loadMoreRows =
    moreActivitiesFetcher.state !== 'idle' ?
      () => {}
    : () => {
        let query = `/fetcher/activities/page?limit=${PAGE_SIZE}&combine=true&withTotal=false`;
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

  const loadNewRows = useCallback(() => {
    let query = `/fetcher/activities/page?limit=1000&combine=true&withTotal=false`; // if there are more than 1000 activities between now and activity[0] we'll miss some
    if (activities.length) {
      query += `&endBefore=${activities[0].createdTimestamp}`;
    }
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds}`;
    }
    newActivitiesFetcher.load(query);
  }, [activities, newActivitiesFetcher, loaderData.activityUserIds]);

  const buildActivityRows = useCallback(
    (fetchedActivities: ActivityPageResponse) => {
      const activityRows: ActivityRow[] = [];
      fetchedActivities.activities?.forEach((activity: Activity) => {
        let mapping;
        if (!activity.initiativeId || activity.launchItemId == null) {
          mapping = mapActivity(activity);
        }
        const { initiativeId, ...activityFields } = activity;
        activityRows.push({
          ...activityFields,
          actorId:
            activity.actorId ?
              (loaderData.accountMap[activity.actorId] ?? activity.actorId) // resolve identity
            : undefined,
          initiativeId: initiativeId || mapping?.initiatives[0] || '',
          // activity.launchItemId is '', not null, if user explicitly unset it (perhaps because they didn't like the mapping)
          launchItemId:
            activity.launchItemId != null ? activity.launchItemId : (mapping?.launchItems[0] ?? ''),
        });
      });
      return activityRows;
    },
    [loaderData.accountMap]
  );

  useEffect(() => {
    if (loaderData.initiatives) {
      compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    }
    if (loaderData.launchItems) {
      compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
    }
  }, [loaderData.initiatives, loaderData.launchItems]);

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
    setActivities([...activities, ...buildActivityRows(moreFetchedActivities)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moreFetchedActivities?.activities]); // loaderData and activities must be omitted

  useEffect(() => {
    if (!newFetchedActivities?.activities) return;
    setIsLoading(false);
    setActivities([...buildActivityRows(newFetchedActivities), ...activities]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newFetchedActivities?.activities]); // loaderData and activities must be omitted

  // auto fetch new activities
  useEffect(() => {
    const interval = setInterval(() => {
      if (moreActivitiesFetcher.state !== 'idle' || scrollOffset > 0) return;
      loadNewRows();
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadNewRows, moreActivitiesFetcher.state, scrollOffset]);

  const isRowLoaded = (index: number) => index < activities.length;

  const getRowSize = (index: number) => heightsRef.current[index] ?? 100;

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
    const ref = useRef<Element>();

    useEffect(() => {
      if (!ref.current || heightsRef.current[index]) return;
      const height = ref.current.getBoundingClientRect().height;
      heightsRef.current[index] = Math.ceil(height);
      listRef.current?.resetAfterIndex(index);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!isRowLoaded(index)) {
      return (
        <Box style={style} display="flex" justifyContent="center">
          <CircularProgress size={30} />
        </Box>
      );
    }
    const activity = activities[index];
    const event = `${activity.event} ${
      activity.metadata?.codeAction ?
        Array.isArray(activity.metadata.codeAction) ?
          activity.metadata.codeAction.join(', ')
        : activity.metadata.codeAction
      : ''
    }`;

    const isLiked = activity.reactions?.like[loaderData.identityId];
    const likeCount = activity.reactions ? reactionCount(activity.reactions).like : 0;
    const name = activity.actorId ? loaderData.actors[activity.actorId]?.name : undefined;
    const initials = nameInitials(name);
    const href = activity.actorId ? `/feed/${encodeURI(activity.actorId)}` : undefined;
    const avatar = (
      <Avatar
        onClick={href ? e => windowOpen(e, href) : undefined}
        sx={{
          bgcolor: stringColor(name),
          cursor: href ? 'pointer' : undefined,
          width: 36,
          height: 36,
          mr: 1,
        }}
      >
        {initials}
      </Avatar>
    );
    return (
      <Box style={style}>
        <Box ref={ref}>
          <Stack direction="row">
            {avatar}
            <Stack flexGrow={1}>
              <Stack direction="row" spacing="4px" fontSize="14px" mb="4px" alignItems="center">
                {href && (
                  <Link
                    href={href}
                    fontWeight={600}
                    sx={{
                      color: theme.palette.text.primary,
                      textDecoration: 'none',
                      borderBottom: '0.5px solid rgba(0,0,0,0)',
                      borderSpacing: 0,
                      '&:hover': { borderBottomColor: theme.palette.text.primary },
                    }}
                  >
                    {name ?? 'unknown'}
                  </Link>
                )}
                <Box color={theme.palette.grey[500]}>
                  • <AutoRefreshingRelativeDate date={activity.timestamp} />
                </Box>
                <Box flexGrow={1} />
                <Tooltip title={`{ ${event} }`} arrow>
                  <Box
                    fontSize="12px"
                    color={theme.palette.grey[500]}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
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
                  border: 1,
                  borderColor: theme.palette.grey[200],
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
                  setPopover={(element, content) => setPopover({ element, content })}
                />
              </Box>
              <Stack direction="row" fontSize="12px" spacing={2} mt="2px" alignItems="start">
                <Tooltip
                  arrow
                  title={
                    activity.reactions ?
                      reactionNames(activity.reactions, loaderData.actors).like
                    : ''
                  }
                >
                  <Button
                    variant="text"
                    size="small"
                    startIcon={isLiked ? <ThumbUpIcon /> : <ThumbUpOffIcon />}
                    onClick={() => {
                      if (!activity.reactions) {
                        activity.reactions = { like: { [loaderData.identityId]: true } };
                      } else {
                        activity.reactions.like[loaderData.identityId] = !isLiked;
                      }
                      submit(
                        {
                          activityId: activity.id,
                          reaction: 'like',
                          plusOne: !isLiked,
                        },
                        postJsonOptions
                      );
                    }}
                  >
                    <Box fontSize="12px">{likeCount > 0 ? likeCount : ''}</Box>
                  </Button>
                </Tooltip>
                <Box flexGrow={1} />
                {activity.launchItemId != null && (
                  <Tooltip title={loaderData.launchItems[activity.launchItemId]?.label} arrow>
                    <Box color={loaderData.launchItems[activity.launchItemId]?.color ?? undefined}>
                      {loaderData.launchItems[activity.launchItemId]?.key}
                    </Box>
                  </Tooltip>
                )}
                {activity.priority != null && (
                  <Tooltip title={`${priorityLabels[activity.priority]} priority`} arrow>
                    <Box fontWeight="600" color={priorityColors[activity.priority] ?? undefined}>
                      {prioritySymbols[activity.priority] ?? ''}
                    </Box>
                  </Tooltip>
                )}
                {activity.phase && <Box>{activity.phase}</Box>}
                {activity.effort && (
                  <>
                    <EffortIcon sx={{ fontSize: '14px', pr: '4px' }} />
                    {activity.effort}
                  </>
                )}
              </Stack>
            </Stack>
          </Stack>
          <Box height="15px" />
        </Box>
      </Box>
    );
  };

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      onDateRangeRefresh={() => {
        setIsLoading(true);
        loadNewRows();
        listRef.current?.scrollToItem(0);
      }}
      showProgress={isLoading}
      showPulse={scrollOffset === 0}
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
      <Box ref={rootRef} height="calc(100vh - 90px)" m={3}>
        <AutoSizer disableWidth>
          {({ height }) => (
            <InfiniteLoader
              isItemLoaded={isRowLoaded}
              itemCount={activities.length + 1}
              loadMoreItems={loadMoreRows}
              minimumBatchSize={PAGE_SIZE}
              threshold={THRESHOLD}
            >
              {({ onItemsRendered, ref }) => (
                <VariableSizeList
                  itemSize={getRowSize}
                  height={height}
                  width="100%"
                  itemCount={activities.length + 1}
                  ref={elem => {
                    ref(elem);
                    listRef.current = elem;
                  }}
                  onScroll={({ scrollOffset }) => setScrollOffset(scrollOffset)}
                  onItemsRendered={onItemsRendered}
                >
                  {Row}
                </VariableSizeList>
              )}
            </InfiniteLoader>
          )}
        </AutoSizer>
      </Box>
    </App>
  );
}
