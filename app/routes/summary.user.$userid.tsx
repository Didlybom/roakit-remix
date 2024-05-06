import {
  AutoAwesome as AutoAwesomeIcon,
  Done as DoneIcon,
  Person as PersonIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControlLabel,
  Unstable_Grid2 as Grid,
  Link,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs, { Dayjs } from 'dayjs';
import pino from 'pino';
import { useEffect, useState } from 'react';
import { ActivityPickersDay, type PickerDayWithHighlights } from '../components/ActivityPickersDay';
import App from '../components/App';
import IconIndicator from '../components/IconIndicator';
import Markdown from '../components/Markdown';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { upsertSummary } from '../firestore.server/updaters.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts } from '../types/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { formatDayLocal, formatYYYYMM, formatYYYYMMDD } from '../utils/dateUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import { SessionData } from '../utils/sessionCookie.server';
import { ActivityResponse } from './fetcher.activities.$userid';
import { SummariesResponse } from './fetcher.summaries.$userid';

const logger = pino({ name: 'route:summary.user' });

export const meta = () => [{ title: 'Team Summary | ROAKIT' }];

export const shouldRevalidate = () => false;

const SEARCH_PARAM_DAY = 'day';

// verify JWT, load users
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const errorResponse = (sessionData: SessionData, error: string) => ({
    ...sessionData,
    error,
    userId: null,
    userIds: null,
    teamUserIds: null,
    reportIds: null,
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

    const userId = params.userid;

    const userIdentity = identities.list.find(identity => identity.id === userId);
    if (!userIdentity) {
      return errorResponse(sessionData, 'User has no identity');
    }

    const userIds =
      userId ? getAllPossibleActivityUserIds(userId, identities.list, identities.accountMap) : [];
    const teamUserIds: string[] = [];
    userIdentity.reportIds?.forEach(reportId => {
      teamUserIds.push(
        ...getAllPossibleActivityUserIds(reportId, identities.list, identities.accountMap)
      );
    });

    return {
      ...sessionData,
      userId,
      userIds,
      teamUserIds,
      reportIds: userIdentity.reportIds,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      error: null,
    };
  } catch (e) {
    logger.error(e);
    return errorResponse(sessionData, 'Failed to fetch users');
  }
};

interface JsonRequest {
  activitiesText?: string;
  day?: string;
  isTeam: boolean;
  aiSummary?: string;
  userSummary?: string;
}

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const jsonRequest = (await request.json()) as JsonRequest;

  // invoke AI
  if (jsonRequest.activitiesText) {
    return {
      aiSummary: await generateContent({
        prompt: `${DEFAULT_PROMPT}\n\n${jsonRequest.activitiesText}`,
      }),
      status: 'generated',
    };
  }

  // save summaries
  if (jsonRequest.day && jsonRequest.aiSummary) {
    const identityId = params.userid;
    if (!identityId) {
      throw 'Identity required';
    }
    await upsertSummary(sessionData.customerId!, jsonRequest.day, {
      identityId,
      isTeam: jsonRequest.isTeam,
      aiSummary: jsonRequest.aiSummary,
      userSummary: jsonRequest.userSummary ?? '',
    });
    return { aiSummary: null, status: 'saved' };
  }

  return { aiSummary: null, status: null };
};

