import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { Alert, Box, Button, Paper, Snackbar, Stack, TextField } from '@mui/material';
import { StaticDatePicker } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { Form, useActionData, useFetcher, useLoaderData, useNavigation } from '@remix-run/react';
import dayjs, { Dayjs } from 'dayjs';
import Markdown from 'markdown-to-jsx';
import { useEffect, useState } from 'react';
import { useDeepCompareEffectNoCheck } from 'use-deep-compare-effect';
import App from '../components/App';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { upsertSummary } from '../firestore.server/updaters.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts } from '../schemas/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { formatDayLocal } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils.server';
import { ActivityResponse } from './fetcher.activities.$userid';
import { SummariesResponse } from './fetcher.summaries.$userid';

export const meta = () => [{ title: 'Team Summary | ROAKIT' }];

export const shouldRevalidate = () => false;

// load activities
export const loader = async ({ params, request }: LoaderFunctionArgs) => {
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

    // this route requires an identity
    if (!identities.list.find(identity => identity.id === userId)) {
      return {
        ...sessionData,
        error: 'User has no identity',
        userId,
        activityUserIds: null,
        activities: null,
        actors: null,
      };
    }

    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const activityUserIds =
      userId ? getAllPossibleActivityUserIds(userId, identities.list, identities.accountMap) : [];

    return {
      ...sessionData,
      userId,
      activityUserIds,
      actors,
      error: null,
    };
  } catch (e) {
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch activities'),
      userId: null,
      activityUserIds: null,
      activities: null,
      actors: null,
    };
  }
};

const BUTTON_AI = 'button-ai';
const BUTTON_SAVE = 'button-save';

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const formData = await request.formData();

  if (formData.get(BUTTON_AI)) {
    const promptActivities = formData.get('activitiesText')?.toString() ?? '';
    if (!promptActivities) {
      throw Error('Empty prompt');
    }
    return {
      aiSummary: await generateContent({ prompt: DEFAULT_PROMPT + '\n\n' + promptActivities }),
      status: 'generated',
    };
  }

  if (formData.get(BUTTON_SAVE)) {
    const identityId = params.userid;
    if (!identityId) {
      throw 'Identity required';
    }
    const day = formData.get('day')?.toString() ?? '';
    if (!day) {
      throw 'Date required';
    }
    const aiSummary = formData.get('aiSummary')?.toString() ?? '';
    const userSummary = formData.get('userSummary')?.toString() ?? '';

    await upsertSummary(sessionData.customerId!, day, { identityId, aiSummary, userSummary });
    return { aiSummary: null, status: 'saved' };
  }
};

export default function Summary() {
  const navigation = useNavigation();
  const activitiesFetcher = useFetcher();
  const activitiesResponse = activitiesFetcher.data as ActivityResponse;
  const summaryFetcher = useFetcher();
  const summaryResponse = summaryFetcher.data as SummariesResponse;
  const sessionData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [day, setDay] = useState<Dayjs | null>(dayjs().subtract(1, 'days'));
  const [activitiesText, setActivitiesText] = useState('');
  const [aiSummaryText, setAiSummaryText] = useState('');
  const [userSummaryText, setUserSummaryText] = useState('');
  const [showSavedConfirmation, setShowSavedConfirmation] = useState(false);

  // load activities and existing summary
  useEffect(() => {
    if (day) {
      activitiesFetcher.load(
        `/fetcher/activities/${sessionData.activityUserIds?.join(',')}?start=${day.startOf('day').valueOf()}&end=${day.endOf('day').valueOf()}`
      );
      summaryFetcher.load(`/fetcher/summaries/${sessionData.userId}?day=${day.format('YYYYMMDD')}`);
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
      setAiSummaryText(actionData.aiSummary ? getSummaryResult(actionData.aiSummary) : '');
    }
  }, [actionData]);

  useDeepCompareEffectNoCheck(() => {
    if (!activitiesResponse?.activities) {
      return;
    }
    const activitiesPrompt = buildActivitySummaryPrompt(
      Object.keys(activitiesResponse.activities).map(
        activityId => activitiesResponse.activities![activityId]
      ),
      sessionData.actors,
      {
        activityCount: 300, // FIXME summary activity count
        inclDates: false,
        inclActions: true,
        inclContributors: false,
      }
    );
    setActivitiesText(activitiesPrompt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesResponse?.activities]); // sessionData must be omitted

  useEffect(() => {
    setAiSummaryText(summaryResponse?.aiSummary ?? '');
    setUserSummaryText(summaryResponse?.userSummary ?? '');
  }, [summaryResponse?.aiSummary, summaryResponse?.userSummary]);

  return (
    <App
      view="summary.user"
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      showProgress={navigation.state !== 'idle' || activitiesFetcher.state !== 'idle'}
    >
      {sessionData?.error && (
        <Alert severity="error" sx={{ m: 3 }}>
          {sessionData?.error}
        </Alert>
      )}
      {activitiesResponse?.error?.message && (
        <Alert severity="error" sx={{ m: 3 }}>
          {activitiesResponse.error.message}
        </Alert>
      )}
      <Form method="post">
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
        <Stack direction="row" spacing={4} sx={{ m: 3, mt: 4 }}>
          <Box flex={1}>
            <Stack direction="row" spacing={2}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <StaticDatePicker
                  disableFuture={true}
                  slots={{ toolbar: undefined }}
                  slotProps={{ actionBar: { actions: [] }, toolbar: undefined }}
                  value={day}
                  onChange={newValue => setDay(newValue)}
                />
              </LocalizationProvider>
              <input type="hidden" name="day" value={day?.format('YYYYMMDD')} />
              <TextField
                name="activitiesText"
                label={'Activities to summarize for ' + formatDayLocal(day)}
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
            </Stack>
            <Box justifyContent="end" sx={{ display: 'flex', mt: 1, mb: 4 }}>
              <Button
                variant="contained"
                color="secondary"
                type="submit"
                name={BUTTON_AI}
                value="ai"
                disabled={navigation.state !== 'idle' || !activitiesText}
                title="You can invoke AI multiple times and keep the best output"
                endIcon={<AutoAwesomeIcon />}
              >
                {'Summarize'}
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                minHeight: '200px',
                maxHeight: '500px',
                overflowY: 'auto',
                my: 4,
              }}
            >
              <Box
                fontSize="smaller"
                sx={{ minHeight: 200, opacity: aiSummaryText ? undefined : 0.5 }}
              >
                <Markdown options={{ overrides: { a: { component: 'span' } } }}>
                  {aiSummaryText ||
                    'Click Summarize to generate a summary using Artificial Intelligence'}
                </Markdown>
                <input type="hidden" name="aiSummary" value={aiSummaryText} />
              </Box>
            </Paper>
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
            />
            <Box justifyContent="end" sx={{ display: 'flex', my: 2 }}>
              <Button
                variant="contained"
                type="submit"
                name={BUTTON_SAVE}
                value="save"
                title="Save the AI summary and your input"
                disabled={
                  navigation.state !== 'idle' ||
                  !activitiesText ||
                  //   !aiSummaryFormatted ||
                  !!sessionData?.error
                }
              >
                {'Save'}
              </Button>
            </Box>
          </Box>
        </Stack>
      </Form>
    </App>
  );
}
