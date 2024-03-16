import PersonIcon from '@mui/icons-material/Person';
import { Alert, Box, Link, Stack, Tooltip, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { LoaderFunctionArgs, redirect } from '@remix-run/node';
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
import { dataGridCommonProps, dateColdDef, ellipsisSx } from '../utils/jsxUtils';

const logger = pino({ name: 'route:activity.user' });

const priorityLabels: Record<number, string> = {
  1: 'Highest',
  2: 'High',
  3: 'Medium',
  4: 'Low',
  5: 'Lowest',
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
  const [error, setError] = useState('');

  const [gotSnapshot, setGotSnapshot] = useState(false);
  const [activities, setActivities] = useState<UserActivityRow[]>([]);

  const setRows = (querySnapshot: firebase.firestore.QuerySnapshot) => {
    try {
      setActivities(userActivityRows(querySnapshot));
      setGotSnapshot(true);
    } catch (e: unknown) {
      setError(errMsg(e, 'Error parsing user activities'));
    }
  };

  // Firestore listeners
  useEffect(() => {
    if (!dateFilter || !sessionData.userId) {
      return;
    }
    setError('');
    setGotSnapshot(false);
    const startDate = dateFilterToStartDate(dateFilter);
    const query = firestoreClient
      .collection(`customers/${sessionData.customerId}/activities/`)
      .where('actorAccountId', '==', sessionData.userId)
      .orderBy('createdTimestamp')
      .startAt(startDate)
      .limit(1000); // FIXME limit
    const unsubscribe = query.onSnapshot(
      snapshot => setRows(snapshot),
      error => setError(error.message)
    );
    return unsubscribe;
  }, [dateFilter, sessionData.customerId, sessionData.userId]);

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

  return (
    <App
      view="activity.review"
      isLoggedIn={true}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      showProgress={!gotSnapshot || (prevDateFilter && dateFilter !== prevDateFilter)}
    >
      <Stack sx={{ m: 3 }}>
        {gotSnapshot && sessionData.userId && (
          <>
            <Typography variant="h6" alignItems="center" sx={{ display: 'flex', mb: 1 }}>
              <PersonIcon sx={{ mr: 1 }} />
              {sessionData.actors[sessionData.userId]?.name ?? 'Unknown user'}
            </Typography>
            <DataGrid columns={columns} rows={activities} {...dataGridCommonProps} rowHeight={50} />
          </>
        )}
        {error && (
          <Alert severity="error" variant="standard" sx={{ mb: 1 }}>
            {error}
          </Alert>
        )}
      </Stack>
    </App>
  );
}
