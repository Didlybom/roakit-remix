import { Alert, Paper, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart, BarItemIdentifier, PieChart, PieItemIdentifier } from '@mui/x-charts';
import { ActionFunctionArgs, LoaderFunctionArgs, json, redirect } from '@remix-run/node';
import { useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import retry from 'async-retry';
import pino from 'pino';
import { useEffect, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { ACTIVITY_TYPES, ActivityData, activitySchema, emptyActivity } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  ONE_HOUR,
  dateFilterToStartDate,
} from '../utils/dateUtils';
import { ParseError } from '../utils/errorUtils';
import { fetchActorMap, fetchInitiatives } from '../utils/firestoreUtils.server';

const logger = pino({ name: 'route:dashboard' });

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return sessionData;
};

// load activities
export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const clientData = await request.formData();
  const dateFilter = clientData.get('dateFilter')?.toString() ?? '';
  if (!dateFilter) {
    return null; // client effect posts the dateFilter (read from local storage) the code below needs
  }

  try {
    // retrieve initiatives and users
    const [initiatives, actors] = await Promise.all([
      fetchInitiatives(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    const now = Date.now();
    const oneHourAgo = now - ONE_HOUR;
    const flatCounters: {
      initiativeId: string;
      activityType: ActivityData['type'];
      lastUpdated: number;
    }[] = [];
    initiatives.forEach(initiative => {
      if (initiative.countersLastUpdated >= oneHourAgo) {
        return;
      }
      ACTIVITY_TYPES.forEach(activityType => {
        flatCounters.push({
          initiativeId: initiative.id,
          activityType,
          lastUpdated: initiative.countersLastUpdated,
        });
      });
    });
    const newFlatCounts = await Promise.all(
      flatCounters.map(async counter => {
        const countQuery = firestore
          .collection('customers/' + sessionData.customerId + '/activities')
          .where('type', '==', counter.activityType)
          .orderBy('date')
          .startAt(counter.lastUpdated)
          .count();
        const count = (await countQuery.get()).data().count;
        return { ...counter, count };
      })
    );
    newFlatCounts.forEach(flatCount => {
      const initiative = initiatives.find(i => i.id === flatCount.initiativeId);
      initiative!.counters.activities[flatCount.activityType] =
        initiative!.counters.activities[flatCount.activityType] + flatCount.count;
      initiative!.countersLastUpdated = now;
    });
    await Promise.all(
      initiatives.map(async initiative => {
        const initiativeDoc = firestore.doc(
          'customers/' + sessionData.customerId + '/initiatives/' + initiative.id
        );
        await initiativeDoc.set(
          { counters: initiative.counters, countersLastUpdated: initiative.countersLastUpdated },
          { merge: true }
        );
      })
    );

    // retrieve activities
    const startDate = dateFilterToStartDate(dateFilter as DateRange);
    return await retry(
      async bail => {
        const activitiesCollection = firestore
          .collection('customers/' + sessionData.customerId + '/activities')
          .orderBy('date')
          .startAt(startDate)
          .limit(5000) // FIXME limit
          .withConverter({
            fromFirestore: snapshot => {
              const props = activitySchema.safeParse(snapshot.data());
              if (!props.success) {
                bail(new ParseError('Failed to parse activities. ' + props.error.message));
                return emptyActivity; // not used, bail() will throw
              }
              return {
                id: snapshot.id,
                action: props.data.action,
                actorId: props.data.actorId,
                type: props.data.type,
                date: props.data.date,
                initiativeId: props.data.initiativeId,
              };
            },
            toFirestore: activity => activity,
          });
        const activityDocs = await activitiesCollection.get();
        const activities: ActivityData[] = [];
        activityDocs.forEach(activity => {
          activities.push(activity.data());
        });
        return json({ activities, initiatives, actors });
      },
      {
        // see https://github.com/tim-kos/node-retry#api
        retries: 2,
        factor: 2,
        minTimeout: 500,
        onRetry: e => logger.warn(`Retrying activity fetch... ${e.message}`),
      }
    );
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export default function Dashboard() {
  const sessionData = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const isHydrated = useHydrated();
  const submit = useSubmit();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState(data?.activities);
  const [error /*, setError*/] = useState('');
  const [clickedOn, setClickedOn] = useState<BarItemIdentifier | PieItemIdentifier | null>(null);

  const commonPaperSx = { width: 380, p: 1 };
  const commonChartProps = {
    width: 360,
    height: 200,
    slotProps: {
      legend: { labelStyle: { fontSize: 12 } },
    },
  };

  useEffect(() => {
    if (data) {
      setActivities(data.activities);
      setLoading(false);
    }
  }, [data]);

  // Hand the date range over to server
  useEffect(() => {
    if (!dateFilter || !loading) {
      return;
    }
    submit({ dateFilter }, { method: 'post' });
  }, [dateFilter, loading, submit]);

  return (
    <App
      view="dashboard"
      isLoggedIn={sessionData.isLoggedIn}
      isNavOpen={true}
      dateRange={dateFilter}
      onDateRangeSelect={dateFilter => {
        setDateFilter(dateFilter);
        setLoading(true);
      }}
      showProgress={loading}
    >
      {activities && (
        <Grid container justifyContent="center" spacing={5} sx={{ my: 5 }}>
          <Grid>
            <Paper sx={{ ...commonPaperSx }}>
              <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                Effort by Initiative
              </Typography>
              <PieChart
                series={[
                  {
                    id: 'effort-by-initiative',
                    valueFormatter: item => `${item.value}%`,
                    data: [
                      { id: 1, value: 70, label: 'Initiative B' },
                      { id: 2, value: 10, label: 'Initiative A' },
                      { id: 3, value: 5, label: 'Initiative D' },
                      { id: 4, value: 15, label: 'Initiative C' },
                    ],
                  },
                ]}
                {...commonChartProps}
                onItemClick={(_, item) => setClickedOn(item)}
              />
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ ...commonPaperSx }}>
              <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                Contributors by Initiative
              </Typography>
              <BarChart
                series={[
                  { id: 'actors total', data: [20, 15, 5, 30], label: 'Total', stack: 'total' },
                  { id: 'actors new', data: [3, 2, 0, 5], label: 'New', stack: 'total' },
                ]}
                xAxis={[
                  {
                    data: ['Initiative A', 'Initiative B', 'Initiative C', 'Initiative D'],
                    scaleType: 'band',
                  },
                ]}
                {...commonChartProps}
                onItemClick={(_, item) => setClickedOn(item)}
              />
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ ...commonPaperSx }}>
              <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                Initiative A Activity
              </Typography>
              <BarChart
                series={[
                  { id: 'init A total', data: [20, 35, 10, 5], label: 'Total', stack: 'total' },
                  { id: 'init A new', data: [3, 4, 0, 1], label: 'New', stack: 'total' },
                ]}
                xAxis={[
                  {
                    data: ['Software', 'Task', 'Software Org.', 'Task Org.'],
                    scaleType: 'band',
                  },
                ]}
                {...commonChartProps}
                onItemClick={(_, item) => setClickedOn(item)}
              />
            </Paper>
          </Grid>
          <Grid>
            <Paper sx={{ ...commonPaperSx }}>
              <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                Activity by Priority
              </Typography>
              <PieChart
                series={[
                  {
                    id: 'activity-by-priority',
                    valueFormatter: item => `${item.value}%`,
                    data: [
                      { id: 1, value: 5, label: 'Highest', color: '#f26d50' },
                      { id: 2, value: 10, label: 'High', color: '#f17c37' },
                      { id: 3, value: 75, label: 'Medium', color: '#f2c43d' },
                      { id: 4, value: 10, label: 'Low', color: '#a7ecf2' },
                      { id: 5, value: 0, label: 'Lowest', color: '#3e9cbf' },
                    ],
                  },
                ]}
                {...commonChartProps}
                onItemClick={(_, item) => setClickedOn(item)}
              />
            </Paper>
          </Grid>
        </Grid>
      )}
      <Typography fontSize="small" textAlign="center">
        <code>{!!clickedOn && JSON.stringify(clickedOn)}</code>
      </Typography>
      <Typography fontSize="small" sx={{ p: 2 }}>
        <code>{JSON.stringify(activities)}</code>
      </Typography>
      <Typography fontSize="small" sx={{ p: 2 }}>
        <code>{JSON.stringify(data?.actors)}</code>
      </Typography>
      <Typography fontSize="small" sx={{ p: 2 }}>
        <code>{JSON.stringify(data?.initiatives)}</code>
      </Typography>
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
    </App>
  );
}
