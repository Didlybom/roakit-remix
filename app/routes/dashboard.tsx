import {
  AutoAwesome as AIIcon,
  BarChart as BarChartIcon,
  ExpandMore as ExpandMoreIcon,
  History as HistoryIcon,
  Science as ScienceIcon,
  ShortText as SummariesIcon,
  Groups as TeamIcon,
} from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Chip,
  Divider,
  Unstable_Grid2 as Grid,
  Link,
  Paper,
  Stack,
  Typography,
  styled,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LoaderFunctionArgs } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from '@remix-run/react';
import dayjs, { type Dayjs } from 'dayjs';
import pino from 'pino';
import { useEffect, useState, type ReactNode } from 'react';
import App, { navbarWidth } from '../components/App';
import DateRangePicker from '../components/DateRangePicker';
import IconIndicator from '../components/IconIndicator';
import Markdown from '../components/MarkdownText';
import ActiveContributors from '../components/dashboard/ActiveContributors.';
import ActivitiesByInitiative from '../components/dashboard/ActivitiesByInitiative';
import ContributorsByInitiative from '../components/dashboard/ContributorsByInitiative';
import EffortByInitiative from '../components/dashboard/EffortByInitiative';
import Priorities from '../components/dashboard/Priorities';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { updateInitiativeCounters } from '../firestore.server/updaters.server';
import { identifyAccounts } from '../types/activityFeed';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateRangeLabels, formatYYYYMMDD } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { caseInsensitiveCompare } from '../utils/stringUtils';
import { GroupedActivitiesResponse } from './fetcher.grouped-activities.$daterange';
import type { SummariesResponse } from './fetcher.summaries.$userid';

const logger = pino({ name: 'route:dashboard' });

export const meta = () => [{ title: 'Dashboard | ROAKIT' }];

export const shouldRevalidate = () => false;

const SEARCH_PARAM_DAY = 'day';

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

const SummaryBox = styled(Paper)(({ theme }) => ({
  borderColor: grey[200],
  // maxHeight: 300,
  // overflow: 'scroll',
  padding: theme.spacing(1),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  position: 'relative',
}));

type BottomNav = 'summaries' | 'charts';

