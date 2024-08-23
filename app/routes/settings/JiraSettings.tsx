import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { Box, Link, List, ListItem, Stack, TextField, Typography } from '@mui/material';
import { JIRA_FEED_TYPE, type Settings } from '../../types/types';
import BannedItems from './BannedItems.';
import jiraImage from './images/jira-webhook.png';
import { actionIcon, screenshotThumbSx } from './route';

export default function JiraSettings({
  settingsData,
  handleCopy,
  setPopover,
}: {
  settingsData: Settings;
  handleCopy: (content?: string) => void;
  setPopover: ({ element, content }: { element: HTMLElement; content: JSX.Element }) => void;
}) {
  const serverData = settingsData.feeds.filter(f => f.type === JIRA_FEED_TYPE)[0];

  const url = `https://ingest-frzqvloirq-uw.a.run.app/jira/${serverData.clientId}`;
  const scope = 'all issues';
  const events = 'all events';

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Stack direction="row" spacing={1}>
          <TextField
            label="URL"
            value={url}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
          />
          {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(url))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Scope"
            value={scope}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
          />
          {actionIcon(<CopyIcon />, 'Copy scopes to clipboard', () => handleCopy(scope))}
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField
            label="Events"
            value={events}
            fullWidth
            size="small"
            InputProps={{ readOnly: true }}
          />
          {actionIcon(<CopyIcon />, 'Copy events to clipboard', () => handleCopy(events))}
        </Stack>
      </Stack>
      <Box
        component="img"
        src={jiraImage}
        sx={{ width: '174px', height: '78px', ...screenshotThumbSx }}
        onClick={e =>
          setPopover({
            element: e.currentTarget,
            content: <img src={jiraImage} width="870" height="389" alt="Screenshot" />,
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
