import {
  AutoAwesome as AutoAwesomeIcon,
  ExpandMore as ExpandMoreIcon,
  Science as ScienceIcon,
  ShortText as SummariesIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Unstable_Grid2 as Grid,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import {
  BarChart,
  DefaultChartsAxisTooltipContent,
  PieChart,
  pieArcLabelClasses,
  type ChartsAxisContentProps,
  type PieValueType,
} from '@mui/x-charts';
import { LoaderFunctionArgs } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigate, useNavigation } from '@remix-run/react';
import memoize from 'fast-memoize';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import App from '../components/App';
import Markdown from '../components/Markdown';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { updateInitiativeCounters } from '../firestore.server/updaters.server';
import { TOP_ACTORS_OTHERS_ID, artifactActions, identifyAccounts } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateRangeLabels } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { ellipsisSx, randomNumber, windowOpen } from '../utils/jsxUtils';
import { priorityColors, priorityLabels } from '../utils/theme';
import { SummaryResponse } from './fetcher.ai.summary.$userid';
import { GroupedActivitiesResponse } from './fetcher.grouped-activities.$daterange';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

export const shouldRevalidate = () => false;

// verify session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  try {
    // retrieve initiatives and users
    const [fetchedInitiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    // update initiative counters every hour at most [this could be done at ingestion time or triggered in a cloud function]
    const initiatives = await updateInitiativeCounters(sessionData.customerId!, fetchedInitiatives);

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors, initiatives, error: null };
  } catch (e) {
    logger.error(e);
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch actors'),
      actors: null,
      initiatives: null,
    };
  }
};

