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
import {
  BarChart,
  ChartsAxisContentProps,
  DefaultChartsAxisTooltipContent,
  PieChart,
  PieValueType,
  pieArcLabelClasses,
} from '@mui/x-charts';
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
import { ellipsisSx, openUserActivity } from '../utils/jsxUtils';
import { priorityColors, priorityLabels } from '../utils/theme';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return { ...sessionData, loading: true };
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

    return { groupedActivities, initiatives, actors, error: null };
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
  const { groupedActivities, actors, initiatives, error } = data ?? {
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
  const [dateRangeLabel, setDateRangeLabel] = useState(
    dateFilter ? dateRangeLabels[dateFilter] : 'New'
  );
  const [loading, setLoading] = useState(sessionData.loading);

  const pluralizeMemo = memoize(pluralize);

  const priorityDefs: Record<number, Omit<PieValueType, 'value'>> = {
    1: { id: 1, label: priorityLabels[1], color: priorityColors[1] },
    2: { id: 2, label: priorityLabels[2], color: priorityColors[2] },
    3: { id: 3, label: priorityLabels[3], color: priorityColors[3] },
    4: { id: 4, label: priorityLabels[4], color: priorityColors[4] },
    5: { id: 5, label: priorityLabels[5], color: priorityColors[5] },
  };

  const topCreatorActions: Record<string, { sortOrder: number; label: string }> = {
    'task-created': { sortOrder: 1, label: 'Task creation' },
    'task-updated': { sortOrder: 2, label: 'Task update' },
    'task-deleted': { sortOrder: 3, label: 'Task deletion' },
    'task-disabled': { sortOrder: 4, label: 'Task disable' },
    'taskOrg-created': { sortOrder: 5, label: 'Task organization creation' },
    'taskOrg-updated': { sortOrder: 6, label: 'Task organization update' },
    'code-created': { sortOrder: 7, label: 'Code creation' },
    'code-updated': { sortOrder: 8, label: 'Code update' },
    'code-deleted': { sortOrder: 9, label: 'Code deletion' },
    'code-unknown': { sortOrder: 10, label: 'Code [unknown]' },
    'codeOrg-created': { sortOrder: 11, label: 'Code organization creation' },
    'codeOrg-updated': { sortOrder: 12, label: 'Code organization update' },
  };

  const commonPaperSx = { width: 320, p: 1 };

  const widgetSize = { width: 300, height: 260 };

  const totalColor = '#2E96FF';
  const dateRangeColor = '#02B2AF';

  const widgetTitle = (title: string) => (
    <Typography
      fontSize="14px"
      sx={{
        mb: 2,
        borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)',
        whiteSpace: 'nowrap',
        ...ellipsisSx,
      }}
    >
      {title}
    </Typography>
  );

  useEffect(() => {
    if (groupedActivities) {
      setLoading(false);
      setDateRangeLabel(dateFilter ? dateRangeLabels[dateFilter] : 'New');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupedActivities]); // dateFilter must be omitted

  // Hand the date range over to server
  useEffect(() => {
    if (!dateFilter) {
      return;
    }
    submit({ dateFilter }, { method: 'post' });
  }, [dateFilter, submit]);

  useEffect(() => {
    // happens for a dev hot reload
    if (sessionData.loading) {
      setLoading(true);
    }
  }, [sessionData.loading]);

  const ContributorsByInitiativeTooltipContent = (props: ChartsAxisContentProps) => {
    return initiatives ?
        <DefaultChartsAxisTooltipContent
          {...props}
          axisValue={initiatives[props.axisValue as string]?.label ?? (props.axisValue as string)}
        />
      : <DefaultChartsAxisTooltipContent {...props} />;
  };

  const widgets =
    !groupedActivities ?
      <></>
    : <Stack spacing={3} sx={{ mx: 3, mt: 2, mb: 3 }}>
        <Grid container spacing={5} sx={{ m: 3 }}>
          {!!groupedActivities.initiatives.length && (
            <Grid>
              <Paper variant="outlined" sx={{ ...commonPaperSx }}>
                {widgetTitle('Effort by Initiative')}
                <PieChart
                  series={[
                    {
                      id: 'effort-by-initiative',
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
                    },
                  ]}
                  margin={{ left: 100 }}
                  sx={{ [`& .${pieArcLabelClasses.root}`]: { fill: 'white' } }}
                  {...widgetSize}
                  slotProps={{ legend: { hidden: true } }}
                />
              </Paper>
              <Typography
                variant="caption"
                justifyContent="center"
                sx={{ mt: -3, display: 'flex' }}
              >
                simulated
              </Typography>
            </Grid>
          )}
          {!!groupedActivities.priorities.length && (
            <Grid>
              <Paper variant="outlined" sx={{ ...commonPaperSx }}>
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
          )}
          {!!groupedActivities.initiatives.length && (
            <Grid>
              <Paper variant="outlined" sx={{ ...commonPaperSx }}>
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
                  tooltip={{ trigger: 'axis', axisContent: ContributorsByInitiativeTooltipContent }}
                />
              </Paper>
            </Grid>
          )}
        </Grid>
        <Accordion variant="outlined" disableGutters defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Activities by Initiative
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Grid container spacing={5}>
              {groupedActivities.initiatives.map(initiative => {
                const totalCounters = initiatives[initiative.id].counters.activities;
                return (
                  <Grid key={initiative.id}>
                    <Paper variant="outlined" sx={{ ...commonPaperSx }}>
                      {widgetTitle(initiatives[initiative.id].label!)}
                      <BarChart
                        series={[
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
                            color: dateRangeColor,
                            stack: 'total',
                          },
                          {
                            id: `${initiative.id} total`,
                            data: [
                              // max() is useful is totalCounters are behind (updated every hour only)
                              Math.max(totalCounters.code, initiative.count.code),
                              Math.max(totalCounters.task, initiative.count.task),
                              Math.max(totalCounters.codeOrg, initiative.count.codeOrg),
                              Math.max(totalCounters.taskOrg, initiative.count.taskOrg),
                            ],
                            valueFormatter: value =>
                              `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                            label: 'Total',
                            color: totalColor,
                            stack: 'total',
                          },
                        ]}
                        xAxis={[
                          {
                            data: ['Dev', 'Task', 'Dev Org', 'Task Org'],
                            scaleType: 'band',
                            tickLabelStyle: { angle: -45, textAnchor: 'end' },
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
        <Accordion variant="outlined" disableGutters defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Active Contributors</AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Grid container spacing={5}>
              {Object.keys(groupedActivities.topActors)
                .sort(
                  (a, b) =>
                    (topCreatorActions[a]?.sortOrder ?? 999) -
                    (topCreatorActions[b]?.sortOrder ?? 999)
                )
                .map(action => {
                  return (
                    <Grid key={action}>
                      <Paper variant="outlined" sx={{ ...commonPaperSx }}>
                        {widgetTitle(topCreatorActions[action]?.label ?? action)}
                        <BarChart
                          series={[
                            {
                              id: `top-actors-${action}`,
                              valueFormatter: value =>
                                `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                              data: groupedActivities.topActors[action].map(a => a.count),
                              color: dateRangeColor,
                            },
                          ]}
                          yAxis={[
                            {
                              data: groupedActivities.topActors[action].map(a =>
                                a.id === TOP_ACTORS_OTHERS_ID ?
                                  'All others'
                                : actors[a.id]?.name ?? 'unknown'
                              ),
                              scaleType: 'band',
                            },
                          ]}
                          xAxis={[{ tickMinStep: 1 }]}
                          onItemClick={(event, data) => {
                            if (data) {
                              openUserActivity(
                                event.nativeEvent,
                                data.dataIndex === 10 ?
                                  '*'
                                : groupedActivities.topActors[action][data.dataIndex].id
                              );
                            }
                          }}
                          onAxisClick={(event, data) => {
                            if (data) {
                              openUserActivity(
                                event,
                                data.dataIndex === 10 ?
                                  '*'
                                : groupedActivities.topActors[action][data.dataIndex].id
                              );
                            }
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
