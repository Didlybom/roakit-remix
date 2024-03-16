import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart, PieChart, PieValueType, pieArcLabelClasses } from '@mui/x-charts';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useActionData, useLoaderData, useSubmit } from '@remix-run/react';
import memoize from 'fast-memoize';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import { useHydrated } from 'remix-utils/use-hydrated';
import useLocalStorageState from 'use-local-storage-state';
import App from '../components/App';
import {
  fetchActivities,
  fetchActorMap,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { updateInitiativeCounters } from '../firestore.server/updaters.server';
import { TOP_ACTORS_OTHERS_ID, groupActivities } from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import {
  DATE_RANGE_LOCAL_STORAGE_KEY,
  DateRange,
  dateFilterToStartDate,
  dateRangeLabels,
} from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { openUserActivity } from '../utils/jsxUtils';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

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
    const startDate = dateFilterToStartDate(dateFilter as DateRange)!;
    const activities = await fetchActivities(sessionData.customerId, startDate);
    const groupedActivities = groupActivities(activities);

    return { groupedActivities, activities, initiatives, actors, error: null };
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

  const pluralizeMemo = memoize(pluralize);

  const dateRangeLabel = dateFilter ? dateRangeLabels[dateFilter] : 'New';

  const priorityDefs: Record<number, Omit<PieValueType, 'value'>> = {
    1: { id: 1, label: 'Highest', color: '#f26d50' },
    2: { id: 2, label: 'High', color: '#f17c37' },
    3: { id: 3, label: 'Medium', color: '#f2c43d' },
    4: { id: 4, label: 'Low', color: '#a7ecf2' },
    5: { id: 5, label: 'Lowest', color: '#3e9cbf' },
  };

  const topCreatorActions: Record<string, string> = {
    'task-created': 'Tasks created',
    'task-updated': 'Tasks updated',
    'task-disabled': 'Tasks disabled',
    'code-created': 'New code',
    'code-updated': 'Code updates',
    'taskOrg-created': 'Task org. created',
    'taskOrg-updated': 'Task org. updated',
    'codeOrg-created': 'New dev org',
    'codeOrg-updated': 'Dev org update',
  };

  const commonPaperSx = { width: 320, p: 1 };

  const widgetSize = { width: 300, height: 260 };

  const widgetTitle = (title: string) => (
    <Typography textAlign="center" sx={{ mb: 2 }}>
      {title}
    </Typography>
  );

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

  const widgets =
    !activities ?
      <></>
    : <Stack spacing={3} sx={{ mx: 3, mt: 2, mb: 3 }}>
        <Grid container justifyContent="center" spacing={5} sx={{ m: 3 }}>
          {!!groupedActivities?.initiatives.length && (
            <Grid>
              <Paper sx={{ ...commonPaperSx }}>
                {widgetTitle('Effort by Initiative')}
                <PieChart
                  series={[
                    {
                      id: 'effort-by-initiative',
                      valueFormatter: item => `${item.value}`,
                      data: groupedActivities.initiatives.map(initiative => {
                        return {
                          id: initiative.id,
                          value: initiative.effort,
                          label: initiatives[initiative.id].label,
                        };
                      }),
                      arcLabel: item => `${item.id}`,
                      outerRadius: 100,
                      innerRadius: 30,
                      paddingAngle: 2,
                    },
                  ]}
                  margin={{ left: 100 }}
                  sx={{ [`& .${pieArcLabelClasses.root}`]: { fill: 'white' } }}
                  {...widgetSize}
                  slotProps={{ legend: { hidden: true } }}
                />
              </Paper>
              <Typography variant="caption" justifyContent="center" sx={{ display: 'flex' }}>
                simulated
              </Typography>
            </Grid>
          )}
          <Grid>
            <Paper sx={{ ...commonPaperSx }}>
              {widgetTitle('Activities by Priority')}
              <PieChart
                series={[
                  {
                    id: 'activity-by-priority',
                    valueFormatter: item =>
                      `${item.value} ${pluralizeMemo('activity', item.value)}`,
                    data: groupedActivities.priorities.map(p => {
                      return { value: p.count, ...priorityDefs[p.id] };
                    }),
                    outerRadius: 100,
                  },
                ]}
                margin={{ left: 100 }}
                {...widgetSize}
                slotProps={{ legend: { hidden: true } }}
              />
            </Paper>
          </Grid>
          {!!groupedActivities?.initiatives.length && (
            <Grid>
              <Paper sx={{ ...commonPaperSx }}>
                {widgetTitle('Contributors by Initiative')}
                <BarChart
                  series={[
                    {
                      id: 'contributors-by-initiative',
                      valueFormatter: value =>
                        `${value} ${pluralizeMemo('contributor', value ?? 0)}`,
                      data: groupedActivities.initiatives.map(i => i.actorCount),
                    },
                  ]}
                  yAxis={[
                    { data: groupedActivities.initiatives.map(i => i.id), scaleType: 'band' },
                  ]}
                  xAxis={[{ tickMinStep: 1 }]}
                  layout="horizontal"
                  {...widgetSize}
                  slotProps={{ legend: { hidden: true } }}
                />
              </Paper>
            </Grid>
          )}
        </Grid>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <strong>Activities by Initiative</strong>
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2 }}>
            <Grid container justifyContent="center" spacing={5}>
              {groupedActivities?.initiatives.map(initiative => {
                const totalCounters = initiatives[initiative.id].counters.activities;
                return (
                  <Grid key={initiative.id}>
                    <Paper sx={{ ...commonPaperSx }}>
                      <Typography textAlign="center" sx={{ mb: 2 }}>
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
                            valueFormatter: value =>
                              `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                            label: 'Total',
                            stack: 'total',
                          },
                          {
                            id: `${initiative.id} new`,
                            data: [
                              initiative.count.code,
                              initiative.count.task,
                              initiative.count.codeOrg,
                              initiative.count.taskOrg,
                            ],
                            valueFormatter: value =>
                              `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                            label: dateRangeLabel,
                            stack: 'total',
                          },
                        ]}
                        xAxis={[
                          {
                            data: ['Dev', 'Task', 'Dev Org', 'Task Org'],
                            scaleType: 'band',
                            tickLabelStyle: { angle: 45, textAnchor: 'start' },
                            tickMinStep: 1,
                            tickMaxStep: 1,
                          },
                        ]}
                        yAxis={[{ tickMinStep: 1 }]}
                        {...widgetSize}
                        margin={{ bottom: 60 }}
                        slotProps={{
                          legend: {
                            direction: 'row',
                            position: { vertical: 'top', horizontal: 'middle' },
                            itemMarkHeight: 10,
                            itemGap: 20,
                            padding: 0,
                            labelStyle: { fontSize: 12 },
                          },
                        }}
                      />
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </AccordionDetails>
        </Accordion>
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <strong>Top Contributors</strong>
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2 }}>
            <Grid container justifyContent="center" spacing={5}>
              {Object.keys(groupedActivities?.topActors).map(action => {
                return (
                  <Grid key={action}>
                    <Paper sx={{ ...commonPaperSx }}>
                      {widgetTitle(topCreatorActions[action] ?? action)}
                      <BarChart
                        series={[
                          {
                            id: `top-actors-${action}`,
                            valueFormatter: value =>
                              `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                            data: groupedActivities.topActors[action].map(a => a.count),
                          },
                        ]}
                        yAxis={[
                          {
                            data: groupedActivities.topActors[action].map(a =>
                              a.id === TOP_ACTORS_OTHERS_ID ?
                                'All others'
                              : actors[a.id].name ?? 'unknown'
                            ),
                            scaleType: 'band',
                          },
                        ]}
                        xAxis={[{ tickMinStep: 1 }]}
                        onItemClick={(e, item) => {
                          if (item.dataIndex === 10) {
                            return;
                          }
                          openUserActivity(
                            e.nativeEvent,
                            groupedActivities.topActors[action][item.dataIndex].id
                          );
                        }}
                        layout="horizontal"
                        {...widgetSize}
                        margin={{ top: 10, right: 20, bottom: 30, left: 170 }}
                        slotProps={{ legend: { hidden: true } }}
                      />
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </Stack>;

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
      {widgets}
    </App>
  );
}