export default function Dashboard() {
  const theme = useTheme();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const summaryFetcher = useFetcher();
  const fetchedSummaries = summaryFetcher.data as SummariesResponse;
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const groupedActivitiesFetcher = useFetcher();
  const groupedActivitiesResponse = groupedActivitiesFetcher.data as GroupedActivitiesResponse;
  const [dateRange, setDateRange] = useState(loaderData.dateFilter ?? DateRange.OneDay);
  const dateRangeLabel = dateRangeLabels[dateRange];
  const [hideContributorSummary, setHideContributorSummary] = useState<string[]>([]);
  const [error, setError] = useState('');
  const useBottomNav = !useMediaQuery(
    '(min-width:' + (900 + (loaderData.isNavOpen ? navbarWidth : 0)) + 'px)'
  );
  const [bottomNav, setBottomNav] = useState<BottomNav>('summaries');

  const smallButton = (href: string, label: string, icon: ReactNode) => (
    <Button
      href={href}
      variant="outlined"
      startIcon={icon}
      sx={{
        mx: '2px',
        px: 1,
        py: 0,
        fontSize: '.75rem',
        fontWeight: 400,
        textTransform: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Button>
  );

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

  // load grouped activities
  useEffect(() => {
    groupedActivitiesFetcher.load(`/fetcher/grouped-activities/${dateRange}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  useEffect(() => {
    if (groupedActivitiesResponse?.error?.status === 401) {
      navigate('/login');
    }
  }, [groupedActivitiesResponse?.error, navigate]);

  const errorAlert = (message?: string | null) =>
    !!message && (
      <Alert severity="error" sx={{ m: 3 }}>
        {message}
      </Alert>
    );

  const summaries = (
    <Stack fontSize="small" sx={{ opacity: summaryFetcher.state === 'loading' ? 0.4 : 1 }}>
      {loaderData.actors &&
        fetchedSummaries?.allSummaries
          ?.sort((a, b) =>
            caseInsensitiveCompare(
              loaderData.actors[a.identityId]?.name ?? '',
              loaderData.actors[b.identityId]?.name ?? ''
            )
          )
          .map((summary, i) => (
            <Box key={i} my={1}>
              <Stack direction={'row'} spacing={1}>
                <Divider component="div" role="presentation" sx={{ width: '100%' }}>
                  <Chip
                    label={loaderData.actors[summary.identityId ?? '']?.name ?? 'Unknown'}
                    size="small"
                    onClick={() => {
                      const isHidden = hideContributorSummary.includes(summary.identityId);
                      setHideContributorSummary(
                        isHidden ?
                          hideContributorSummary.filter(c => c !== summary.identityId)
                        : [...hideContributorSummary, summary.identityId]
                      );
                    }}
                  />
                </Divider>
              </Stack>
              {!hideContributorSummary.includes(summary.identityId) && (
                <>
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
                  )}
                  {summary.userTeamSummary && (
                    <SummaryBox variant="outlined">
                      <Markdown markdownText={summary.userTeamSummary} />
                      <IconIndicator icon={<TeamIcon fontSize="small" />} top={10} />
                    </SummaryBox>
                  )}
                </>
              )}
            </Box>
          ))}
    </Stack>
  );

  const charts = (
    <Stack spacing={3} m={3} onClick={e => e.stopPropagation()}>
      <Stack direction="row" display="flex" alignItems="center" justifyContent="center" mt={3}>
        <Box fontSize="small" whiteSpace="nowrap">
          Charts for the
        </Box>
        <DateRangePicker dateRange={dateRange} onSelect={dateRange => setDateRange(dateRange)} />
      </Stack>
      <Stack spacing={3} alignItems="center">
        <EffortByInitiative
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <Priorities
          groupedActivities={groupedActivitiesResponse}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
        <ContributorsByInitiative
          groupedActivities={groupedActivitiesResponse}
          initiatives={loaderData.initiatives}
          isLoading={groupedActivitiesFetcher.state === 'loading'}
        />
      </Stack>
      {!!groupedActivitiesResponse?.initiatives?.length && (
        <Accordion
          variant="outlined"
          disableGutters
          defaultExpanded
          sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' }, border: 'none' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            Activities by Initiative
          </AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Stack spacing={5}>
              <ActivitiesByInitiative
                groupedActivities={groupedActivitiesResponse}
                initiatives={loaderData.initiatives}
                dateRangeLabel={dateRangeLabel}
                isLoading={groupedActivitiesFetcher.state === 'loading'}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
      {!!groupedActivitiesResponse?.topActors && (
        <Accordion
          variant="outlined"
          disableGutters
          defaultExpanded
          sx={{ '& .MuiAccordionSummary-content': { fontSize: 'small' }, border: 'none' }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>Active Contributors</AccordionSummary>
          <AccordionDetails sx={{ mb: 2, ml: '3px' }}>
            <Stack spacing={5}>
              <ActiveContributors
                groupedActivities={groupedActivitiesResponse}
                actors={loaderData.actors}
                isLoading={groupedActivitiesFetcher.state === 'loading'}
              />
            </Stack>
          </AccordionDetails>
        </Accordion>
      )}
    </Stack>
  );

  return (
    <App
      view="dashboard"
      isLoggedIn={loaderData.isLoggedIn}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle' || groupedActivitiesFetcher.state !== 'idle'}
      showPulse={false}
    >
      {errorAlert(loaderData?.error)}
      {errorAlert(groupedActivitiesResponse?.error?.message)}
      {errorAlert(error)}
      <Grid container columns={2}>
        {(!useBottomNav || bottomNav === 'summaries') && (
          <Grid flex={1} m={3}>
            <Stack direction="row" spacing={2} display="flex" alignItems="center" mb={2}>
              <Typography fontWeight={500}>Activity summaries for</Typography>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  disableFuture={true}
                  slots={{ toolbar: undefined }}
                  slotProps={{
                    actionBar: { actions: [] },
                    toolbar: undefined,
                    textField: { size: 'small' },
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
            </Stack>
            <Alert severity="info" sx={{ mt: 1, mb: 2 }}>
              <Typography paragraph fontSize="small">
                <b>Work in progress.</b> <Link href="?day=20240418">April 18 has some data</Link>.
              </Typography>
              <Typography fontSize="small">
                See also{' '}
                {smallButton('/summaries/edit', 'Summary Form', <SummariesIcon fontSize="small" />)}{' '}
                to submit data,{' '}
                {smallButton('/activities', 'All Activity', <HistoryIcon fontSize="small" />)} to
                assign initiatives to activities, and{' '}
                {smallButton('/ai', 'AI Playground', <ScienceIcon fontSize="small" />)}.
              </Typography>
            </Alert>
            {summaries}
          </Grid>
        )}
        {(!useBottomNav || bottomNav === 'charts') && <Grid>{charts}</Grid>}

        {useBottomNav && (
          <Paper
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: theme.zIndex.drawer + 1,
            }}
            elevation={3}
          >
            <BottomNavigation
              showLabels
              value={bottomNav}
              onChange={(_, newValue) => {
                setBottomNav(newValue as BottomNav);
                window.scrollTo({ top: 0 });
              }}
            >
              <BottomNavigationAction
                label="Summaries"
                value="summaries"
                icon={<SummariesIcon />}
              />
              <BottomNavigationAction label="Charts" value="charts" icon={<BarChartIcon />} />
            </BottomNavigation>
          </Paper>
        )}
      </Grid>
    </App>
  );
}
