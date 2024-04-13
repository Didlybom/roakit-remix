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
import { postJsonOptions } from '../../appActions';
import { SettingsData } from '../../schemas/schemas';
import * as feedUtils from '../../utils/feedUtils';
import BannedItems from './BannedItems.';
import confluenceImage from './images/confluence-webhook.png';
import { actionIcon, screenshotThumbSx } from './route';

export default function ConfluenceSettings({
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

  const serverData = settingsData.feeds.filter(f => f.type === feedUtils.CONFLUENCE_FEED_TYPE)[0];

  const url = `https://ingest.roakit.com/confluence/${serverData.clientId}`;
  const [secret, setSecret] = useState(serverData.secret);
  const events =
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed';

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
          <Grid xs={2}>
            {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(url))}
          </Grid>
        </Grid>
        {navigation.state !== 'loading' && (
          <Grid container spacing={1}>
            <Grid xs={10}>
              {secret === serverData.secret ?
                <Tooltip title="If you've lost or forgotten the Confluence webhook secret, you can change it, but be aware that the webhook configuration on Confluence will need to be updated.">
                  <Button variant="contained" color="secondary" onClick={() => setSecret(uuidv4())}>
                    Change Confluence Secret
                  </Button>
                </Tooltip>
              : <TextField
                  label="Secret"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  disabled={navigation.state !== 'idle'}
                  fullWidth
                  size="small"
                  InputProps={{
                    ...(navigation.state === 'idle' && {
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
                {navigation.state === 'idle' &&
                  secret?.trim() &&
                  secret !== serverData.secret &&
                  actionIcon(
                    <DoneIcon />,
                    'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                    () =>
                      fetcher.submit(
                        {
                          feedId: serverData.feedId,
                          type: feedUtils.CONFLUENCE_FEED_TYPE,
                          secret: secret,
                        },
                        postJsonOptions
                      )
                  )}
                {navigation.state !== 'idle' && (
                  <Box sx={{ ml: '8px', mt: '3px' }}>
                    <CircularProgress size="20px" />
                  </Box>
                )}
              </Stack>
            </Grid>
            {secret !== serverData.secret && (
              <Typography variant="caption" sx={{ m: 1 }}>
                <strong>Copy</strong> this secret (to paste it on the Confluence Webhook
                configuration page) and <strong>save</strong> it by using the buttons on the right.
                For security reasons, it will be hidden once saved.
              </Typography>
            )}
          </Grid>
        )}
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField
              label="Events"
              value={events}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid xs={2}>
            {actionIcon(<CopyIcon />, 'Copy events to clipboard', () => handleCopy(events))}
          </Grid>
        </Grid>
      </Stack>
      <Box
        component="img"
        src={confluenceImage}
        sx={{ width: '160px', height: '121px', ...screenshotThumbSx }}
        onClick={e =>
          setPopover({
            element: e.currentTarget,
            content: <img src={confluenceImage} width="800" height="604" />,
          })
        }
      />
      <Typography component="div" sx={{ mt: 5 }}>
        In your <strong>Confluence</strong> website, the administrator needs{' '}
        <code>Confluence Administrator</code> or <code>System Administrator</code> permissions to
        create the webhook using the values indicated above.
        <List
          sx={{ listStyleType: 'disc', pl: 2, '& .MuiListItem-root': { display: 'list-item' } }}
        >
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            Add a <code>Name</code> for the new webhook
          </ListItem>
          <ListItem disablePadding>
            Enter the <code>URL</code> of the <strong>Roakit</strong> service
          </ListItem>
          <ListItem disablePadding>
            Enter the <code>secret</code> for the <strong>Roakit</strong> service (don&apos;t forget
            to save it on this page with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
          </ListItem>
          <ListItem disablePadding>
            Click <strong>Test connection</strong> to verify your connection
          </ListItem>
          <ListItem disablePadding>Choose the Events that should trigger the webhook</ListItem>
          <ListItem disablePadding>
            Select <code>Active</code> to enable the webhook
          </ListItem>
          <ListItem disablePadding>
            Click <strong>Save</strong>
          </ListItem>
        </List>
        More information on configuring and using <strong>Confluence</strong> webhooks can be found
        on their{' '}
        <Link
          target="_blank"
          href="https://confluence.atlassian.com/doc/managing-webhooks-1021225606.html"
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
