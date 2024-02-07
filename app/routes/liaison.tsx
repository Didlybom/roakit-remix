import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Link as RemixLink, useLoaderData } from '@remix-run/react';
import * as React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth } from '~/firebase.server';
import confluenceImage from '~/images/confluence-webhook.png';
import githubImage from '~/images/github-webhook.png';
import jiraImage from '~/images/jira-webhook.png';
import { createClientId } from '~/utils/client-id.server';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// verify jwt
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return redirect('/login');
  }
  try {
    await serverAuth.verifySessionCookie(jwt);
    return { clientId: createClientId(1010, 1010) }; // FIXME client id
  } catch (e) {
    return redirect('/logout');
  }
};

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div role="tabpanel" hidden={value !== index} id={`tab-${index}`} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Settings() {
  const serverData = useLoaderData<typeof loader>();

  const [tabValue, setTabValue] = React.useState(0);

  const [jiraName] = React.useState('Webhook for ROAKIT');
  const [jiraURI] = React.useState(`https://liaison.roakit.com/jira/${serverData.clientId}`);
  const [jiraScope] = React.useState('all issues');
  const [jiraEvents] = React.useState('all events');

  const [githubURI] = React.useState(`https://liaison.roakit.com/github/${serverData.clientId}`);
  const [githubSecret, setGithubSecret] = React.useState(uuidv4());

  const [confluenceName] = React.useState('Webhook for ROAKIT');
  const [confluenceURI] = React.useState(
    `https://liaison.roakit.com/confluence/${serverData.clientId}`
  );
  const [confluenceSecret, setConfluenceSecret] = React.useState(uuidv4());
  const [confluenceEvents] = React.useState(
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed'
  );

  const [showCopyConfirmation, setShowCopyConfirmation] = React.useState(false);

  const handleCopyClick = (content: string) => {
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(true);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const copyIcon = (action: () => void) => (
    <Tooltip title="Copy to clipboard">
      <IconButton onClick={action}>
        <ContentCopyIcon />
      </IconButton>
    </Tooltip>
  );

  return (
    <React.Fragment>
      <Snackbar
        open={showCopyConfirmation}
        autoHideDuration={3000}
        onClose={(event: React.SyntheticEvent | Event, reason?: string) => {
          if (reason === 'clickaway') {
            return;
          }
          setShowCopyConfirmation(false);
        }}
        message="Copied to clipboard!"
      />
      <Typography variant="h6" sx={{ mb: 2 }}>
        <Link underline="none" to="/" component={RemixLink}>
          ROAKIT
        </Link>{' '}
        Liaison
      </Typography>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="Connectors">
          <Tab label="JIRA" id="tab-0" />
          <Tab label="GitHub" id="tab-1" />
          <Tab label="Confluence" id="tab-2" />
        </Tabs>
      </Box>
      <CustomTabPanel value={tabValue} index={0}>
        <Box component="form" noValidate autoComplete="off">
          <Stack spacing={3} maxWidth={600}>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField label="JIRA Name" id="jira-name" value={jiraName} fullWidth disabled />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraName))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField label="JIRA URI" id="jira-uri" value={jiraURI} fullWidth disabled />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraURI))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="JIRA Scope"
                  id="jira-scope"
                  value={jiraScope}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraScope))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="JIRA Events"
                  id="jira-events"
                  value={jiraEvents}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraEvents))}</Grid>
            </Grid>
          </Stack>
          <Typography component="div" sx={{ mt: 5 }}>
            In your Jira administration console, go to <strong>System WebHooks</strong> in the
            Advanced section click the [Create a Webhook] button.
            <List sx={{ listStyleType: 'disc', pl: 2 }}>
              <ListItem sx={{ display: 'list-item' }}>
                In the form that is shown, enter the <strong>Name</strong>, <strong>URL</strong>,{' '}
                <strong>Scope</strong> and <strong>Event</strong> settings as indicated above.
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                To register the new webhook, click [Create].
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
        </Box>
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <Box component="form" noValidate autoComplete="off">
          <Stack spacing={3} maxWidth={600}>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="GitHub URI"
                  id="github-uri"
                  value={githubURI}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(githubURI))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="GitHub Secret"
                  id="github-secret"
                  value={githubSecret}
                  onChange={(e) => setGithubSecret(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setGithubSecret(uuidv4())}>
                        <RefreshIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(githubSecret))}</Grid>
            </Grid>
          </Stack>
          <Typography component="div" sx={{ mt: 5 }}>
            In your GitHub website, navigate to the <strong>Webhook</strong> page for your
            organization. You will need to create a new webhook for <strong>Liaison</strong> by
            clicking the [Add webhook] button in the upper right corner.
            <List sx={{ listStyleType: 'disc', pl: 2 }}>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Payload URL: </strong> copy the value from the field above
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Content type :</strong> set this option to <code>application/json</code> to
                deliver to <strong>Liaison</strong> as JSON formatted text
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Secret: </strong> a high entropy value shared with <strong>Liaison</strong>{' '}
                used to validate webhook deliveries; copy the value from the field above
              </ListItem>
            </List>
            More information on configuring and using GitHub webhooks can be found on their{' '}
            <Link target={'_blank'} href="https://docs.github.com/en/webhooks/about-webhooks">
              website
            </Link>
            .
            <Stack sx={{ mt: 4 }}>
              <Typography variant={'caption'}>Screenshot: </Typography>
              <img src={githubImage} width="768" height="794" style={{ borderStyle: 'dotted' }} />
            </Stack>
          </Typography>
        </Box>
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={2}>
        <Box component="form" noValidate autoComplete="off">
          <Stack spacing={3} maxWidth={600}>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="Confluence Name"
                  id="confluence-name"
                  value={confluenceName}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(confluenceName))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="Confluence URL"
                  id="confluence-url"
                  value={confluenceURI}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(confluenceURI))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="Confluence Secret"
                  id="confluence-secret"
                  value={confluenceSecret}
                  onChange={(e) => setConfluenceSecret(e.target.value)}
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={() => setConfluenceSecret(uuidv4())}>
                        <RefreshIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(confluenceSecret))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="Confluence Events"
                  id="confluence-events"
                  value={confluenceEvents}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(confluenceEvents))}</Grid>
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
                Enter the <strong>URL</strong> of the <strong>Liaison</strong> service
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                Enter the <strong>secret</strong> for the <strong>Liaison</strong> service
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
              <img
                src={confluenceImage}
                width="800"
                height="604"
                style={{ borderStyle: 'dotted' }}
              />
            </Stack>
          </Typography>
        </Box>
      </CustomTabPanel>
    </React.Fragment>
  );
}
