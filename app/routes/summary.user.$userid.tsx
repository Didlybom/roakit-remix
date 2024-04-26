import {
  AutoAwesome as AutoAwesomeIcon,
  Done as DoneIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Chip,
  Unstable_Grid2 as Grid,
  Pagination,
  Paper,
  Snackbar,
  Stack,
  Step,
  StepContent,
  StepLabel,
  Stepper,
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
  useSubmit,
} from '@remix-run/react';
import dayjs, { Dayjs } from 'dayjs';
import Markdown from 'markdown-to-jsx';
import { useEffect, useState } from 'react';
import App from '../components/App';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { upsertSummary } from '../firestore.server/updaters.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts } from '../schemas/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { formatDayLocal, formatYYYYMMDD } from '../utils/dateUtils';
import { postJsonOptions } from '../utils/httpUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import { SessionData } from '../utils/sessionCookie.server';
import { ActivityResponse } from './fetcher.activities.$userid';
import { SummariesResponse } from './fetcher.summaries.$userid';

export const meta = () => [{ title: 'Team Summary | ROAKIT' }];

export const shouldRevalidate = () => false;

// load activities
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const errorResponse = (sessionData: SessionData, error: string) => ({
    ...sessionData,
    error,
    userId: null,
    reportIds: null,
    activityUserIds: null,
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

    const activityUserIds =
      userId ? getAllPossibleActivityUserIds(userId, identities.list, identities.accountMap) : [];
    userIdentity.reportIds?.forEach(reportId => {
      activityUserIds.push(
        ...getAllPossibleActivityUserIds(reportId, identities.list, identities.accountMap)
      );
    });

    return {
      ...sessionData,
      userId,
      activityUserIds,
      reportIds: userIdentity.reportIds,
      actors: identifyAccounts(accounts, identities.list, identities.accountMap),
      error: null,
    };
  } catch (e) {
    return errorResponse(sessionData, 'Failed to fetch activities');
  }
};

interface JsonRequest {
  activitiesText?: string;
  day?: string;
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
        prompt: DEFAULT_PROMPT + '\n\n' + jsonRequest.activitiesText,
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
      aiSummary: jsonRequest.aiSummary,
      userSummary: jsonRequest.userSummary ?? '',
    });
    return { aiSummary: null, status: 'saved' };
  }

  return { aiSummary: null, status: null };
};

