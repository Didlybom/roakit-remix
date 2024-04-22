import { AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { Box, Button, Paper, Stack, TextField } from '@mui/material';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { Form, useActionData, useFetcher, useLoaderData, useNavigation } from '@remix-run/react';
import dayjs, { Dayjs } from 'dayjs';
import Markdown from 'markdown-to-jsx';
import { useEffect, useState } from 'react';
import App from '../components/App';
import { fetchAccountMap, fetchIdentities } from '../firestore.server/fetchers.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts } from '../schemas/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { errMsg } from '../utils/errorUtils';
import { getAllPossibleActivityUserIds } from '../utils/identityUtils';
import { ActivityResponse } from './fetcher.activities.$userid';

export const meta = () => [{ title: 'Team Summary | ROAKIT' }];

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
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);

    const userId = params.userid;
    const activityUserIds =
      userId ? getAllPossibleActivityUserIds(userId, identities.list, identities.accountMap) : [];
    return {
      ...sessionData,
      activityUserIds,
      actors,
      error: null,
    };
  } catch (e) {
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch activities'),
      activityUserIds: null,
      activities: null,
      actors: null,
    };
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }
  const formData = await request.formData();
  const promptActivities = formData.get('activitiesText')?.toString() ?? '';
  if (!promptActivities) {
    throw Error('Empty prompt');
  }
  return await generateContent({ prompt: DEFAULT_PROMPT + '\n\n' + promptActivities });
};

export default function Summary() {
  const navigation = useNavigation();
  const activitiesFetcher = useFetcher();
  const sessionData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [day, setDay] = useState<Dayjs | null>(dayjs().subtract(1, 'days'));

  const [activitiesText, setActivitiesText] = useState('');
  const [summaryText, setSummaryText] = useState('');

  // load activities
  useEffect(() => {
    if (day) {
      activitiesFetcher.load(
        `/fetcher/activities/${sessionData.activityUserIds?.join(',')}?start=${day.startOf('day').valueOf()}&end=${day.endOf('day').valueOf()}`
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  useEffect(() => {
    if (!activitiesFetcher.data) {
      return;
    }
    const activities = (activitiesFetcher.data as ActivityResponse).activities;
    if (activities) {
      const activitiesPrompt = buildActivitySummaryPrompt(
        Object.keys(activities).map(activityId => activities[activityId]),
        sessionData.actors,
        {
          activityCount: 300, // FIXME summary activity count
          inclDates: false,
          inclActions: true,
          inclContributors: false,
        }
      );
      setActivitiesText(activitiesPrompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activitiesFetcher.data]); // sessionData must be omitted

  const output = actionData ? getSummaryResult(actionData) : null;

  return (
    <App
      view="summary.user"
      isLoggedIn={true}
      isNavOpen={sessionData.isNavOpen}
      showProgress={navigation.state !== 'idle' || activitiesFetcher.state !== 'idle'}
    >
      <Form method="post">
        <Stack direction="row" spacing={4} sx={{ m: 3 }}>
          <Box flex={1}>
            <LocalizationProvider dateAdapter={AdapterDayjs}>
              <DatePicker label="Day" value={day} onChange={newValue => setDay(newValue)} />
            </LocalizationProvider>
            <TextField
              name="activitiesText"
              label="Activities to summarize"
              value={activitiesText}
              disabled={activitiesFetcher.state !== 'idle'}
              multiline
              fullWidth
              minRows={15}
              maxRows={15}
              size="small"
              inputProps={{ style: { fontSize: 'smaller' } }}
              InputLabelProps={{ shrink: true }}
              onChange={e => setActivitiesText(e.target.value)}
              sx={{ mt: 3 }}
            />
            <Box justifyContent="end" sx={{ display: 'flex', mt: 1, mb: 4 }}>
              <Button
                variant="contained"
                color="secondary"
                type="submit"
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
                mt: 4,
              }}
            >
              <Box
                fontSize="smaller"
                sx={{ pb: 2, minHeight: 200, opacity: output ? undefined : 0.5 }}
              >
                <Markdown options={{ overrides: { a: { component: 'span' } } }}>
                  {output ?? 'Click Summarize to generate a summary using Artificial Intelligence'}
                </Markdown>
              </Box>
              <TextField
                name="summaryText"
                label="Your input"
                placeholder="Natural Intelligence"
                value={summaryText}
                multiline
                fullWidth
                minRows={3}
                maxRows={3}
                size="small"
                inputProps={{ style: { fontSize: 'smaller' } }}
                InputLabelProps={{ shrink: true }}
                onChange={e => setSummaryText(e.target.value)}
              />
              <Box justifyContent="end" sx={{ display: 'flex', my: 1 }}>
                <Button
                  variant="contained"
                  type="submit"
                  disabled={navigation.state !== 'idle' || !activitiesText || !output}
                >
                  {'Save'}
                </Button>
              </Box>
            </Paper>
          </Box>
        </Stack>
      </Form>
    </App>
  );
}
