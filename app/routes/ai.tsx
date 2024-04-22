import {
  Box,
  Button,
  Divider,
  FormControlLabel,
  LinearProgress,
  Link,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { ActionFunctionArgs, LoaderFunctionArgs, redirect } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import Markdown from 'markdown-to-jsx';
import { useEffect, useState } from 'react';
import {
  fetchAccountMap,
  fetchActivities,
  fetchIdentities,
} from '../firestore.server/fetchers.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts, identifyActivities } from '../schemas/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { formatJson } from '../utils/jsxUtils';
export const meta = () => [{ title: 'AI playground | ROAKIT' }];

// load activities
export const loader = async ({ request }: LoaderFunctionArgs) => {
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

    // retrieve last day activities
    const startDate = dateFilterToStartDate(DateRange.OneDay)!;
    const activities = identifyActivities(
      await fetchActivities({
        customerId: sessionData.customerId!,
        startDate,
        options: { includesMetadata: true },
      }),
      identities.accountMap
    );
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      activities: [...activities].map(([, activity]) => activity),
      actors,
      error: null,
    };
  } catch (e) {
    return {
      ...sessionData,
      error: errMsg(e, 'Failed to fetch activities'),
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
  const prompt = formData.get('prompt')?.toString() ?? '';
  if (!prompt) {
    throw Error('Empty prompt');
  }
  const promptActivities = formData.get('promptActivities')?.toString() ?? '';
  const temperature = Number(formData.get('temperature') ?? 0) || undefined;
  const topK = Number(formData.get('topK') ?? 0) || undefined;
  const topP = Number(formData.get('topP') ?? 0) || undefined;
  const result = await generateContent({
    prompt: prompt + '\n\n' + promptActivities,
    temperature,
    topK,
    topP,
  });
  return result;
};

export default function AIPlayground() {
  const navigation = useNavigation();
  const sessionData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [activityCount, setActivityCount] = useState(100);
  const [inclDates, setInclDates] = useState(true);
  const [inclActions, setInclActions] = useState(true);
  const [inclContributors, setInclContributors] = useState(true);
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const activities = buildActivitySummaryPrompt(sessionData.activities, sessionData.actors, {
      activityCount,
      inclDates,
      inclActions,
      inclContributors,
    });
    setPrompt(activities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityCount, inclDates, inclActions, inclContributors]); // sessionData must be omitted

  const output = actionData ? getSummaryResult(actionData) : null;

  return (
    <>
      {navigation.state !== 'idle' ?
        <LinearProgress sx={{ mb: '30px' }} />
      : <Box height="18px" />}
      <Form method="post">
        <Stack direction="row" spacing={4} sx={{ m: 2 }}>
          <Box flex={1}>
            <TextField
              name="prompt"
              label="Prompt 1/2"
              defaultValue={DEFAULT_PROMPT}
              multiline
              fullWidth
              minRows={3}
              maxRows={3}
              size="small"
              inputProps={{ style: { fontSize: 'smaller' } }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              name="promptActivities"
              label="Prompt 2/2"
              value={prompt}
              multiline
              fullWidth
              minRows={15}
              maxRows={15}
              size="small"
              inputProps={{ style: { fontSize: 'smaller' } }}
              InputLabelProps={{ shrink: true }}
              onChange={e => setPrompt(e.target.value)}
              sx={{ mt: 2 }}
            />
            <Box justifyContent="end" sx={{ display: 'flex', mt: 1, mb: 4 }}>
              <Button variant="contained" type="submit" disabled={navigation.state !== 'idle'}>
                {'Submit'}
              </Button>
            </Box>
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                minHeight: '200px',
                maxHeight: '500px',
                overflowY: 'auto',
              }}
            >
              <Box fontSize="smaller">
                <Markdown options={{ overrides: { a: { component: 'span' } } }}>
                  {output ?? ''}
                </Markdown>
              </Box>
            </Paper>
            <TextField
              label="Raw Response"
              multiline
              fullWidth
              minRows={8}
              maxRows={8}
              size="small"
              inputProps={{ style: { fontSize: 'smaller' } }}
              InputProps={{ readOnly: true }}
              InputLabelProps={{ shrink: true }}
              sx={{ mt: 4 }}
              value={formatJson(actionData)}
            />
          </Box>
          <Stack spacing={2} useFlexGap>
            <TextField
              type="number"
              label="Max Activities"
              size="small"
              sx={{ mt: 13, width: '15ch' }}
              value={activityCount}
              onChange={e => setActivityCount(+e.target.value)}
            />
            {(
              [
                [inclDates, setInclDates, 'Dates'],
                [inclActions, setInclActions, 'Actions'],
                [inclContributors, setInclContributors, 'Contributors'],
              ] as [boolean, (checked: boolean) => void, string][]
            ).map(([value, set, label], i) => (
              <FormControlLabel
                key={i}
                control={
                  <Switch size="small" checked={value} onChange={e => set(e.target.checked)} />
                }
                label={<Box fontSize="small">{label}</Box>}
              />
            ))}
            <Divider />
            <TextField
              name="temperature"
              type="number"
              inputProps={{ step: 0.1 }}
              label="Temperature"
              defaultValue="0.4"
              size="small"
              sx={{ width: '15ch' }}
            />
            <TextField
              name="topK"
              type="number"
              label="Top-K"
              defaultValue="32"
              size="small"
              sx={{ width: '15ch' }}
            />
            <TextField
              name="topP"
              type="number"
              inputProps={{ step: 0.1 }}
              label="Top-P"
              defaultValue="1.0"
              size="small"
              sx={{ width: '15ch' }}
            />
            <Typography
              component={Link}
              variant="caption"
              href="https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/design-multimodal-prompts#temperature"
              target="_blank"
            >
              Documentation
            </Typography>
          </Stack>
        </Stack>
      </Form>
    </>
  );
}
