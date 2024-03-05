import CopyIcon from '@mui/icons-material/ContentCopy';
import { Grid, Link, List, ListItem, Stack, TextField, Typography } from '@mui/material';
import * as feedUtils from '../../utils/feedUtils';
import jiraImage from './images/jira-webhook.png';
import { SettingsData, actionIcon } from './route';

export default function JiraSettings({
  settingsData,
  handleCopy,
}: {
  settingsData: SettingsData;
  handleCopy: (content?: string) => void;
}) {
  const serverJiraFeed = settingsData.feeds.filter(f => f.type === feedUtils.JIRA_FEED_TYPE)[0];

  const jiraURL = `https://ingest.roakit.com/jira/${serverJiraFeed.clientId}`;
  const jiraScope = 'all issues';
  const jiraEvents = 'all events';

  return (
    <>
      <Stack spacing={3} maxWidth={600}>
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField label="JIRA URI" id="jira-uri" value={jiraURL} fullWidth disabled />
          </Grid>
          <Grid xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(jiraURL))}
          </Grid>
        </Grid>
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField label="JIRA Scope" value={jiraScope} fullWidth disabled />
          </Grid>
          <Grid xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy scopes to clipboard', () => handleCopy(jiraScope))}
          </Grid>
        </Grid>
        <Grid container spacing={1}>
          <Grid xs={10}>
            <TextField label="JIRA Events" value={jiraEvents} fullWidth disabled />
          </Grid>
          <Grid xs={2} sx={{ alignSelf: 'center' }}>
            {actionIcon(<CopyIcon />, 'Copy events to clipboard', () => handleCopy(jiraEvents))}
          </Grid>
        </Grid>
      </Stack>
      <Typography component="div" sx={{ mt: 5 }}>
        In your Jira administration console, go to <strong>System WebHooks</strong> in the Advanced
        section click the <strong>Create a Webhook</strong> button.
        <List sx={{ listStyleType: 'disc', pl: 2 }}>
          <ListItem sx={{ display: 'list-item' }}>
            In the form that is shown, enter the <strong>Name</strong>, <strong>URL</strong>,{' '}
            <strong>Scope</strong> and <strong>Event</strong> settings as indicated above.
          </ListItem>
          <ListItem sx={{ display: 'list-item' }}>
            To register the new webhook, click Create.
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
      <Stack sx={{ mt: 5 }}>
        <Typography variant={'caption'}>Screenshot: </Typography>
        <img
          src={jiraImage}
          width="870"
          height="389"
          style={{ padding: 15, borderStyle: 'dotted' }}
        />
      </Stack>
    </>
  );
}
