import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { BarChart } from '@mui/x-charts';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { useFetcher, useLoaderData, useNavigation } from '@remix-run/react';
import memoize from 'fast-memoize';
import Markdown from 'markdown-to-jsx';
import pino from 'pino';
import pluralize from 'pluralize';
import { useEffect, useState } from 'react';
import { appActions } from '../appActions';
import App from '../components/App';
import DateRangePicker from '../components/DateRangePicker';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { TOP_ACTORS_OTHERS_ID, artifactActions, identifyAccounts } from '../schemas/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { ellipsisSx, randomNumber, windowOpen } from '../utils/jsxUtils';
import { SummaryResponse } from './resource.summary';
import { TopActorsResponse } from './resource.top-contributors.$daterange';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

// verify session data
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve users
    const [accounts, identities] = await Promise.all([
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors, error: null };
  } catch (e) {
    logger.error(e);
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch actors'),
      actors: null,
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  return await appActions(request);
};

export default function Dashboard() {
  const navigation = useNavigation();
  const summaryFetcher = useFetcher();
  const topActorsFetcher = useFetcher();
  const sessionData = useLoaderData<typeof loader>();
  const actors = sessionData.actors;
  const summaryResponse = summaryFetcher.data as SummaryResponse;
  const topActorsResponse = topActorsFetcher.data as TopActorsResponse;
  const [contributorsDateFilter, setContributorsDateFilter] = useState(DateRange.OneDay);

  const pluralizeMemo = memoize(pluralize);

  const commonPaperSx = { width: 320, p: 1 };

  const widgetSize = { width: 300, height: 260 };

  // const totalColor = '#2E96FF';
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

  // load top actors
  useEffect(() => {
    if (!topActorsFetcher.data && topActorsFetcher.state !== 'loading') {
      topActorsFetcher.load('/resource/top-contributors/ ' + DateRange.OneDay);
    }
  }, [topActorsFetcher]);

  // load summary
  useEffect(() => {
    if (!summaryFetcher.data && summaryFetcher.state !== 'loading') {
      summaryFetcher.load('/resource/summary');
    }
  }, [summaryFetcher]);

  useEffect(() => {
    topActorsFetcher.load('/resource/top-contributors/' + contributorsDateFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contributorsDateFilter]);

  const widgets = (
    <Stack spacing={3} sx={{ mx: 3, mt: 2, mb: 3 }}>
      <Accordion variant="outlined" disableGutters defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Recent Activity Summary</AccordionSummary>
        <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
          <Paper
            variant="outlined"
            sx={{
              px: 2,
              minHeight: '200px',
              maxHeight: '500px',
              overflowY: 'auto',
              position: 'relative',
            }}
          >
            <Tooltip title="AI powered">
              <AutoAwesomeIcon
                fontSize="small"
                sx={{ position: 'absolute', margin: '20px', top: 0, right: 0 }}
              />
            </Tooltip>
            {summaryResponse?.summary ?
              <Box fontSize="smaller">
                <Markdown options={{ overrides: { a: { component: 'span' } } }}>
                  {summaryResponse.summary}
                </Markdown>
              </Box>
            : <Stack spacing={1} sx={{ m: 2 }}>
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

      {topActorsResponse?.topActors && actors && (
        <Accordion variant="outlined" disableGutters defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" alignItems="center">
              {'Contributors'}
              <Box onClick={e => e.stopPropagation()}>
                <DateRangePicker
                  dateRange={contributorsDateFilter}
                  onSelect={dateRange => setContributorsDateFilter(dateRange)}
                />
              </Box>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Grid container spacing={5}>
              {Object.keys(topActorsResponse.topActors)
                .sort(
                  (a, b) =>
                    (artifactActions.get(a)?.sortOrder ?? 999) -
                    (artifactActions.get(b)?.sortOrder ?? 999)
                )
                .map(action => {
                  return (
                    <Grid key={action}>
                      <Paper
                        variant="outlined"
                        sx={{
                          ...commonPaperSx,
                          opacity: topActorsFetcher.state === 'loading' ? 0.4 : 1,
                        }}
                      >
                        {widgetTitle(artifactActions.get(action)?.label ?? action)}
                        <BarChart
                          series={[
                            {
                              id: `top-actors-${action}`,
                              valueFormatter: value =>
                                `${value} ${pluralizeMemo('activity', value ?? 0)}`,
                              data: topActorsResponse.topActors![action].map(a => a.count),
                              color: dateRangeColor,
                            },
                          ]}
                          yAxis={[
                            {
                              data: topActorsResponse.topActors![action].map(a =>
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
                                      topActorsResponse.topActors![action][data.dataIndex].id
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
                                      topActorsResponse.topActors![action][data.dataIndex].id
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
      )}
    </Stack>
  );
  return (
    <App
      view="dashboard"
      isLoggedIn={sessionData.isLoggedIn}
      isNavOpen={sessionData.isNavOpen}
      showProgress={
        navigation.state !== 'idle' ||
        summaryFetcher.state !== 'idle' ||
        topActorsFetcher.state !== 'idle'
      }
      showPulse={false}
    >
      {sessionData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {sessionData?.error}
        </Alert>
      )}
      {summaryResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {summaryResponse.error.message}
        </Alert>
      )}
      {topActorsResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {topActorsResponse.error.message}
        </Alert>
      )}
      {widgets}
    </App>
  );
}
