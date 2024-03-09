import CopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  CircularProgress,
  IconButton,
  Link,
  List,
  ListItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';

import { useNavigation, useSubmit } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SettingsData } from '~/schemas/schemas';
import * as feedUtils from '../../utils/feedUtils';
import githubImage from './images/github-webhook.png';
import { actionIcon } from './route';

export default function GitHubSettings({
  settingsData,
  handleCopy,
  setPopover,
}: {
  settingsData: SettingsData;
  handleCopy: (content?: string) => void;
  setPopover: ({ element, content }: { element: HTMLElement; content: JSX.Element }) => void;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();

  const serverGitHubFeed = settingsData.feeds.filter(f => f.type === feedUtils.GITHUB_FEED_TYPE)[0];
  const gitHubURL = `https://ingest.roakit.com/github/${serverGitHubFeed.clientId}`;
  const [gitHubSecret, setGitHubSecret] = useState(serverGitHubFeed.secret);

  useEffect(() => {
    if (!serverGitHubFeed.secret) {
      setGitHubSecret(uuidv4());
    }
  }, [serverGitHubFeed.secret]);

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField label="GitHub URL" id="github-uri" value={gitHubURL} fullWidth disabled />
          </Grid>
          <Grid xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(gitHubURL))}
          </Grid>
        </Grid>
        {navigation.state !== 'loading' && (
          <Grid container spacing={1}>
            <Grid xs={10}>
              {gitHubSecret === serverGitHubFeed.secret ?
                <Tooltip title="If you've lost or forgotten the GitHub webhook secret, you can change it, but be aware that the webhook configuration on GitHub will need to be updated.">
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setGitHubSecret(uuidv4())}
                  >
                    Change GitHub Secret
                  </Button>
                </Tooltip>
              : <TextField
                  label="GitHub Secret"
                  value={gitHubSecret}
                  onChange={e => setGitHubSecret(e.target.value)}
                  disabled={navigation.state === 'submitting'}
                  fullWidth
                  InputProps={{
                    ...(navigation.state !== 'submitting' && {
                      endAdornment: (
                        <Tooltip title="Regenerate a secret">
                          <IconButton onClick={() => setGitHubSecret(uuidv4())}>
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      ),
                    }),
                  }}
                />
              }
            </Grid>
            <Grid xs={2} sx={{ alignSelf: 'center' }}>
              <Stack direction={'row'}>
                {gitHubSecret !== serverGitHubFeed.secret &&
                  actionIcon(<CopyIcon />, 'Copy secret to clipboard', () =>
                    handleCopy(gitHubSecret)
                  )}
                {navigation.state !== 'submitting' &&
                  gitHubSecret?.trim() &&
                  gitHubSecret !== serverGitHubFeed.secret &&
                  actionIcon(
                    <DoneIcon />,
                    'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                    () =>
                      submit(
                        {
                          feedId: serverGitHubFeed.feedId,
                          type: feedUtils.GITHUB_FEED_TYPE,
                          secret: gitHubSecret,
                        },
                        { method: 'post' }
                      )
                  )}
                {navigation.state === 'submitting' && (
                  <Box sx={{ alignSelf: 'center', ml: '8px', mt: '3px' }}>
                    <CircularProgress size="20px" />
                  </Box>
                )}
              </Stack>
            </Grid>
            {gitHubSecret !== serverGitHubFeed.secret && (
              <Typography variant="caption" sx={{ m: 1 }}>
                <strong>Copy</strong> this secret (to paste it on the GitHub Webhook configuration
                page) and <strong>save</strong> it by using the buttons on the right. For security
                reasons, it will be hidden once saved.
              </Typography>
            )}
          </Grid>
        )}
      </Stack>
      <Typography component="div" sx={{ mt: 5 }}>
        In your GitHub website, navigate to the <strong>Settings {'>'} Webhooks</strong> page for
        your organization (you must be an organization owner). You will need to create a new webhook
        for <strong>Roakit</strong> by clicking the <strong>Add webhook</strong> button in the upper
        right corner.
        <List sx={{ listStyleType: 'disc', pl: 2 }}>
          <ListItem sx={{ display: 'list-item' }}>
            <strong>Payload URL: </strong> copy the value from the field above
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            <strong>Content type :</strong> set this option to <code>application/json</code> to
            deliver to <strong>Roakit</strong> as JSON formatted text
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            <strong>Secret: </strong> a high entropy value shared with <strong>Roakit</strong> used
            to validate webhook deliveries; copy the value from the field above (don&apos;t forget
            to save it with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
          </ListItem>
        </List>
        More information on configuring and using GitHub webhooks can be found on their{' '}
        <Link
          target={'_blank'}
          href="https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks#creating-an-organization-webhook"
        >
          website
        </Link>
        .
        <Stack sx={{ mt: 4 }}>
          <Typography variant={'caption'}>Screenshot</Typography>
          <img
            src={githubImage}
            width="154"
            height="159"
            style={{ borderStyle: 'dotted', cursor: 'pointer' }}
            onClick={e =>
              setPopover({
                element: e.currentTarget,
                content: <img src={githubImage} width="768" height="794" />,
              })
            }
          />
        </Stack>
      </Typography>
    </>
  );
}
