import PersonIcon from '@mui/icons-material/Person';
import { Alert, Box, Link, Stack, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoaderFunctionArgs, MetaFunction, redirect } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import pino from 'pino';
import { useEffect, useMemo, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import usePrevious from 'use-previous';
import App from '../components/App';
import { firestore as firestoreClient } from '../firebase.client';
import { fetchActorMap, fetchInitiativeMap } from '../firestore.server/fetchers.server';
import { UserActivityRow, getSummary, getUrl, userActivityRows } from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DATE_RANGE_LOCAL_STORAGE_KEY, DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import {
  dataGridCommonProps,
  dateColdDef,
  ellipsisSx,
  internalLinkSx,
  stickySx,
} from '../utils/jsxUtils';
import { groupByAndSort } from '../utils/mapUtils';
import { caseInsensitiveCompare, removeSpaces } from '../utils/stringUtils';

const logger = pino({ name: 'route:activity.user' });

const ALL = '*';

const priorityLabels: Record<number, string> = {
  1: 'Highest',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Lowest',
};

export const meta: MetaFunction<typeof loader> = ({ data }) => {
  let title = 'User';
  if (data?.userId && data.userId !== ALL) {
    title = data.actors[data.userId]?.name ?? 'User';
  }
  return [{ title: `${title} Activity | ROAKIT` }];
};

// verify JWT, load initiatives and users
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve initiatives and users
    const [initiatives, actors] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
    ]);
    return { customerId: sessionData.customerId, userId: params.userid, initiatives, actors };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function UserActivity() {
  const sessionData = useLoaderData<typeof loader>();
  const isHydrated = useHydrated();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const prevDateFilter = usePrevious(dateFilter);
  const [scrollToActor, setScrollToActor] = useState<string | undefined>(undefined);
  const [error, setError] = useState('');

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const [activities, setActivities] = useState<Map<string, UserActivityRow[]>>(new Map());

  const actorElementId = (actor: string) => `ACTOR-${removeSpaces(actor)}`;

  // Firestore listeners
  useEffect(() => {
    const setRows = (querySnapshot: firebase.firestore.QuerySnapshot, allUsers: boolean) => {
      try {
        if (!allUsers) {
          setActivities(new Map([[sessionData.userId!, userActivityRows(querySnapshot, false)]]));
        } else {
          setActivities(
            groupByAndSort(userActivityRows(querySnapshot, true), 'actorId', (a, b) =>
              caseInsensitiveCompare(
                sessionData.actors[a]?.name ?? '',
                sessionData.actors[b]?.name ?? ''
              )
            )
          );
        }
        setGotSnapshot(true);
      } catch (e: unknown) {
        setError(errMsg(e, 'Error parsing user activities'));
      }
    };

    if (!dateFilter || !sessionData.userId) {
      return;
    }
    setError('');
    setGotSnapshot(false);
    const startDate = dateFilterToStartDate(dateFilter);
    const query =
      sessionData.userId === ALL ?
        firestoreClient
          .collection(`customers/${sessionData.customerId}/activities/`)
          .orderBy('createdTimestamp')
          .startAt(startDate)
          .limit(1000) // FIXME limit
      : firestoreClient
          .collection(`customers/${sessionData.customerId}/activities/`)
          .where('actorAccountId', '==', sessionData.userId)
          .orderBy('createdTimestamp')
          .startAt(startDate)
          .limit(1000); // FIXME limit
    const unsubscribe = query.onSnapshot(
      snapshot => setRows(snapshot, sessionData.userId === ALL),
      error => setError(error.message)
    );
    return unsubscribe;
  }, [dateFilter, sessionData.actors, sessionData.customerId, sessionData.userId]);

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
      dateColdDef(),
      { field: 'action', headerName: 'Action', width: 100 },
      { field: 'artifact', headerName: 'Artifact', width: 80 },
      {
        field: 'priority',
        headerName: 'Priority',
        width: 80,
        valueFormatter: (value: number) => priorityLabels[value] ?? 'unknown',
      },
      {
        field: 'initiativeId',
        headerName: 'Initiative',
        renderCell: params => {
          const initiativeId = params.value as string;
          return initiativeId ?
              <Tooltip title={sessionData.initiatives[initiativeId]?.label}>{params.value}</Tooltip>
            : '[unset]';
        },
        minWidth: 80,
      },
      {
        field: 'metadata',
        headerName: 'Summary',
        minWidth: 300,
        flex: 1,
        renderCell: params => {
          const summary = getSummary(params.value);
          const url = getUrl(params.value);
          return url ?
              <Link href={url} target="_blank" title={summary} sx={{ ...ellipsisSx }}>
                {summary}
              </Link>
            : <Box title={summary} sx={{ ...ellipsisSx }}>
                {summary}
              </Box>;
        },
      },
    ],
    [sessionData.initiatives]
  );

  const grids = [...activities].map(([actorId, rows]) => {
    return (
      <Stack id={actorElementId(actorId)} key={actorId} sx={{ mb: 3 }}>
        <Typography variant="h6" alignItems="center" sx={{ display: 'flex', mb: 1 }}>
          <PersonIcon sx={{ mr: 1 }} />
          {sessionData.actors[actorId]?.name ?? 'Unknown user'}
        </Typography>
        <DataGrid
          columns={columns}
          rows={rows}
          {...dataGridCommonProps}
          rowHeight={50}
          slots={{
            noRowsOverlay: () => (
              <Box height="75px" display="flex" alignItems="center" justifyContent="center">
                Not activity for these dates
              </Box>
            ),
          }}
        />
      </Stack>
    );
  });

  return (
    <App
      view="activity.user"
      isLoggedIn={true}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
    >
      <Stack sx={{ m: 3 }}>
        {activities.size === 0 && gotSnapshot ?
          <Typography textAlign="center" sx={{ m: 4 }}>
            Nothing to show for these dates
          </Typography>
        : <Stack direction="row">
            {sessionData.userId === ALL && (
              <Box sx={{ display: 'flex', mr: 2 }}>
                <Box sx={{ position: 'relative' }}>
                  <Box sx={{ ...stickySx }}>
                    {[...activities.keys()].map(actorId => (
                      <Box key={actorId}>
                        <Link
                          fontSize="small"
                          sx={internalLinkSx}
                          onClick={() => setScrollToActor(actorId)}
                        >
                          {`${sessionData.actors[actorId].name} (${activities.get(actorId)?.length ?? 0})`}
                        </Link>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            )}
            <Box sx={{ flex: 1, minWidth: 0 }}>{grids}</Box>
          </Stack>
        }
        {error && (
          <Alert severity="error" variant="standard" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
