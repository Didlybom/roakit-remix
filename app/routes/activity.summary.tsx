import { AutoAwesome as AIIcon, Groups as TeamIcon } from '@mui/icons-material';
import { Alert, Box, Chip, Divider, Link, Paper, Stack, Typography, styled } from '@mui/material';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import type { LoaderFunctionArgs } from '@remix-run/node';
import {
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
} from '@remix-run/react';
import dayjs, { type Dayjs } from 'dayjs';
import { useEffect, useState } from 'react';
import { identifyAccounts } from '../activityProcessors/activityIdentifier';
import App from '../components/App';
import IconIndicator from '../components/IconIndicator';
import Markdown from '../components/MarkdownText';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import {} from '../firestore.server/updaters.server';
import { loadSession } from '../utils/authUtils.server';
import { formatYYYYMMDD, isValidDate } from '../utils/dateUtils';
import { errorAlert, linkSx, loaderErrorResponse, loginWithRedirectUrl } from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import { caseInsensitiveCompare } from '../utils/stringUtils';
import type { SummariesResponse } from './fetcher.summaries.($userid)';

export const meta = () => [{ title: 'Activity Summary | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.ActivitySummary;
const SEARCH_PARAM_DAY = 'day';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    // retrieve initiatives and users
    const [accounts, identities] = await Promise.all([
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return { ...sessionData, actors };
  } catch (e) {
    getLogger('route:activity.summary').error(e);
    throw loaderErrorResponse(e);
  }
};

const SummaryBox = styled(Paper)(({ theme }) => ({
  borderColor: theme.palette.grey[200],
  // maxHeight: 300,
  // overflow: 'scroll',
  padding: theme.spacing(1),
  marginTop: theme.spacing(1),
  marginBottom: theme.spacing(1),
  position: 'relative',
}));

export default function Dashboard() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const loaderData = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const summaryFetcher = useFetcher<SummariesResponse>();
  const fetchedSummaries = summaryFetcher.data;
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const [hideContributorSummary, setHideContributorSummary] = useState<string[]>([]);
  const [error, setError] = useState('');

  // load summaries
  useEffect(() => {
    if (!isValidDate(selectedDay)) {
      setError('Invalid date');
      return;
    }
    if (selectedDay) {
      summaryFetcher.load(`/fetcher/summaries/*?day=${formatYYYYMMDD(selectedDay)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]); // summaryFetcher must be omitted

  useEffect(() => {
    if (fetchedSummaries?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedSummaries?.error, navigate]);

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
                      <IconIndicator
                        icon={<AIIcon fontSize="small" />}
                        title="AI powered"
                        top={10}
                      />
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
                      <IconIndicator
                        icon={<AIIcon fontSize="small" />}
                        title="AI powered"
                        top={10}
                      />
                      <IconIndicator
                        icon={<TeamIcon fontSize="small" />}
                        title="Team"
                        top={10}
                        right={30}
                      />
                    </SummaryBox>
                  )}
                  {summary.userTeamSummary && (
                    <SummaryBox variant="outlined">
                      <Markdown markdownText={summary.userTeamSummary} />
                      <IconIndicator icon={<TeamIcon fontSize="small" />} title="Team" top={10} />
                    </SummaryBox>
                  )}
                </>
              )}
            </Box>
          ))}
    </Stack>
  );

  return (
    <App
      view={VIEW}
      role={loaderData.role}
      isLoggedIn={loaderData.isLoggedIn}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle' || summaryFetcher.state != 'idle'}
    >
      {errorAlert(fetchedSummaries?.error?.message)}
      {errorAlert(error)}
      <Box flex={1} m={3}>
        <Stack direction="row" spacing={2} display="flex" alignItems="center" mb={2}>
          <Typography fontWeight={500}>Activities for</Typography>
          <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DatePicker
              disableFuture={true}
              slotProps={{ textField: { size: 'small' } }}
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
          <Typography fontSize="small">
            <b>Work in progress.</b>{' '}
            <Link
              onClick={() => {
                setSelectedDay(dayjs('20240418'));
                setSearchParams(prev => {
                  prev.set(SEARCH_PARAM_DAY, '20240418');
                  return prev;
                });
              }}
              sx={linkSx}
            >
              April 18 has some data
            </Link>
            .
          </Typography>
        </Alert>
        {summaries}
      </Box>
    </App>
  );
}