export default function Dashboard() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const summaryFetcher = useFetcher();
  const groupedActivitiesFetcher = useFetcher();
  const loaderData = useLoaderData<typeof loader>();
  const summaryResponse = summaryFetcher.data as SummaryResponse;
  const groupedActivitiesResponse = groupedActivitiesFetcher.data as GroupedActivitiesResponse;
  const [dateRange, setDateRange] = useState(loaderData.dateFilter ?? DateRange.OneDay);
  const dateRangeLabel = dateRangeLabels[dateRange];

  const pluralizeMemo = memoize(pluralize);

  const priorityDefs: Record<number, Omit<PieValueType, 'value'>> = {
    1: { id: 1, label: priorityLabels[1], color: priorityColors[1] },
    2: { id: 2, label: priorityLabels[2], color: priorityColors[2] },
    3: { id: 3, label: priorityLabels[3], color: priorityColors[3] },
    4: { id: 4, label: priorityLabels[4], color: priorityColors[4] },
    5: { id: 5, label: priorityLabels[5], color: priorityColors[5] },
  };

  const commonPaperSx = ({ isDisabled = false }: { isDisabled?: boolean }) => ({
    width: 320,
    p: 1,
    opacity: isDisabled ? 0.4 : 1,
  });

  const widgetSize = { width: 300, height: 260 };

  const totalColor = '#2E96FF';
  const dateRangeColor = '#02B2AF';

  const widgetTitle = (title: string) => (
    <Typography
      fontSize="14px"
      mb="2"
      borderBottom="solid 1px rgba(0, 0, 0, 0.12)"
      whiteSpace="noWrap"
      sx={ellipsisSx}
    >
      {title}
    </Typography>
  );

  // load grouped activities
  useEffect(() => {
    groupedActivitiesFetcher.load(`/fetcher/grouped-activities/${dateRange}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  // load AI summary
  useEffect(() => {
    summaryFetcher.load('/fetcher/ai/summary/*');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      summaryResponse?.error?.status === 401 ||
      groupedActivitiesResponse?.error?.status === 401
    ) {
      navigate('/login');
    }
  }, [groupedActivitiesResponse?.error, summaryResponse?.error, navigate]);

  const ContributorsByInitiativeTooltipContent = (props: ChartsAxisContentProps) => {
    return loaderData.initiatives ?
        <DefaultChartsAxisTooltipContent
          {...props}
          axisValue={
            loaderData.initiatives[props.axisValue as string]?.label ?? (props.axisValue as string)
          }
        />
      : <DefaultChartsAxisTooltipContent {...props} />;
  };

  const widgets = (
    <Stack spacing={3} mx={3} mt={2} mb={3}>
      <Grid container spacing={5} sx={{ m: 3 }}>
        {!!loaderData.initiatives && !!groupedActivitiesResponse?.initiatives?.length && (
          <Grid>
            <Paper
              variant="outlined"
              sx={commonPaperSx({
                isDisabled: groupedActivitiesFetcher.state === 'loading',
              })}
            >
              {widgetTitle('Effort by Initiative')}
              <PieChart
                series={[
                  {
                    id: 'effort-by-initiative',
                    data: groupedActivitiesResponse.initiatives.map(initiative => ({
                      id: initiative.id,
                      value: initiative.effort,
                      label: loaderData.initiatives[initiative.id].label,
                    })),
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
            <Typography variant="caption" justifyContent="center" sx={{ mt: -3, display: 'flex' }}>
              fake data – demo
            </Typography>
          </Grid>
        )}
        {!!groupedActivitiesResponse?.priorities?.length && (
          <Grid>
            <Paper
              variant="outlined"
              sx={commonPaperSx({
                isDisabled: groupedActivitiesFetcher.state === 'loading',
              })}
            >
              {widgetTitle('Activities by Priority')}
              <PieChart
                series={[
                  {
                    id: 'activity-by-priority',
                    valueFormatter: item =>
                      `${item.value} ${pluralizeMemo('activity', item.value)}`,
                    data: groupedActivitiesResponse.priorities.map(p => ({
                      value: p.count,
                      ...priorityDefs[p.id],
                    })),
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
        {!!groupedActivitiesResponse?.initiatives?.length && (
          <Grid>
            <Paper
              variant="outlined"
              sx={commonPaperSx({
                isDisabled: groupedActivitiesFetcher.state === 'loading',
              })}
            >
              {widgetTitle('Contributors by Initiative')}
              <BarChart
                series={[
                  {
                    id: 'contributors-by-initiative',
                    valueFormatter: value => `${value} ${pluralizeMemo('contributor', value ?? 0)}`,
                    data: groupedActivitiesResponse.initiatives.map(i => i.actorCount),
                  },
                ]}
                yAxis={[
                  { data: groupedActivitiesResponse.initiatives.map(i => i.id), scaleType: 'band' },
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
          Recent Activity AI Summary
        </AccordionSummary>
        <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
          <Typography component="div" variant="caption" mb={2} mt={-1}>
            Work in progress. Doesn&apos;t use date filter. 100 most recent activities. See also
            <Button
              href="/summaries"
              variant="outlined"
              startIcon={<SummariesIcon fontSize="small" />}
              sx={{ mx: 1, p: 1, fontSize: '.75rem', fontWeight: 400, textTransform: 'none' }}
            >
              Contributor Summary
            </Button>
            and
            <Button
              href="/ai"
              variant="outlined"
              startIcon={<ScienceIcon fontSize="small" />}
              sx={{ mx: 1, p: 1, fontSize: '.75rem', fontWeight: 400, textTransform: 'none' }}
            >
              AI Playground
            </Button>
          </Typography>
          <Paper
            variant="outlined"
            sx={{
              px: 2,
              minHeight: '200px',
              maxHeight: '400px',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <Tooltip title="AI powered">
              <AutoAwesomeIcon
                fontSize="small"
                sx={{ color: grey[400], position: 'absolute', margin: '20px', top: 0, right: 0 }}
              />
            </Tooltip>
            {summaryResponse?.summary ?
              <Box fontSize="smaller">
                <Markdown markdownText={summaryResponse.summary} />
              </Box>
            : <Stack spacing={1} m={2}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton
                    key={i}
                    height="25px"
                    width={randomNumber(20, 80) + '%'}
                    sx={{ ml: '-10px' }}
                  />
                ))}
              </Stack>
            }
          </Paper>
        </AccordionDetails>
      </Accordion>
      <Accordion variant="outlined" disableGutters defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          Activities by Initiative
        </AccordionSummary>
        <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
          <Grid container spacing={5}>
            {!!loaderData.initiatives &&
              groupedActivitiesResponse?.initiatives?.map(initiative => {
                const totalCounters = loaderData.initiatives[initiative.id].counters.activities;
                return (
                  <Grid key={initiative.id}>
                    <Paper
                      variant="outlined"
                      sx={commonPaperSx({
                        isDisabled: groupedActivitiesFetcher.state === 'loading',
                      })}
                    >
                      {widgetTitle(loaderData.initiatives[initiative.id]?.label ?? 'Unknown')}
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
            {groupedActivitiesResponse?.topActors &&
              loaderData.actors &&
              Object.keys(groupedActivitiesResponse.topActors)
                .sort(
                  (a, b) =>
                    (artifactActions.get(a)?.sortOrder ?? 999) -
                    (artifactActions.get(b)?.sortOrder ?? 999)
                )
                .map(action => (
                  <Grid key={action}>
                    <Paper
                      variant="outlined"
                      sx={{
                        ...commonPaperSx({
                          isDisabled: groupedActivitiesFetcher.state === 'loading',
                        }),
                      }}
                    >
                      {widgetTitle(artifactActions.get(action)?.label ?? action)}
                      <BarChart
                        series={[
                          {
                            id: `top-actors-${action}`,
                            valueFormatter: val => `${val} ${pluralizeMemo('activity', val ?? 0)}`,
                            data: groupedActivitiesResponse.topActors![action].map(a => a.count),
                            color: dateRangeColor,
                          },
                        ]}
                        yAxis={[
                          {
                            data: groupedActivitiesResponse.topActors![action].map(a =>
                              a.id === TOP_ACTORS_OTHERS_ID ?
                                'All others'
                              : loaderData.actors[a.id]?.name ?? 'unknown'
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
                                    groupedActivitiesResponse.topActors![action][data.dataIndex].id
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
                                    groupedActivitiesResponse.topActors![action][data.dataIndex].id
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
                ))}
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );

  return (
    <App
      view="dashboard"
      isLoggedIn={loaderData.isLoggedIn}
      dateRange={dateRange}
      onDateRangeSelect={dateRange => setDateRange(dateRange)}
      isNavOpen={loaderData.isNavOpen}
      showProgress={
        navigation.state !== 'idle' ||
        summaryFetcher.state !== 'idle' ||
        groupedActivitiesFetcher.state !== 'idle'
      }
      showPulse={false}
    >
      {!!loaderData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {loaderData?.error}
        </Alert>
      )}
      {!!summaryResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {summaryResponse.error.message}
        </Alert>
      )}
      {!!groupedActivitiesResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {groupedActivitiesResponse.error.message}
        </Alert>
      )}
      {widgets}
    </App>
  );
}
