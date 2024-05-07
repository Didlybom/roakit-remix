import { AutoAwesome as AIIcon, Groups as TeamIcon } from '@mui/icons-material';
import { Alert, Box, Chip, Divider, Grid, Link, Paper, Stack, styled } from '@mui/material';
import { grey } from '@mui/material/colors';
import { LocalizationProvider, StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { redirect, useFetcher, useLoaderData, useSearchParams } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import pino from 'pino';
import { useEffect, useState } from 'react';
import App from '../components/App';
import IconIndicator from '../components/IconIndicator';
import Markdown from '../components/Markdown';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { identifyAccounts } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { formatYYYYMMDD } from '../utils/dateUtils';
import type { SessionData } from '../utils/sessionCookie.server';
import { caseInsensitiveCompare } from '../utils/stringUtils';
import type { SummariesResponse } from './fetcher.summaries.$userid';

const logger = pino({ name: 'route:summaries' });

export const meta = () => [{ title: 'Summaries | ROAKIT' }];

export const shouldRevalidate = () => false;

const SEARCH_PARAM_DAY = 'day';

// verify JWT, load users
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const errorResponse = (sessionData: SessionData, error: string) => ({
    ...sessionData,
    error,
    actors: null,
  });
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  try {
    // retrieve  users
    const [accounts, identities] = await Promise.all([
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    return {
      ...sessionData,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      error: null,
    };
  } catch (e) {
    logger.error(e);
    return errorResponse(sessionData, 'Failed to fetch users');
  }
};

const SummaryBox = styled(Paper)(({ theme }) => ({
  borderColor: grey[200],
  maxHeight: 300,
  overflow: 'scroll',
  padding: theme.spacing(1),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  position: 'relative',
}));

export default function Summaries() {
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const summaryFetcher = useFetcher();
  const fetchedSummaries = summaryFetcher.data as SummariesResponse;
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const [error, setError] = useState('');

  // load summaries
  useEffect(() => {
    if (isNaN(selectedDay.toDate().getTime())) {
      setError('Invalid date');
      return;
    }
    if (selectedDay) {
      summaryFetcher.load(`/fetcher/summaries/*?day=${formatYYYYMMDD(selectedDay)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]); // summaryFetcher must be omitted

  return (
    <App isLoggedIn={true} isNavOpen={loaderData.isNavOpen} view="summaries">
      {loaderData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {loaderData?.error}
        </Alert>
      )}
      {fetchedSummaries?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {fetchedSummaries.error.message}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {error}
        </Alert>
      )}
      <Alert severity="info">
        Work in progress. <Link href="/summaries?day=20240418">April 18 has some data.</Link> See
        also Summary Form in the navbar (
        <Link href="/summary/user/TAaQqrjRl6tHB2lMvxOR?day=20240418">example</Link>).
      </Alert>
      <Grid container columns={2} mt={1}>
        <Grid>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <StaticDatePicker
              disableFuture={true}
              slots={{ toolbar: undefined }}
              slotProps={{
                actionBar: { actions: [] },
                toolbar: undefined,
              }}
              value={selectedDay}
              onChange={day => {
                if (day) {
                  setSelectedDay(day);
                  setSearchParams(prev => {
                    prev.set(SEARCH_PARAM_DAY, formatYYYYMMDD(day));
                    return prev;
                  });
                }
              }}
            />
          </LocalizationProvider>
        </Grid>
        <Grid flex={1}>
          <Stack useFlexGap={true} fontSize="small" mx={3}>
            {loaderData.actors &&
              fetchedSummaries?.allSummaries
                ?.sort((a, b) =>
                  caseInsensitiveCompare(
                    loaderData.actors[a.identityId]?.name ?? '',
                    loaderData.actors[b.identityId]?.name ?? ''
                  )
                )
                .map((summary, i) => {
                  return (
                    <Box key={i} my={1}>
                      <Stack direction={'row'} spacing={1}>
                        <Divider component="div" role="presentation" sx={{ width: '100%' }}>
                          <Chip
                            label={loaderData.actors[summary.identityId ?? '']?.name ?? 'Unknown'}
                            size="small"
                          />
                        </Divider>
                      </Stack>
                      {summary.aiSummary && (
                        <SummaryBox variant="outlined">
                          <Markdown markdownText={summary.aiSummary} />
                          <IconIndicator icon={<AIIcon fontSize="small" />} top={10} />
                        </SummaryBox>
                      )}
                      {summary.userSummary && (
                        <SummaryBox variant="outlined">
                          <Markdown markdownText={summary.userSummary} />
                        </SummaryBox>
                      )}
                      {summary.aiTeamSummary && (
                        <SummaryBox variant="outlined">
                          <Markdown markdownText={summary.aiTeamSummary} />
                          <IconIndicator icon={<AIIcon fontSize="small" />} top={10} />
                          <IconIndicator icon={<TeamIcon fontSize="small" />} top={10} right={30} />
                        </SummaryBox>
                      )}{' '}
                      {summary.userTeamSummary && (
                        <SummaryBox variant="outlined">
                          <Markdown markdownText={summary.userTeamSummary} />
                          <IconIndicator icon={<TeamIcon fontSize="small" />} top={10} />
                        </SummaryBox>
                      )}
                    </Box>
                  );
                })}
          </Stack>
        </Grid>
      </Grid>
    </App>
  );
}
