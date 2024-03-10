import CopyIcon from '@mui/icons-material/ContentCopy';
import { Box, Link, List, ListItem, Stack, TextField, Typography } from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2/Grid2';
import { SettingsData } from '../../schemas/schemas';
import * as feedUtils from '../../utils/feedUtils';
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
  const serverJiraFeed = settingsData.feeds.filter(f => f.type === feedUtils.JIRA_FEED_TYPE)[0];

  const url = `https://ingest.roakit.com/jira/${serverJiraFeed.clientId}`;
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
        In your Jira administration console, go to <code>System WebHooks</code> in the Advanced
        section and click the <code>Create a Webhook</code> button.
        <List sx={{ listStyleType: 'disc', pl: 2 }}>
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            In the form that is shown, enter the <code>Name</code>, <code>URL</code>,{' '}
            <code>Scope</code> and <code>Event</code> settings as indicated above.
          </ListItem>
          <ListItem disablePadding sx={{ display: 'list-item' }}>
            To register the new webhook, click <code>Create</code>.
          </ListItem>
        </List>
        More information on configuring and using Jira webhooks can be found on their{' '}
        <Link
          target={'_blank'}
          href="https://developer.atlassian.com/server/jira/platform/webhooks/"
        >
          website
        </Link>
        .
      </Typography>
    </>
  );
}
