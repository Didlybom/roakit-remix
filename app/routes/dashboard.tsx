import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Unstable_Grid2 as Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  BarChart,
  ChartsAxisContentProps,
  DefaultChartsAxisTooltipContent,
  PieChart,
  PieValueType,
  pieArcLabelClasses,
} from '@mui/x-charts';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useActionData, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import memoize from 'fast-memoize';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import App from '../components/App';
import {
  fetchAccountMap,
  fetchActivities,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { updateInitiativeCounters } from '../firestore.server/updaters.server';
import {
  TOP_ACTORS_OTHERS_ID,
  artifactActions,
  groupActivities,
  identifyAccounts,
  identifyActivities,
} from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate, dateRangeLabels } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { ellipsisSx, windowOpen } from '../utils/jsxUtils';
import { priorityColors, priorityLabels } from '../utils/theme';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

// verify session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return sessionData;
};

interface JsonRequest {
  dateFilter: DateRange;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  try {
    // retrieve initiatives and users
    const [fetchedInitiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    const initiatives = await updateInitiativeCounters(sessionData.customerId!, fetchedInitiatives);

    const jsonRequest = (await request.json()) as JsonRequest;

    // retrieve activities
    const startDate = dateFilterToStartDate(
      jsonRequest.dateFilter ?? sessionData.dateFilter ?? DateRange.OneDay
    )!;

    const activities = await fetchActivities({
      customerId: sessionData.customerId!,
      startDate,
      options: { findPriority: true },
    });
    const groupedActivities = groupActivities(
      identifyActivities(activities, identities.accountMap)
    );
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, groupedActivities, initiatives, actors, error: null };
  } catch (e) {
    logger.error(e);
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch activity'),
      groupedActivities: null,
      activities: null,
      actors: null,
      initiatives: null,
    };
  }
};

export default function Dashboard() {
  const navigation = useNavigation();
  const submit = useSubmit();
  const sessionData = useLoaderData<typeof loader>();
  const data = useActionData<typeof action>();
  const { groupedActivities, actors, initiatives, error } = data ?? {
    groupedActivities: null,
    activities: null,
    actors: null,
    initiatives: null,
  };
  const [dateFilter, setDateFilter] = useState(sessionData.dateFilter ?? DateRange.OneDay);
  const dateRangeLabel = dateRangeLabels[dateFilter];
  const [loading, setLoading] = useState(true);

  const pluralizeMemo = memoize(pluralize);

  const priorityDefs: Record<number, Omit<PieValueType, 'value'>> = {
    1: { id: 1, label: priorityLabels[1], color: priorityColors[1] },
    2: { id: 2, label: priorityLabels[2], color: priorityColors[2] },
    3: { id: 3, label: priorityLabels[3], color: priorityColors[3] },
    4: { id: 4, label: priorityLabels[4], color: priorityColors[4] },
    5: { id: 5, label: priorityLabels[5], color: priorityColors[5] },
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
    } else {
      submit({}, postJsonOptions); // ask server to do the initial load
    }
  }, [groupedActivities, submit]);

  useEffect(() => {
    setLoading(true);
    submit({ dateFilter }, postJsonOptions); // ask server to reload with new dates
  }, [dateFilter, submit]);

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
    : <Stack
        spacing={3}
        sx={{
          mx: 3,
          mt: 2,
          mb: 3,
          opacity: navigation.state !== 'idle' ? 0.5 : undefined,
        }}
      >
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
                      {widgetTitle(initiatives[initiative.id]?.label ?? 'Unknown')}
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
                    (artifactActions.get(a)?.sortOrder ?? 999) -
                    (artifactActions.get(b)?.sortOrder ?? 999)
                )
                .map(action => {
                  return (
                    <Grid key={action}>
                      <Paper variant="outlined" sx={{ ...commonPaperSx }}>
                        {widgetTitle(artifactActions.get(action)?.label ?? action)}
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
                              windowOpen(
                                event.nativeEvent,
                                `/activity/user/${
                                  data.dataIndex === 10 ?
                                    '*'
                                  : encodeURI(
                                      groupedActivities.topActors[action][data.dataIndex].id
                                    )
                                }#${action}`
                              );
                            }
                          }}
                          onAxisClick={(event, data) => {
                            if (data) {
                              windowOpen(
                                event,
                                `/activity/user/${
                                  data.dataIndex === 10 ?
                                    '*'
                                  : encodeURI(
                                      groupedActivities.topActors[action][data.dataIndex].id
                                    )
                                }#${action}`
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
      dateRange={dateFilter}
      onDateRangeSelect={dateRange => setDateFilter(dateRange)}
      isNavOpen={sessionData.isNavOpen}
      showProgress={loading || navigation.state !== 'idle'}
      showPulse={false}
    >
      {error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      )}
      {widgets}
    </App>
  );
}
