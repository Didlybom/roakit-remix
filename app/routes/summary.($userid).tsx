import type { GenerateContentResult } from '@google-cloud/vertexai';
import {
  AutoAwesome as AutoAwesomeIcon,
  Done as DoneIcon,
  Visibility as PreviewIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  FormControlLabel,
  Grid2 as Grid,
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
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import {
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigate,
  useNavigation,
  useSearchParams,
  useSubmit,
} from '@remix-run/react';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import ActivityPickersDay, { type PickerDayWithHighlights } from '../components/ActivityPickersDay';
import App from '../components/App';
import { SmallAvatarChip } from '../components/Avatars';
import IconIndicator from '../components/IconIndicator';
import MarkdownText from '../components/MarkdownText';
import {
  fetchAccountMap,
  fetchIdentities,
  fetchInitiativeMap,
  queryIdentity,
} from '../firestore.server/fetchers.server';
import { upsertSummary } from '../firestore.server/updaters.server';
import { generateContent } from '../gemini.server/gemini.server';
import {
  DEFAULT_PROMPT,
  buildActivitySummaryPrompt,
  getSummaryResult,
} from '../processors/activityAISummarizer';
import { identifyAccounts } from '../processors/activityIdentifier';
import { compileActivityMappers, mapActivity } from '../processors/activityMapper';
import { loadAndValidateSession } from '../utils/authUtils.server';
import { formatDayLocal, formatYYYYMM, formatYYYYMMDD, isValidDate } from '../utils/dateUtils';
import { postJsonOptions } from '../utils/httpUtils';
import {
  errorAlert,
  getSearchParam,
  loaderErrorResponse,
  loginWithRedirectUrl,
} from '../utils/jsxUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import theme from '../utils/theme';
import type { ActivityResponse } from './fetcher.activities.($userid)';
import type { SummariesResponse } from './fetcher.summaries.($userid)';

export const meta = () => [{ title: 'Summary Form | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.Summary;
const SEARCH_PARAM_DAY = 'day';

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);

  try {
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    const userId = params.userid; // impersonification, see utils/rbac.ts

    const userIdentity = identities.list.find(identity => {
      if (userId) {
        return identity.id === userId;
      } else {
        return identity.email === sessionData.email;
      }
    });
    if (!userIdentity) {
      throw new Response('Identity not found', { status: 500 });
    }

    return {
      ...sessionData,
      userId,
      userDisplayName: userIdentity.displayName,
      reportIds: userIdentity.reportIds,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      initiatives,
    };
  } catch (e) {
    getLogger('route:summary.user').error(e);
    throw loaderErrorResponse(e);
  }
};

interface ActionRequest {
  activitiesText?: string;
  day?: string;
  isTeam: boolean;
  aiSummary?: string;
  userSummary?: string;
}

interface ActionResponse {
  status?: 'generated' | 'saved';
  error?: string;
  aiSummary: GenerateContentResult | null;
}

export const action = async ({ params, request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const sessionData = await loadAndValidateSession(request, VIEW, params);

  const actionRequest = (await request.json()) as ActionRequest;

  // invoke AI
  if (actionRequest.activitiesText) {
    return {
      aiSummary: await generateContent({
        prompt: `${DEFAULT_PROMPT}\n\n${actionRequest.activitiesText}`,
      }),
      status: 'generated',
    };
  }

  // save summaries
  if (actionRequest.day) {
    let identityId = params.userid; // impersonification
    if (!identityId) {
      const identity = await queryIdentity(sessionData.customerId!, { email: sessionData.email });
      identityId = identity.id;
    }

    if (!identityId) {
      throw Error('Identity required');
    }
    await upsertSummary(sessionData.customerId!, actionRequest.day, {
      identityId,
      isTeam: actionRequest.isTeam,
      aiSummary: actionRequest.aiSummary ?? '',
      userSummary: actionRequest.userSummary ?? '',
    });
    return { aiSummary: null, status: 'saved' };
  }

  return { aiSummary: null, status: undefined };
};

export default function Summary() {
  const navigation = useNavigation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const submit = useSubmit();
  const activitiesFetcher = useFetcher<ActivityResponse>();
  const fetchedActivities = activitiesFetcher.data;
  const summaryFetcher = useFetcher<SummariesResponse>();
  const fetchedSummaries = summaryFetcher.data;
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [selectedDay, setSelectedDay] = useState<Dayjs>(
    searchParams.get(SEARCH_PARAM_DAY) ?
      dayjs(searchParams.get(SEARCH_PARAM_DAY))
    : dayjs().subtract(1, 'days')
  );
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

  useEffect(() => {
    compileActivityMappers(loaderData.initiatives);
  }, [loaderData.initiatives]);

  // load activities for the selected day
  useEffect(() => {
    if (!isValidDate(selectedDay)) {
      setError('Invalid date');
      return;
    }
    activitiesFetcher.load(
      `/fetcher/activities/${loaderData.userId ?? ''}?${showTeam ? 'includeTeam=true&' : ''}start=${selectedDay.startOf('day').valueOf()}&end=${selectedDay.endOf('day').valueOf()}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, showTeam]); // activitiesFetcher and loaderData must be omitted

  // load the summaries for the selected month (to be able to highlight days with summaries)
  useEffect(() => {
    if (!isValidDate(selectedMonth)) {
      setError('Invalid date');
      return;
    }
    summaryFetcher.load(
      `/fetcher/summaries/${loaderData.userId ?? ''}?month=${formatYYYYMM(selectedMonth)}`
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]); // summaryFetcher and loaderData must be omitted

  // handle save results and AI results
  useEffect(() => {
    if (actionData?.status === 'saved') {
      // refresh summary from server (could be optimized by putting the fetcher response in a state, updated on click on Save)
      summaryFetcher.load(
        `/fetcher/summaries/${loaderData.userId ?? ''}?month=${formatYYYYMM(selectedDay)}`
      );
      setShowSavedConfirmation(true);
    }
    if (actionData?.status === 'generated') {
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
    const activities = Object.values(fetchedActivities.activities);
    activities.forEach(activity => {
      if (!activity.initiativeId) {
        if (activity.initiativeId == null) {
          activity.initiativeId = mapActivity(activity)[0] ?? '';
        }
      }
    });
    const activitiesPrompt = buildActivitySummaryPrompt(
      activities,
      loaderData.actors,
      loaderData.initiatives,
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

  useEffect(() => {
    if (fetchedActivities?.error?.status === 401 || fetchedSummaries?.error?.status === 401) {
      navigate(loginWithRedirectUrl());
    }
  }, [fetchedActivities?.error?.status, fetchedSummaries?.error?.status, navigate]);

  return (
    <App
      view={VIEW}
      isLoggedIn={true}
      role={loaderData.role}
      isNavOpen={loaderData.isNavOpen}
      showProgress={
        navigation.state !== 'idle' ||
        activitiesFetcher.state !== 'idle' ||
        summaryFetcher.state !== 'idle'
      }
    >
      {errorAlert(fetchedActivities?.error?.message)}
      {errorAlert(fetchedSummaries?.error?.message)}
      {errorAlert(error)}
      <Snackbar
        open={showSavedConfirmation}
        autoHideDuration={3000}
        onClose={(_, reason) => (reason === 'clickaway' ? null : setShowSavedConfirmation(false))}
        message={'Saved'}
      />
      <Grid container sx={{ mx: 1, my: 3 }}>
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
                    setSearchParams(prev =>
                      getSearchParam(prev, SEARCH_PARAM_DAY, formatYYYYMMDD(day))
                    );
                  }
                }}
                onMonthChange={setSelectedMonth}
              />
            </LocalizationProvider>
            <Stack spacing={1} sx={{ ml: 3 }}>
              <Typography fontSize="small" fontWeight={500}>
                Activities for
              </Typography>
              <Box sx={{ opacity: showTeam ? 0.3 : undefined }}>
                <SmallAvatarChip name={loaderData.userDisplayName} />
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
                <Box key={reportId} sx={{ opacity: showTeam ? 0.3 : undefined }}>
                  <SmallAvatarChip name={loaderData.actors[reportId]?.name} />
                </Box>
              ))}
            </Stack>
          </Stack>
        </Grid>
        <Grid flex={1} minWidth={300}>
          <Stack spacing={2} sx={{ ml: 2, mr: 1 }}>
            <Stepper orientation="vertical">
              <Step active>
                <StepLabel>
                  Select a day, review and edit activities that AI will summarize in step 2
                </StepLabel>
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
                    slotProps={{
                      htmlInput: {
                        sx: { mt: 1, fontSize: 'smaller', backgroundColor: theme.palette.grey[50] },
                      },
                      inputLabel: { shrink: true },
                    }}
                    sx={{ mt: 3 }}
                    onChange={e => setActivitiesText(e.target.value)}
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
                                slotProps={{
                                  htmlInput: { style: { fontSize: 'smaller' } },
                                  inputLabel: { shrink: true },
                                }}
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
                                    <MarkdownText text={aiSummaryText} ignoreLinks />
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
                    slotProps={{
                      input: { style: { fontSize: 'smaller' } },
                      inputLabel: { shrink: true },
                    }}
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
                        (!aiSummaryTexts[aiSummaryPage - 1] && !userSummaryText)
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
