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

import { useFetcher, useNavigation } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { SettingsData } from '../../schemas/schemas';
import * as feedUtils from '../../utils/feedUtils';
import githubImage from './images/github-webhook.png';
import { actionIcon, screenshotThumbSx } from './route';

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
  const fetcher = useFetcher();

  const serverData = settingsData.feeds.filter(f => f.type === feedUtils.GITHUB_FEED_TYPE)[0];
  const url = `https://ingest.roakit.com/github/${serverData.clientId}`;
  const [secret, setSecret] = useState(serverData.secret);

  useEffect(() => {
    if (!serverData.secret) {
      setSecret(uuidv4());
    }
  }, [serverData.secret]);

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField
              label="URL"
              value={url}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(url))}
          </Grid>
        </Grid>
        {navigation.state !== 'loading' && (
          <Grid container spacing={1}>
            <Grid xs={10}>
              {secret === serverData.secret ?
                <Tooltip title="If you've lost or forgotten the GitHub webhook secret, you can change it, but be aware that the webhook configuration on GitHub will need to be updated.">
                  <Button variant="contained" color="secondary" onClick={() => setSecret(uuidv4())}>
                    Change GitHub Secret
                  </Button>
                </Tooltip>
              : <TextField
                  label="Secret"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  disabled={navigation.state === 'submitting'}
                  fullWidth
                  size="small"
                  InputProps={{
                    ...(navigation.state !== 'submitting' && {
                      endAdornment: (
                        <Tooltip title="Regenerate a secret">
                          <IconButton onClick={() => setSecret(uuidv4())}>
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      ),
                    }),
                  }}
                />
              }
            </Grid>
            <Grid xs={2}>
              <Stack direction={'row'}>
                {secret !== serverData.secret &&
                  actionIcon(<CopyIcon />, 'Copy secret to clipboard', () => handleCopy(secret))}
                {navigation.state !== 'submitting' &&
                  secret?.trim() &&
                  secret !== serverData.secret &&
                  actionIcon(
                    <DoneIcon />,
                    'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                    () =>
                      fetcher.submit(
                        {
                          feedId: serverData.feedId,
                          type: feedUtils.GITHUB_FEED_TYPE,
                          secret: secret,
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
            {secret !== serverData.secret && (
              <Typography variant="caption" sx={{ m: 1 }}>
                <strong>Copy</strong> this secret (to paste it on the GitHub Webhook configuration
                page) and <strong>save</strong> it by using the buttons on the right. For security
                reasons, it will be hidden once saved.
              </Typography>
            )}
          </Grid>
        )}
      </Stack>
      <Box
        component="img"
        src={githubImage}
        sx={{ width: '154px', height: '159px', ...screenshotThumbSx }}
        onClick={e =>
          setPopover({
            element: e.currentTarget,
            content: <img src={githubImage} width="768" height="794" />,
          })
        }
      />
      <Typography component="div" sx={{ mt: 5 }}>
        In your GitHub website, navigate to the <code>Settings {'>'} Webhooks</code> page for your
        organization (you must be an organization owner). You will need to create a new webhook for{' '}
        <strong>Roakit</strong> by clicking the <code>Add webhook</code> button in the upper right
        corner.
        <List sx={{ listStyleType: 'disc', pl: 2 }}>
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            <code>Payload URL</code> — copy the value from the field above
          </ListItem>
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            <code>Content type</code> — set this option to <code>application/json</code> to deliver
            to <strong>Roakit</strong> as JSON formatted text
          </ListItem>
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            <code>Secret</code> — a high entropy value shared with <strong>Roakit</strong> used to
            validate webhook deliveries; copy the value from the field above (don&apos;t forget to
            save it with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
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
      </Typography>
    </>
  );
}