export default function Summary() {
  const navigation = useNavigation();
  const submit = useSubmit();
  const activitiesFetcher = useFetcher();
  const activitiesResponse = activitiesFetcher.data as ActivityResponse;
  const summaryFetcher = useFetcher();
  const summaryResponse = summaryFetcher.data as SummariesResponse;
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [day, setDay] = useState<Dayjs | null>(dayjs().subtract(1, 'days'));
  const [activitiesText, setActivitiesText] = useState('');
  const [aiSummaryTexts, setAiSummaryTexts] = useState<string[]>([]);
  const [userSummaryText, setUserSummaryText] = useState('');
  const [aiSummaryPage, setAiSummaryPage] = useState(1);
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);

  const hasAiSummary = aiSummaryTexts.length > 0 && !!aiSummaryTexts[0];

  // load activities and existing summary
  useEffect(() => {
    if (day) {
      activitiesFetcher.load(
        `/fetcher/activities/${loaderData.activityUserIds?.join(',')}?start=${day.startOf('day').valueOf()}&end=${day.endOf('day').valueOf()}`
      );
      summaryFetcher.load(`/fetcher/summaries/${loaderData.userId}?day=${formatYYYYMMDD(day)}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    if (!actionData) {
      return;
    }
    if (actionData.status === 'saved') {
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
  }, [actionData]);

  useEffect(() => {
    if (!activitiesResponse?.activities) {
      return;
    }
    const activitiesPrompt = buildActivitySummaryPrompt(
      Object.values(activitiesResponse.activities),
      loaderData.actors,
      {
        activityCount: 300, // FIXME summary activity count
        inclDates: false,
        inclActions: true,
        inclContributors: !!loaderData.reportIds && loaderData.reportIds.length > 0,
      }
    );
    setActivitiesText(activitiesPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesResponse?.activities]); // sessionData must be omitted

  // loaded existing data from server
  useEffect(() => {
    setAiSummaryTexts([summaryResponse?.aiSummary ?? '']);
    setUserSummaryText(summaryResponse?.userSummary ?? '');
    setAiSummaryPage(1);
  }, [summaryResponse?.aiSummary, summaryResponse?.userSummary]);

  return (
    <App
      view="summary.user"
      isLoggedIn={true}
      isNavOpen={loaderData.isNavOpen}
      showProgress={navigation.state !== 'idle' || activitiesFetcher.state !== 'idle'}
    >
      {loaderData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {loaderData?.error}
        </Alert>
      )}
      {activitiesResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {activitiesResponse.error.message}
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
      <Grid container columns={2} sx={{ m: 3, mt: 4 }}>
        <Grid>
          <Stack sx={{ mb: 4 }}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <StaticDatePicker
                disableFuture={true}
                slots={{ toolbar: undefined }}
                slotProps={{ actionBar: { actions: [] }, toolbar: undefined }}
                value={day}
                onChange={newValue => setDay(newValue)}
              />
            </LocalizationProvider>
            <Stack spacing={1} sx={{ ml: 3 }}>
              {loaderData.actors && loaderData.userId && (
                <>
                  <Box sx={{ fontWeight: 500 }}>Activities for...</Box>
                  <Box sx={{ pb: 1 }}>
                    <Chip
                      size="small"
                      icon={<PersonIcon fontSize="small" />}
                      label={loaderData.actors[loaderData.userId]?.name ?? 'Unknown'}
                    />
                  </Box>
                  {loaderData.reportIds?.map(reportId => (
                    <Box key={reportId} sx={{ pl: 2 }}>
                      <Chip
                        size="small"
                        icon={<PersonIcon fontSize="small" />}
                        label={loaderData.actors[reportId]?.name ?? 'Unknown'}
                      />
                    </Box>
                  ))}
                </>
              )}
            </Stack>
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
                    label={'Activities for ' + formatDayLocal(day)}
                    value={activitiesText}
                    disabled={activitiesFetcher.state !== 'idle'}
                    multiline
                    fullWidth
                    minRows={15}
                    maxRows={15}
                    size="small"
                    inputProps={{ sx: { mt: 1, fontSize: 'smaller' } }}
                    InputLabelProps={{ shrink: true }}
                    onChange={e => setActivitiesText(e.target.value)}
                    sx={{ mt: 3 }}
                  />
                </StepContent>
              </Step>
              <Step active={!!activitiesText}>
                <StepLabel>Summarize activities with AI</StepLabel>
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
                    {aiSummaryTexts
                      .filter((_, i) => aiSummaryTexts.length < 2 || aiSummaryPage === i + 1)
                      .map((aiSummaryText, i) => (
                        <Box
                          key={i}
                          fontSize="smaller"
                          sx={{ minHeight: 200, opacity: aiSummaryText ? undefined : 0.5 }}
                        >
                          <Markdown options={{ overrides: { a: { component: 'span' } } }}>
                            {aiSummaryText || 'AI summary will appear here.'}
                          </Markdown>
                        </Box>
                      ))}
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
                  <input type="hidden" name="aiSummary" value={aiSummaryTexts[aiSummaryPage - 1]} />
                </StepContent>
              </Step>
              <Step active={hasAiSummary}>
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
                        !activitiesText ||
                        !hasAiSummary ||
                        !!loaderData?.error
                      }
                      endIcon={<DoneIcon />}
                      onClick={() =>
                        submit(
                          {
                            day: formatYYYYMMDD(day),
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
