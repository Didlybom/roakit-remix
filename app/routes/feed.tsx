import {
  DataObject as DataObjectIcon,
  Timelapse as EffortIcon,
  ThumbUpOffAlt as ThumbUpIcon,
} from '@mui/icons-material';
import { Box, CircularProgress, IconButton, Link, Snackbar, Stack } from '@mui/material';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate } from '@remix-run/react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import AutoSizer from 'react-virtualized-auto-sizer';
import { VariableSizeList } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';
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
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
} from '../firestore.server/fetchers.server';
import type { Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { errorAlert, loaderErrorResponse, loginWithRedirectUrl } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import theme, { priorityColors, prioritySymbols } from '../utils/theme';
import type { ActivityPageResponse } from './fetcher.activities.page';

export const meta = () => [{ title: 'Work Feed | ROAKIT' }];

const VIEW = View.Feed;

const PAGE_SIZE = 50;
const THRESHOLD = 50;

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW, params);
  try {
    const [initiatives, launchItems, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchLaunchItemMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
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

type ActivityRow = Activity & { note?: string };

export default function ActivityReview() {
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const activitiesFetcher = useFetcher<ActivityPageResponse>();
  const fetchedActivities = activitiesFetcher.data;
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [codePopover, setCodePopover] = useState<CodePopoverContent | null>(null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);
  const [snackMessage, setSnackMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const heightsRef = useRef<number[]>([]);
  const listRef = useRef<VariableSizeList | null>(null);

  const { ref: rootRef } = useResizeDetector({
    handleHeight: false,
    onResize: () => (heightsRef.current = []),
  });

  useEffect(() => {
    if (loaderData.initiatives) {
      compileActivityMappers(MapperType.Initiative, loaderData.initiatives);
    }
    if (loaderData.launchItems) {
      compileActivityMappers(MapperType.LaunchItem, loaderData.launchItems);
    }
  }, [loaderData.initiatives, loaderData.launchItems]);

  useEffect(() => {
    if (fetchedActivities?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivities?.error, navigate]);

  // handle fetched activities
  useEffect(() => {
    if (!fetchedActivities?.activities) {
      return;
    }
    setIsLoading(false);
    const activityRows: ActivityRow[] = [];
    fetchedActivities.activities.forEach((activity: Activity) => {
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
    setActivities([...activities, ...activityRows].sort((a, b) => b.timestamp - a.timestamp));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities]); // loaderData and activities must be omitted

  const hasNextPage = true;

  const loadMoreRows =
    activitiesFetcher.state !== 'idle' ?
      () => {}
    : () => {
        let query = `/fetcher/activities/page?limit=${PAGE_SIZE}&combine=true&withTotal=false`;
        // if concerned with activities at the same millisecond, use a doc snapshot instead of createdTimestamp (requiring fetching it though)
        // https://firebase.google.com/docs/firestore/query-data/query-cursors#use_a_document_snapshot_to_define_the_query_cursor
        if (activities.length) {
          query += `&startAfter=${activities[activities.length - 1].timestamp}`;
        }
        activitiesFetcher.load(query);
      };

  const loadNewRows = () => {
    setIsLoading(true);
    let query = `/fetcher/activities/page?limit=1000&combine=true&withTotal=false`; // if there are more than 1000 activities between now and activity[0] we'll miss some
    if (activities.length) {
      query += `&endBefore=${activities[0].timestamp}`;
    }
    activitiesFetcher.load(query);
  };

  const isRowLoaded = (index: number) => !hasNextPage || index < activities.length;

  const getRowSize = (index: number) => heightsRef.current[index] ?? 50;

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
    return (
      <Box style={style}>
        <Box ref={ref}>
          <Stack>
            <Stack direction="row" spacing="4px" fontSize="14px" mb="4px">
              {activity.actorId && (
                <Link
                  href={`/activity/${encodeURI(activity.actorId)}`}
                  target="_blank"
                  fontWeight={600}
                  sx={{
                    color: theme.palette.text.primary,
                    textDecoration: 'none',
                    borderBottom: '1px dotted rgba(0,0,0,0)',
                    borderSpacing: 0,
                    '&:hover': { borderBottomColor: theme.palette.text.primary },
                  }}
                >
                  {loaderData.actors[activity.actorId]?.name ?? 'unknown'}
                </Link>
              )}
              <Box color={theme.palette.grey[500]}>
                • <AutoRefreshingRelativeDate date={activity.timestamp} />
              </Box>
            </Stack>
            <Box
              fontSize="14px"
              sx={{
                border: 1,
                borderColor: theme.palette.grey[200],
                borderRadius: '6px',
                p: 1,
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
            <Stack direction="row" fontSize="12px" spacing={2} alignItems="center" mx={1}>
              <IconButton size="small" onClick={() => setSnackMessage('Not implemented')}>
                <ThumbUpIcon sx={{ fontSize: '14px' }} />
              </IconButton>
              <Box flex={1} />
              <Box>
                <Box component="span" color={theme.palette.grey[500]}>
                  {activity.artifact} {activity.action}
                </Box>
                <Box component="span" color={theme.palette.grey[400]}>
                  {' '}
                  • {event}
                </Box>
              </Box>
              {activity.launchItemId != null && (
                <Box
                  color={loaderData.launchItems[activity.launchItemId]?.color ?? undefined}
                  title={loaderData.launchItems[activity.launchItemId]?.label}
                >
                  {loaderData.launchItems[activity.launchItemId]?.key}
                </Box>
              )}
              {activity.priority != null && (
                <Box fontWeight="600" color={priorityColors[activity.priority] ?? undefined}>
                  {prioritySymbols[activity.priority] ?? ''}
                </Box>
              )}
              {activity.phase && <Box>{activity.phase}</Box>}
              {activity.effort && (
                <>
                  <EffortIcon sx={{ fontSize: '14px', pr: '4px' }} />
                  {activity.effort}
                </>
              )}
              <IconButton
                size="small"
                title="View JSON"
                onClick={e => setCodePopover({ element: e.currentTarget, content: activity })}
              >
                <DataObjectIcon sx={{ fontSize: '14px' }} />
              </IconButton>
            </Stack>
          </Stack>
          <Box height="15px" />
        </Box>
      </Box>
    );
  };

  const rowCount = hasNextPage ? activities.length + 1 : activities.length;

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      onDateRangeRefresh={loadNewRows}
      showProgress={isLoading}
    >
      {errorAlert(fetchedActivities?.error?.message)}
      <CodePopover
        popover={codePopover}
        onClose={() => setCodePopover(null)}
        customerId={loaderData.customerId}
        options={{ linkifyActivityId: true }}
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
        <AutoSizer>
          {({ height, width }) => (
            <InfiniteLoader
              isItemLoaded={isRowLoaded}
              itemCount={rowCount}
              loadMoreItems={loadMoreRows}
              minimumBatchSize={PAGE_SIZE}
              threshold={THRESHOLD}
            >
              {({ onItemsRendered, ref }) => (
                <VariableSizeList
                  itemSize={getRowSize}
                  width={width}
                  height={height}
                  itemCount={rowCount}
                  ref={elem => {
                    ref(elem);
                    listRef.current = elem;
                  }}
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
