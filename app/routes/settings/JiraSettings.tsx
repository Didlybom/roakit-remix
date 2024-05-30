import { ContentCopy as CopyIcon } from '@mui/icons-material';
import {
  Box,
  Unstable_Grid2 as Grid,
  Link,
  List,
  ListItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type { SettingsData } from '../../types/types';
import * as feedUtils from '../../utils/feedUtils';
import BannedItems from './BannedItems.';
import jiraImage from './images/jira-webhook.png';
import { actionIcon, screenshotThumbSx } from './route';

export default function JiraSettings({
  settingsData,
  handleCopy,
  setPopover,
}: {
  settingsData: SettingsData;
  handleCopy: (content?: string) => void;
  setPopover: ({ element, content }: { element: HTMLElement; content: JSX.Element }) => void;
}) {
  const serverData = settingsData.feeds.filter(f => f.type === feedUtils.JIRA_FEED_TYPE)[0];

  const url = `https://ingest-frzqvloirq-uw.a.run.app/jira/${serverData.clientId}`;
  const scope = 'all issues';
  const events = 'all events';

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
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField
              label="Scope"
              value={scope}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid xs={2}>
            {actionIcon(<CopyIcon />, 'Copy scopes to clipboard', () => handleCopy(scope))}
          </Grid>
        </Grid>
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
        src={jiraImage}
        sx={{ width: '174px', height: '78px', ...screenshotThumbSx }}
        onClick={e =>
          setPopover({
            element: e.currentTarget,
            content: <img src={jiraImage} width="870" height="389" />,
          })
        }
      />
      <Typography component="div" sx={{ mt: 5 }}>
        In your <strong>Jira</strong> administration console, go to <strong>System WebHooks</strong>{' '}
        in the Advanced section and click the <strong>Create a Webhook</strong> button.
        <List
          sx={{ listStyleType: 'disc', pl: 2, '& .MuiListItem-root': { display: 'list-item' } }}
        >
          <ListItem disablePadding>
            In the form that is shown, enter the <code>Name</code>, <code>URL</code>,{' '}
            <code>Scope</code> and <code>Event</code> settings as indicated above.
          </ListItem>
          <ListItem disablePadding>
            To register the new webhook, click <strong>Create</strong>.
          </ListItem>
        </List>
        More information on configuring and using <strong>Jira</strong> webhooks can be found on
        their{' '}
        <Link target="_blank" href="https://developer.atlassian.com/server/jira/platform/webhooks/">
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
