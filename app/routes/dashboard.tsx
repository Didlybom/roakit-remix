import { Alert, Paper, Stack, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart, BarItemIdentifier, PieChart, PieItemIdentifier } from '@mui/x-charts';
import { DataGrid, GridColDef, GridDensity, GridSortDirection } from '@mui/x-data-grid';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import retry from 'async-retry';
import pino from 'pino';
import { useEffect, useMemo, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import App from '../components/App';
import { firestore } from '../firebase.server';
import { groupActivities } from '../schemas/activityFeed';
import { ActivityMap, activitySchema, emptyActivity } from '../schemas/schemas';
import { loadSession } from '../utils/authUtils.server';
import { DATE_RANGE_LOCAL_STORAGE_KEY, DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { ParseError, errMsg } from '../utils/errorUtils';
import {
  fetchActorMap,
  fetchInitiativeMap,
  updateInitiativeCounters,
} from '../utils/firestoreUtils.server';
import { dateColdDef, renderJson } from '../utils/jsxUtils';
import { withMetricsAsync } from '../utils/withMetrics.server';

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
  if (!sessionData.customerId) {
    throw Error('Unexpected empty customerId');
  }

  const clientData = await request.formData();
  const dateFilter = clientData.get('dateFilter')?.toString() ?? '';
  if (!dateFilter) {
    return null; // client effect posts the dateFilter (read from local storage) the code below needs
  }

  try {
    // retrieve initiatives and users
    const [fetchedInitiatives, actors] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId),
      fetchActorMap(sessionData.customerId),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    const initiatives = await updateInitiativeCounters(sessionData.customerId, fetchedInitiatives);

    // retrieve activities
    const startDate = dateFilterToStartDate(dateFilter as DateRange);

    return await retry(
      async bail => {
        const activitiesCollection = firestore
          .collection('customers/' + sessionData.customerId + '/activities')
          .orderBy('createdTimestamp')
          .startAt(startDate)
          .limit(5000); // FIXME limit
        const activityDocs = await withMetricsAsync<FirebaseFirestore.QuerySnapshot>(
          () => activitiesCollection.get(),
          { metricsName: 'dashboard:getActivities' }
        );
        const activities: ActivityMap = {};
        activityDocs.forEach(activity => {
          const props = activitySchema.safeParse(activity.data());
          if (!props.success) {
            bail(new ParseError('Failed to parse activities. ' + props.error.message));
            return emptyActivity; // not used, bail() will throw
          }
          activities[activity.id] = {
            action: props.data.action,
            actorId: props.data.actorAccountId,
            artifact: props.data.artifact,
            createdTimestamp: props.data.createdTimestamp,
            initiativeId: props.data.initiative,
          };
        });
        const groupedActivities = groupActivities(activities);
        return { groupedActivities, activities, initiatives, actors, error: null };
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
    return {
      error: errMsg(e, 'Failed to fetch activity'),
      groupedActivities: null,
      activities: null,
      actors: null,
      initiatives: null,
    };
  }
};

export default function Dashboard() {
  const sessionData = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const { groupedActivities, activities, actors, initiatives, error } = data ?? {
    groupedActivities: null,
    activities: null,
    actors: null,
    initiatives: null,
  };
  const isHydrated = useHydrated();
  const submit = useSubmit();
  const [dateFilterLS, setDateFilter] = useLocalStorageState(DATE_RANGE_LOCAL_STORAGE_KEY, {
    defaultValue: DateRange.OneDay,
  });
  const dateFilter = isHydrated ? dateFilterLS : undefined;
  const [loading, setLoading] = useState(true);
  const [clickedOn, setClickedOn] = useState<BarItemIdentifier | PieItemIdentifier | null>(null);

  const commonPaperSx = { width: 380, p: 1 };

  const dataGridProps = {
    density: 'compact' as GridDensity,
    disableRowSelectionOnClick: true,
    disableColumnMenu: true,
    pageSizeOptions: [25, 50, 100],
    initialState: {
      pagination: { paginationModel: { pageSize: 25 } },
      sorting: { sortModel: [{ field: 'date', sort: 'desc' as GridSortDirection }] },
    },
  };

  useEffect(() => {
    if (activities) {
      setLoading(false);
    }
  }, [activities]);

  // Hand the date range over to server
  useEffect(() => {
    if (!dateFilter || !loading) {
      return;
    }
    submit({ dateFilter }, { method: 'post' });
  }, [dateFilter, loading, submit]);

  const actorColumns: GridColDef[] = useMemo<GridColDef[]>(
    () => [
      dateColdDef(),
      { field: 'action', headerName: 'Action', width: 100 },
      { field: 'artifact', headerName: 'Artifact', width: 100 },
      { field: 'initiativeId', headerName: 'Initiative', minWidth: 80 },
    ],
    []
  );

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
      {error && (
        <Alert severity="error" sx={{ m: 2 }}>
          {error}
        </Alert>
      )}
      {activities && data && (
        <Grid container justifyContent="center" spacing={5} sx={{ my: 5 }}>
          {data.groupedActivities?.initiatives.length && (
            <Grid>
              <Paper sx={{ ...commonPaperSx }}>
                <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                  Effort by Initiative
                </Typography>
                <PieChart
                  series={[
                    {
                      id: 'effort-by-initiative',
                      valueFormatter: item => `${item.value}`,
                      data: data.groupedActivities.initiatives.map(initiative => {
                        return {
                          id: initiative.id,
                          value: initiative.effort,
                          label: data.initiatives[initiative.id].label,
                          arcLabel: initiative.id,
                        };
                      }),
                      arcLabel: item => `${item.arcLabel}`,
                      innerRadius: 30,
                      paddingAngle: 3,
                      cornerRadius: 5,
                    },
                  ]}
                  onItemClick={(_, item) => setClickedOn(item)}
                  sx={{ ml: '100px' }}
                  width={360}
                  height={280}
                  slotProps={{ legend: { hidden: true } }}
                />
              </Paper>
            </Grid>
          )}
          {data.groupedActivities?.initiatives.length && (
            <Grid>
              <Paper sx={{ ...commonPaperSx }}>
                <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                  Contributors by Initiative
                </Typography>
                <BarChart
                  series={[
                    {
                      id: 'actors',
                      data: data.groupedActivities.initiatives.map(i => i.actorIds.length),
                      label: 'Contributors',
                      stack: 'total',
                    },
                  ]}
                  xAxis={[
                    {
                      data: data.groupedActivities.initiatives.map(i => i.id),
                      scaleType: 'band',
                    },
                  ]}
                  onItemClick={(_, item) => setClickedOn(item)}
                  width={360}
                  height={280}
                  slotProps={{
                    legend: { hidden: true },
                  }}
                />
              </Paper>
            </Grid>
          )}
          {data.groupedActivities?.initiatives.map((initiative, i) => {
            const totalCounters = initiatives[initiative.id].counters.activities;
            return (
              <Grid key={i}>
                <Paper sx={{ ...commonPaperSx }}>
                  <Typography textAlign="center" variant="h6" sx={{ mb: 2 }}>
                    {initiatives[initiative.id].label}
                  </Typography>
                  <BarChart
                    series={[
                      {
                        id: `${initiative.id} total`,
                        data: [
                          totalCounters.code,
                          totalCounters.task,
                          totalCounters.codeOrg,
                          totalCounters.taskOrg,
                        ],
                        label: 'Total',
                        stack: 'total',
                      },
                      {
                        id: `${initiative.id} new`,
                        data: [
                          initiative.activityCount.code,
                          initiative.activityCount.task,
                          initiative.activityCount.codeOrg,
                          initiative.activityCount.taskOrg,
                        ],
                        label: 'New',
                        stack: 'total',
                      },
                    ]}
                    xAxis={[
                      {
                        data: ['Dev', 'Task', 'Dev Org.', 'Task Org.'],
                        scaleType: 'band',
                      },
                    ]}
                    onItemClick={(_, item) => setClickedOn(item)}
                    width={360}
                    height={280}
                    slotProps={{
                      legend: {
                        direction: 'row',
                        position: { vertical: 'bottom', horizontal: 'middle' },
                        itemMarkHeight: 6,
                        labelStyle: { fontSize: 12 },
                      },
                    }}
                  />
                </Paper>
              </Grid>
            );
          })}
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
                onItemClick={(_, item) => setClickedOn(item)}
                sx={{ ml: '100px' }}
                width={360}
                height={280}
                slotProps={{ legend: { hidden: true } }}
              />
            </Paper>
          </Grid>
          {groupedActivities.actors.map(actor => {
            return (
              <Grid key={actor.id} sx={{ mb: 4 }}>
                <Typography variant="h6">{actors[actor.id]?.name ?? 'unknown'}</Typography>
                <DataGrid
                  {...dataGridProps}
                  columns={actorColumns}
                  rows={actor.activityIds.map(activityId => {
                    const activity = activities[activityId];
                    return {
                      id: activityId,
                      date: new Date(activity.createdTimestamp),
                      action: activity.action,
                      artifact: activity.artifact,
                      initiativeId: activity.initiativeId,
                    };
                  })}
                />
              </Grid>
            );
          })}
        </Grid>
      )}
      <Typography fontSize="small" textAlign="center">
        <code>{!!clickedOn && JSON.stringify(clickedOn)}</code>
      </Typography>
      {false && activities && (
        <Stack direction="row">
          <Typography component="div" fontSize="small" sx={{ p: 2 }}>
            <b>grouped activities</b> {renderJson(groupedActivities)}
          </Typography>
          <Typography component="div" fontSize="small" sx={{ p: 2 }}>
            <b>raw activities</b> {renderJson(activities)}
          </Typography>
          <Typography component="div" fontSize="small" sx={{ p: 2 }}>
            <b>actors</b> {renderJson(actors)}
          </Typography>
          <Typography component="div" fontSize="small" sx={{ p: 2 }}>
            <b>initiatives</b> {renderJson(initiatives)}
          </Typography>
        </Stack>
      )}
    </App>
  );
}
