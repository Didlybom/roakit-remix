import { MenuBook as DocumentationIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData, useNavigation } from '@remix-run/react';
import dayjs from 'dayjs';
import { useEffect, useState } from 'react';
import Markdown from '../components/MarkdownText';
import {
  fetchAccountMap,
  fetchActivities,
  fetchIdentities,
  fetchInitiativeMap,
} from '../firestore.server/fetchers.server';
import { generateContent } from '../gemini.server/gemini.server';
import { identifyAccounts, identifyActivities } from '../types/activityFeed';
import { DEFAULT_PROMPT, buildActivitySummaryPrompt, getSummaryResult } from '../utils/aiUtils';
import { loadSession } from '../utils/authUtils.server';
import { DateRange, dateFilterToStartDate } from '../utils/dateUtils';
import { formatJson, loaderErrorResponse } from '../utils/jsxUtils';
import { Role, View } from '../utils/rbac';

export const meta = () => [{ title: 'AI playground | ROAKIT' }];

export const shouldRevalidate = () => false;

const VIEW = View.AI;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  if (sessionData.role !== Role.Admin && sessionData.role !== Role.Monitor) {
    throw new Response(null, { status: 403 });
  }
  try {
    // retrieve users and initiatives
    const [initiatives, accounts, identities] = await Promise.all([
      fetchInitiativeMap(sessionData.customerId!),
      fetchAccountMap(sessionData.customerId!),
      fetchIdentities(sessionData.customerId!),
    ]);

    // retrieve last day activities
    const startDate = dateFilterToStartDate(DateRange.OneDay, dayjs())!;
    const activities = identifyActivities(
      await fetchActivities({
        customerId: sessionData.customerId!,
        startDate,
        options: { includeMetadata: true },
      }),
      identities.accountMap
    );
    const actors = identifyAccounts(accounts, identities.list, identities.accountMap);
    return {
      ...sessionData,
      activities,
      actors,
      initiatives,
    };
  } catch (e) {
    throw loaderErrorResponse(e);
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await loadSession(request, VIEW);
  const formData = await request.formData();
  const prompt = formData.get('prompt')?.toString();
  if (!prompt) {
    throw Error('Empty prompt');
  }
  const promptActivities = formData.get('promptActivities')?.toString();
  const temperature = Number(formData.get('temperature') ?? 0) || undefined;
  const topK = Number(formData.get('topK') ?? 0) || undefined;
  const topP = Number(formData.get('topP') ?? 0) || undefined;
  const model = formData.get('model')?.toString();
  const result = await generateContent({
    prompt: prompt + '\n\n' + promptActivities,
    temperature,
    topK,
    topP,
    model,
  });
  return result;
};

const MODELS = [
  'gemini-1.0-pro-002',
  'gemini-1.5-pro-preview-0514',
  'gemini-1.5-flash-preview-0514',
  // 'text-bison@002',
];

export default function AIPlayground() {
  const navigation = useNavigation();
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [activityCount, setActivityCount] = useState(100);
  const [inclDates, setInclDates] = useState(false);
  const [inclActions, setInclActions] = useState(true);
  const [inclContributors, setInclContributors] = useState(true);
  const [model, setModel] = useState(MODELS[0]);

  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const activities = buildActivitySummaryPrompt(
      loaderData.activities,
      loaderData.actors,
      loaderData.initiatives,
      {
        activityCount,
        inclDates,
        inclActions,
        inclContributors,
      }
    );
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
                {'Generate Summary'}
              </Button>
            </Box>
            <Typography variant="caption">Response</Typography>
            <Paper
              variant="outlined"
              sx={{
                px: 2,
                mb: 4,
                minHeight: '200px',
                maxHeight: '400px',
                overflowY: 'auto',
              }}
            >
              <Box fontSize="smaller">
                <Markdown markdownText={output ?? ''} />
              </Box>
            </Paper>
            <Typography variant="caption">Raw Response</Typography>
            <Paper variant="outlined">
              <Typography
                component="pre"
                fontFamily="Roboto Mono, monospace"
                fontSize="smaller"
                color={grey[700]}
                sx={{
                  whiteSpace: 'pre-wrap',
                  p: 2,
                  minHeight: '200px',
                  maxHeight: '200px',
                  overflow: 'auto',
                }}
              >
                {formatJson(actionData)}
              </Typography>
            </Paper>
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
                sx={{ ml: 1 }}
              />
            ))}
            <Divider sx={{ my: 2 }} />
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
            <Typography variant="caption">
              <Button
                href="https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/design-multimodal-prompts#temperature"
                target="_blank"
                startIcon={<DocumentationIcon fontSize="small" />}
                sx={{ textTransform: 'none' }}
              >
                Documentation
              </Button>
            </Typography>

            <FormControl sx={{ width: 200, mt: 2 }}>
              <InputLabel>Model</InputLabel>
              <Select
                name="model"
                value={model}
                label="Model"
                onChange={e => setModel(e.target.value)}
              >
                {MODELS.map((m, i) => (
                  <MenuItem key={i} value={m}>
                    {m}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Stack>
      </Form>
    </>
  );
}
