import CopyIcon from '@mui/icons-material/ContentCopy';
import DoneIcon from '@mui/icons-material/Done';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  Button,
  CircularProgress,
  Grid,
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
import * as feedUtils from '../../utils/feedUtils';
import confluenceImage from './images/confluence-webhook.png';
import { SettingsData, actionIcon } from './route';

export default function ConfluenceSettings({
  settingsData,
  handleCopy,
}: {
  settingsData: SettingsData;
  handleCopy: (content?: string) => void;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();

  const serverConfluenceFeed = settingsData.feeds.filter(
    f => f.type === feedUtils.CONFLUENCE_FEED_TYPE
  )[0];

  const confluenceURL = `https://ingest.roakit.com/confluence/${serverConfluenceFeed.clientId}`;
  const [confluenceSecret, setConfluenceSecret] = useState(serverConfluenceFeed.secret);
  const confluenceEvents =
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed';

  useEffect(() => {
    if (!serverConfluenceFeed.secret) {
      setConfluenceSecret(uuidv4());
    }
  }, [serverConfluenceFeed.secret]);

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Grid container spacing={1}>
          <Grid item xs={10}>
            <TextField label="Confluence URL" value={confluenceURL} fullWidth disabled />
          </Grid>
          <Grid item xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(confluenceURL))}
          </Grid>
        </Grid>
        {navigation.state !== 'loading' && (
          <Grid container spacing={1}>
            <Grid item xs={10}>
              {confluenceSecret === serverConfluenceFeed.secret ?
                <Tooltip title="If you've lost or forgotten the Confluence webhook secret, you can change it, but be aware that the webhook configuration on Confluence will need to be updated.">
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setConfluenceSecret(uuidv4())}
                  >
                    Change Confluence Secret
                  </Button>
                </Tooltip>
              : <TextField
                  label="Confluence Secret"
                  value={confluenceSecret}
                  onChange={e => setConfluenceSecret(e.target.value)}
                  disabled={navigation.state === 'submitting'}
                  fullWidth
                  InputProps={{
                    ...(navigation.state !== 'submitting' && {
                      endAdornment: (
                        <Tooltip title="Regenerate a secret">
                          <IconButton onClick={() => setConfluenceSecret(uuidv4())}>
                            <RefreshIcon />
                          </IconButton>
                        </Tooltip>
                      ),
                    }),
                  }}
                />
              }
            </Grid>
            <Grid item xs={2} sx={{ alignSelf: 'center' }}>
              <Stack direction={'row'}>
                {confluenceSecret !== serverConfluenceFeed.secret &&
                  actionIcon(<CopyIcon />, 'Copy secret to clipboard', () =>
                    handleCopy(confluenceSecret)
                  )}
                {navigation.state !== 'submitting' &&
                  confluenceSecret?.trim() &&
                  confluenceSecret !== serverConfluenceFeed.secret &&
                  actionIcon(
                    <DoneIcon />,
                    'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                    () =>
                      submit(
                        {
                          customerId: settingsData.customerId,
                          feedId: serverConfluenceFeed.feedId,
                          type: feedUtils.CONFLUENCE_FEED_TYPE,
                          secret: confluenceSecret,
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
            {confluenceSecret !== serverConfluenceFeed.secret && (
              <Typography variant="caption" sx={{ m: 1 }}>
                <strong>Copy</strong> this secret (to paste it on the Confluence Webhook
                configuration page) and <strong>save</strong> it by using the buttons on the right.
                For security reasons, it will be hidden once saved.
              </Typography>
            )}
          </Grid>
        )}
        <Grid container spacing={1}>
          <Grid item xs={10}>
            <TextField label="Confluence Events" value={confluenceEvents} fullWidth disabled />
          </Grid>
          <Grid item xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy events to clipboard', () =>
              handleCopy(confluenceEvents)
            )}
          </Grid>
        </Grid>
      </Stack>
      <Typography component="div" sx={{ mt: 5 }}>
        In your Confluence website, the administrator needs Confluence Administrator or System
        Administrator permissions to create the webhook using the values indicated above.
        <List sx={{ listStyleType: 'disc', pl: 2 }}>
          <ListItem sx={{ display: 'list-item' }}>
            Add a <strong>Name</strong> for the new webhook
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Enter the <strong>URL</strong> of the <strong>Roakit</strong> service
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Enter the <strong>secret</strong> for the <strong>Roakit</strong> service (don&apos;t
            forget to save it on this page with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Select <strong>Test connection</strong> to verify your connection
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Choose the Events that should trigger the webhook
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Select <strong>Active</strong> to enable the webhook
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            Click <strong>Save</strong>
          </ListItem>
        </List>
        More information on configuring and using Confluence webhooks can be found on their{' '}
        <Link
          target={'_blank'}
          href="https://confluence.atlassian.com/doc/managing-webhooks-1021225606.html"
        >
          website
        </Link>
        .
        <Stack sx={{ mt: 4 }}>
          <Typography variant={'caption'}>Screenshot: </Typography>
          <img src={confluenceImage} width="800" height="604" style={{ borderStyle: 'dotted' }} />
        </Stack>
      </Typography>
    </>
  );
}