export default function Summary() {
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const activitiesFetcher = useFetcher();
  const fetchedActivities = activitiesFetcher.data as ActivityResponse;
  const summaryFetcher = useFetcher();
  const fetchedSummaries = summaryFetcher.data as SummariesResponse;
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
  const previousSelectedDay = usePrevious(selectedDay);
  const [selectedMonth, setSelectedMonth] = useState<Dayjs>(selectedDay);
  const [highlightedDays, setHighlightedDays] = useState<string[]>([]);
  const [showTeam, setShowTeam] = useState(false);
  const [activitiesText, setActivitiesText] = useState('');
  const [aiSummaryTexts, setAiSummaryTexts] = useState<string[]>([]);
  const [userSummaryText, setUserSummaryText] = useState('');
  const [aiSummaryPage, setAiSummaryPage] = useState(1);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);
  const [error, setError] = useState('');

  const hasAiSummary = aiSummaryTexts.length > 0 && !!aiSummaryTexts[0];

  // load activities and existing summary
  useEffect(() => {
    if (isNaN(selectedDay.toDate().getTime())) {
      setError('Invalid date');
      return;
    }
    if (selectedDay) {
      activitiesFetcher.load(
        `/fetcher/activities/${(showTeam ? loaderData.teamUserIds : loaderData.userIds)?.join(',')}?start=${selectedDay.startOf('day').valueOf()}&end=${selectedDay.endOf('day').valueOf()}`
      );
      if (
        !previousSelectedDay ||
        selectedDay.month() !== selectedMonth.month() ||
        selectedDay.year() !== selectedMonth.year()
      ) {
        // load the summaries (for the month, to be able tyo highlight days with summaries on the calendar)
        summaryFetcher.load(
          `/fetcher/summaries/${loaderData.userId}?month=${formatYYYYMM(selectedMonth)}`
        );
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, selectedMonth, showTeam]); // previousDay and loaderData must be omitted

  // handle save results and AI results
  useEffect(() => {
    if (!actionData) {
      return;
    }
    if (actionData.status === 'saved') {
      // refresh summary from server (could be optimized by putting the fetcher response in a state, updated on click on Save)
      summaryFetcher.load(
        `/fetcher/summaries/${loaderData.userId}?month=${formatYYYYMM(selectedDay)}`
      );
      setShowSavedConfirmation(true);
    }
    if (actionData.status === 'generated') {
      if (!aiSummaryTexts[aiSummaryTexts.length - 1]) {
        setAiSummaryTexts([actionData.aiSummary ? getSummaryResult(actionData.aiSummary) : '']);
      } else {
        setAiSummaryPage(aiSummaryTexts.length + 1);
        setAiSummaryTexts([
          ...aiSummaryTexts,
          actionData.aiSummary ? getSummaryResult(actionData.aiSummary) : '',
        ]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionData]); // selectedDay must be omitted

  // handle fetched activities
  useEffect(() => {
    if (!fetchedActivities?.activities) {
      return;
    }
    const activitiesPrompt = buildActivitySummaryPrompt(
      Object.values(fetchedActivities.activities),
      loaderData.actors,
      {
        activityCount: 300, // FIXME summary activity count
        inclDates: false,
        inclActions: true,
        inclContributors: showTeam,
      }
    );
    setActivitiesText(activitiesPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchedActivities?.activities]); // loaderData and showTeam must be omitted

  // handle fetched existing summaries
  useEffect(() => {
    const daySummary =
      fetchedSummaries?.summaries ?
        fetchedSummaries.summaries[formatYYYYMMDD(selectedDay)]
      : undefined;
    setAiSummaryTexts([(showTeam ? daySummary?.aiTeamSummary : daySummary?.aiSummary) ?? '']);
    setUserSummaryText((showTeam ? daySummary?.userTeamSummary : daySummary?.userSummary) ?? '');
    setAiSummaryPage(1);
    setHighlightedDays(fetchedSummaries?.summaries ? Object.keys(fetchedSummaries?.summaries) : []);
  }, [fetchedSummaries?.summaries, selectedDay, showTeam]);

  return (
    <App
      view="summary.user"
      isLoggedIn={true}
      isNavOpen={loaderData.isNavOpen}
      showProgress={
        navigation.state !== 'idle' ||
        activitiesFetcher.state !== 'idle' ||
        summaryFetcher.state !== 'idle'
      }
    >
      {loaderData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {loaderData?.error}
        </Alert>
      )}
      {fetchedActivities?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {fetchedActivities.error.message}
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
      <Snackbar
        open={showSavedConfirmation}
        autoHideDuration={3000}
        onClose={(_, reason?: string) => {
          if (reason === 'clickaway') {
            return;
          }
          setShowSavedConfirmation(false);
        }}
        message={'Saved'}
      />
      <Grid container columns={2} sx={{ m: 3 }}>
        <Grid>
          <Stack sx={{ mb: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <StaticDatePicker
                disableFuture={true}
                slots={{ toolbar: undefined, day: ActivityPickersDay }}
                slotProps={{
                  actionBar: { actions: [] },
                  toolbar: undefined,
                  day: { highlightedDays } as PickerDayWithHighlights,
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
                onMonthChange={setSelectedMonth}
              />
            </LocalizationProvider>
            {loaderData.actors && loaderData.userId && (
              <Stack spacing={1} sx={{ ml: 3 }}>
                <Typography fontWeight={500}>Activities for…</Typography>
                <Box sx={{ opacity: showTeam ? 0.3 : undefined }}>
                  <Chip
                    size="small"
                    icon={<PersonIcon fontSize="small" />}
                    label={loaderData.actors[loaderData.userId]?.name ?? 'Unknown'}
                  />
                </Box>
                {!!loaderData.reportIds?.length && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={showTeam}
                        onChange={e => {
                          setShowTeam(e.target.checked);
                          setActivitiesText('');
                          setAiSummaryTexts([]);
                        }}
                      />
                    }
                    label={
                      <Typography fontSize="small" fontWeight={500}>
                        Team
                      </Typography>
                    }
                  />
                )}
                {loaderData.reportIds?.map(reportId => (
                  <Link
                    href={`/summary/user/${encodeURI(reportId)}`}
                    target="_blank"
                    key={reportId}
                    sx={{ opacity: showTeam ? undefined : 0.3 }}
                  >
                    <Chip
                      size="small"
                      icon={<PersonIcon fontSize="small" />}
                      label={loaderData.actors[reportId]?.name ?? 'Unknown'}
                    />
                  </Link>
                ))}
              </Stack>
            )}
          </Stack>
        </Grid>
        <Grid flex={1} minWidth={300}>
          <Stack spacing={2} sx={{ ml: 2 }}>
            <Stepper orientation="vertical">
              <Step active>
                <StepLabel>Select a day, review and edit activities</StepLabel>
                <StepContent>
                  <TextField
                    name="activitiesText"
                    label={'Activities for ' + formatDayLocal(selectedDay)}
                    value={activitiesText}
                    disabled={activitiesFetcher.state !== 'idle'}
                    multiline
                    fullWidth
                    minRows={12}
                    maxRows={12}
                    size="small"
                    inputProps={{ sx: { mt: 1, fontSize: 'smaller' } }}
                    InputLabelProps={{ shrink: true }}
                    onChange={e => setActivitiesText(e.target.value)}
                    sx={{ mt: 3 }}
                  />
                </StepContent>
              </Step>
              <Step active>
                <StepLabel>Summarize activities with AI assistance</StepLabel>
                <StepContent>
                  <Box sx={{ mt: 2, mb: 4 }}>
                    <Button
                      variant="contained"
                      value="ai"
                      disabled={navigation.state !== 'idle' || !activitiesText}
                      title="You can invoke AI multiple times and keep the best output"
                      endIcon={<AutoAwesomeIcon />}
                      onClick={() => submit({ activitiesText }, postJsonOptions)}
                    >
                      {hasAiSummary ? 'Generate another summary' : 'Generate summary'}
                    </Button>
                  </Box>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      mt: 4,
                      minHeight: '200px',
                      maxHeight: '500px',
                      overflowY: 'auto',
                    }}
                  >
                    {aiSummaryTexts.map((aiSummaryText, i) => {
                      if (aiSummaryTexts.length > 1 && aiSummaryPage !== i + 1) {
                        return null;
                      }
                      return (
                        <Box key={i} fontSize="smaller">
                          <Stack direction="row" spacing={3} sx={{ my: 1 }}>
                            <Stack flex={0.5}>
                              <TextField
                                label="AI Summary"
                                value={aiSummaryText}
                                placeholder="AI summary will appear here. You can edit it."
                                multiline
                                fullWidth
                                minRows={12}
                                maxRows={12}
                                size="small"
                                inputProps={{ style: { fontSize: 'smaller' } }}
                                InputLabelProps={{ shrink: true }}
                                onChange={e =>
                                  setAiSummaryTexts(
                                    aiSummaryTexts.map((existing, j) =>
                                      i === j ? e.target.value : existing
                                    )
                                  )
                                }
                              />
                              <Typography
                                component={Link}
                                variant="caption"
                                href="https://www.markdownguide.org/cheat-sheet/"
                                target="_blank"
                              >
                                Markdown format
                              </Typography>
                            </Stack>
                            <Stack flex={0.5} sx={{ opacity: 0.5, position: 'relative' }}>
                              {aiSummaryText && (
                                <>
                                  <Box sx={{ maxHeight: 300, overflow: 'scroll' }}>
                                    <Markdown markdownText={aiSummaryText} />
                                  </Box>
                                  <IconIndicator
                                    icon={<PreviewIcon fontSize="small" />}
                                    label="Preview"
                                  />
                                </>
                              )}
                            </Stack>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Paper>
                  {aiSummaryTexts.length > 1 && (
                    <Stack direction="row" alignItems="center" spacing={2} sx={{ mt: 2 }}>
                      <Pagination
                        count={aiSummaryTexts.length}
                        page={aiSummaryPage}
                        onChange={(_, page) => setAiSummaryPage(page)}
                      />
                      <Typography variant="caption">Choose which AI summary to save</Typography>
                    </Stack>
                  )}
                </StepContent>
              </Step>
              <Step active>
                <StepLabel>Add your input and save the summaries</StepLabel>
                <StepContent>
                  <TextField
                    name="userSummary"
                    label="Your input"
                    placeholder="Natural Intelligence"
                    value={userSummaryText}
                    multiline
                    fullWidth
                    minRows={3}
                    maxRows={3}
                    size="small"
                    inputProps={{ style: { fontSize: 'smaller' } }}
                    InputLabelProps={{ shrink: true }}
                    onChange={e => setUserSummaryText(e.target.value)}
                    sx={{ mt: 3 }}
                  />
                  <Box sx={{ my: 2 }}>
                    <Button
                      variant="contained"
                      value="save"
                      title="Save the AI summary and your input"
                      disabled={
                        navigation.state !== 'idle' ||
                        (!aiSummaryTexts[aiSummaryPage - 1] && !userSummaryText) ||
                        !!loaderData?.error
                      }
                      endIcon={<DoneIcon />}
                      onClick={() =>
                        submit(
                          {
                            day: formatYYYYMMDD(selectedDay),
                            isTeam: showTeam,
                            aiSummary: aiSummaryTexts[aiSummaryPage - 1],
                            userSummary: userSummaryText,
                          },
                          postJsonOptions
                        )
                      }
                    >
                      {'Save summaries'}
                    </Button>
                  </Box>
                </StepContent>
              </Step>
            </Stepper>
          </Stack>
        </Grid>
      </Grid>
    </App>
  );
}
