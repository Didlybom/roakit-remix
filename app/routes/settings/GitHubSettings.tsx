import {
  ContentCopy as CopyIcon,
  Done as DoneIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
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
import { useNavigation, useSubmit } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { GITHUB_FEED_TYPE, type Settings } from '../../types/types';
import { postJsonOptions } from '../../utils/httpUtils';
import BannedItems from './BannedItems.';
import githubImage from './images/github-webhook.png';
import { actionIcon, screenshotThumbSx } from './route';

export default function GitHubSettings({
  settingsData,
  handleCopy,
  setPopover,
}: {
  settingsData: Settings;
  handleCopy: (content?: string) => void;
  setPopover: ({ element, content }: { element: HTMLElement; content: JSX.Element }) => void;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const serverData = settingsData.feeds.filter(f => f.type === GITHUB_FEED_TYPE)[0];
  const url = `https://ingest-frzqvloirq-uw.a.run.app/github/${serverData.clientId}`;
  const [secret, setSecret] = useState(serverData.secret);

  useEffect(() => {
    if (!serverData.secret) {
      setSecret(uuidv4());
    }
  }, [serverData.secret]);

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Stack direction="row" spacing={1}>
          <TextField
            label="URL"
            value={url}
            fullWidth
            size="small"
            slotProps={{ input: { readOnly: true } }}
          />
          {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(url))}
        </Stack>
        {navigation.state !== 'loading' && (
          <>
            <Stack direction="row" spacing={1}>
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
                  disabled={navigation.state !== 'idle'}
                  fullWidth
                  size="small"
                  slotProps={{
                    input: {
                      ...(navigation.state === 'idle' && {
                        endAdornment: (
                          <Tooltip title="Regenerate a secret">
                            <IconButton onClick={() => setSecret(uuidv4())}>
                              <RefreshIcon />
                            </IconButton>
                          </Tooltip>
                        ),
                      }),
                    },
                  }}
                />
              }
              <Stack direction={'row'}>
                {secret !== serverData.secret &&
                  actionIcon(<CopyIcon />, 'Copy secret to clipboard', () => handleCopy(secret))}
                {navigation.state === 'idle' &&
                  secret?.trim() &&
                  secret !== serverData.secret &&
                  actionIcon(
                    <DoneIcon />,
                    'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                    () =>
                      submit(
                        {
                          feedId: serverData.feedId,
                          type: GITHUB_FEED_TYPE,
                          secret: secret,
                        },
                        postJsonOptions
                      )
                  )}
                {navigation.state !== 'idle' && (
                  <Box sx={{ alignSelf: 'center', ml: '8px', mt: '3px' }}>
                    <CircularProgress size="20px" />
                  </Box>
                )}
              </Stack>
            </Stack>
            {secret !== serverData.secret && (
              <Typography variant="caption" sx={{ m: 1 }}>
                <strong>Copy</strong> this secret (to paste it on the GitHub Webhook configuration
                page) and <strong>save</strong> it by using the buttons on the right. For security
                reasons, it will be hidden once saved.
              </Typography>
            )}
          </>
        )}
      </Stack>
      <Box
        component="img"
        src={githubImage}
        sx={{ width: '154px', height: '159px', ...screenshotThumbSx }}
        onClick={e =>
          setPopover({
            element: e.currentTarget,
            content: <img src={githubImage} width="768" height="794" alt="Screenshot" />,
          })
        }
      />
      <Typography component="div" sx={{ mt: 5 }}>
        In your <strong>GitHub</strong> website, navigate to the{' '}
        <strong>Settings {'>'} Webhooks</strong> page for your organization (you must be an
        organization <code>owner</code>). You will need to create a new webhook for{' '}
        <strong>Roakit</strong> by clicking the <strong>Add webhook</strong> button in the upper
        right corner.
        <List
          sx={{ listStyleType: 'disc', pl: 2, '& .MuiListItem-root': { display: 'list-item' } }}
        >
          <ListItem disablePadding>
            <code>Payload URL</code> — copy the value from the field above
          </ListItem>
          <ListItem disablePadding>
            <code>Content type</code> — set this option to <code>application/json</code> to deliver
            to <strong>Roakit</strong> as JSON formatted text
          </ListItem>
          <ListItem disablePadding>
            <code>Secret</code> — a high entropy value shared with <strong>Roakit</strong> used to
            validate webhook deliveries; copy the value from the field above (don&apos;t forget to
            save it with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
          </ListItem>
        </List>
        More information on configuring and using <strong>GitHub</strong> webhooks can be found on
        their{' '}
        <Link
          target="_blank"
          href="https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks#creating-an-organization-webhook"
        >
          website
        </Link>
        .
      </Typography>
      <Typography variant="h6" sx={{ mt: 5, mb: 2 }}>
        Advanced Settings
      </Typography>
      <Box>
        <BannedItems
          storedBannedItems={serverData.bannedEvents}
          storageKey="bannedEvents"
          title="Banned Events"
          feedId={serverData.feedId}
          feedType={serverData.type}
        />
      </Box>
      <Box sx={{ mt: 3 }}>
        <BannedItems
          storedBannedItems={serverData.bannedAccounts}
          storageKey="bannedAccounts"
          title="Banned Accounts"
          feedId={serverData.feedId}
          feedType={serverData.type}
        />
      </Box>
    </>
  );
}
