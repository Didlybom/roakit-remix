import {
  DataObject as DataObjectIcon,
  Timelapse as EffortIcon,
  GitHub as GitHubIcon,
  Refresh as RefreshIcon,
  ThumbUpAlt as ThumbUpIcon,
  ThumbUpOffAlt as ThumbUpOffIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  GlobalStyles,
  IconButton,
  Link,
  Snackbar,
  Stack,
  Tooltip,
} from '@mui/material';
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useSubmit } from '@remix-run/react';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { VariableSizeList } from 'react-window';
import { getActivityUrl } from '../activityProcessors/activityDescription';
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
import ClickableAvatar from '../components/ClickableAvatar';
import type { CodePopoverContent } from '../components/CodePopover';
import CodePopover from '../components/CodePopover';
import HelperText from '../components/HelperText';
import InfiniteList from '../components/InfiniteList';
import { firestore } from '../firebase.server';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  fetchLaunchItemMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import ConfluenceIcon from '../icons/Confluence';
import JiraIcon from '../icons/Jira';
import { type Activity } from '../types/types';
import { loadSession } from '../utils/authUtils.server';
import { formatMonthDayTime } from '../utils/dateUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import {
  desktopDisplaySx,
  ellipsisSx,
  errorAlert,
  loaderErrorResponse,
  loginWithRedirectUrl,
  mobileDisplaySx,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import { pluralizeMemo } from '../utils/stringUtils';
import theme, { priorityColors, priorityLabels, prioritySymbols } from '../utils/theme';
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

const PAGE_SIZE = 50;

const feedStyles = (
  <GlobalStyles
    styles={{
      a: {
        color: theme.palette.primary.main,
        textDecoration: 'none',
      },
      em: { fontStyle: 'normal' },
      'h1, h2, h3, h4': { fontSize: 'inherit' },
      p: { marginTop: 0 },
      code: {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '11px',
        backgroundColor: theme.palette.grey[50],
        border: '1px solid',
        borderColor: theme.palette.grey[200],
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
        border: '0.5px solid',
        borderColor: theme.palette.grey[200],
        padding: '4px',
      },
      th: {
        backgroundColor: theme.palette.grey[50],
      },
    }}
  />
);

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
      userId: params.userid,
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
  const [listScrollOffset, setListScrollOffset] = useState(0);

  const listRef = useRef<VariableSizeList | null>(null);
  const heightsRef = useRef<number[]>([]);

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

  const loadNewRows = () => {
    if (newActivitiesFetcher.state !== 'idle') return;

    let query = `/fetcher/activities/page?limit=1000&combine=true&withTotal=false`; // if there are more than 1000 activities between now and activity[0] we'll miss some
    if (activities.length) {
      query += `&endBefore=${activities[0].createdTimestamp}`;
    }
    if (loaderData.activityUserIds?.length) {
      query += `&userIds=${loaderData.activityUserIds}`;
    }
    newActivitiesFetcher.load(query); // FIXME this causes rerendering even when there are no new activities
  };

  const buildActivityRows = useCallback(
    (fetchedActivities: ActivityPageResponse['activities']) => {
      const activityRows: ActivityRow[] = [];
      fetchedActivities?.forEach((activity: Activity) => {
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
    if (moreFetchedActivities.activities.length > 0) {
      setActivities(activities => [
        ...activities,
        ...buildActivityRows(moreFetchedActivities.activities),
      ]);
    }
  }, [moreFetchedActivities?.activities, buildActivityRows]);

  useEffect(() => {
    if (!newFetchedActivities?.activities) return;
    setIsLoading(false);
    setActivities(activities => [
      ...buildActivityRows(newFetchedActivities.activities),
      ...activities,
    ]);
  }, [buildActivityRows, newFetchedActivities?.activities]);

  const isRowLoaded = (activityIndex: number) => activityIndex < activities.length;

  const Row = ({ index, style }: { index: number; style: CSSProperties }) => {
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

    if (!isRowLoaded(activityIndex)) {
      return (
        <Box style={style} display="flex" justifyContent="center" pr={3}>
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
      <Stack direction="row">
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
                  <Box fontSize="12px" sx={{ visibility: { xs: 'hidden', sm: undefined } }}>
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
      <InfiniteList
        height="calc(100vh - 90px)"
        margin={3}
        head={feedStyles}
        itemCount={activities.length + 2} /* +1 helper text, +1 'loading more' */
        isItemLoaded={isRowLoaded}
        rowElement={Row}
        loadMoreItems={loadMoreRows}
        loadNewItems={loadNewRows}
        setRef={ref => (listRef.current = ref)}
        setListScrollOffset={setListScrollOffset}
        rowHeights={heightsRef.current}
        setRowHeights={heights => (heightsRef.current = heights)}
      />
    </App>
  );
}
