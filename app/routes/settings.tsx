import * as React from 'react';
import { Link as RemixLink } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import {
  Box,
  IconButton,
  Link,
  List,
  ListItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { v4 as uuidv4 } from 'uuid';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth } from '~/firebase.server';

import jiraImage from '~/images/jira-webhook.png';
import githubImage from '~/images/github-webhook.png';
import confluenceImage from '~/images/confluence-webhook.png';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

// verify jwt
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const jwt = await sessionCookie.parse(request.headers.get('Cookie'));
  if (!jwt) {
    return redirect('/login');
  }
  try {
    await serverAuth.verifySessionCookie(jwt);
    return null;
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
  const [tabValue, setTabValue] = React.useState(0);

  const [jiraName] = React.useState('Webhook for ROAKIT');
  const [jiraURI] = React.useState('https://liason.roakit.com/jira');
  const [jiraScope] = React.useState('all issues');
  const [jiraEvents] = React.useState('all events');

  const [gitHubURI] = React.useState('https://liason.roakit.com/github');
  const [gitHubSecret, setGitHubSecret] = React.useState(uuidv4());

  const [confluenceName] = React.useState('Webhook for ROAKIT');
  const [confluenceURI] = React.useState('https://liason.roakit.com/confluence');
  const [confluenceSecret, setConfluenceSecret] = React.useState(uuidv4());
  const [confluenceEvents] = React.useState(
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed',
  );

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <React.Fragment>
      <Typography variant="h6" component="div" sx={{ mb: 2 }}>
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
          <Stack spacing={4}>
            <Box>
              <TextField
                label="JIRA Name"
                id="jira-name"
                sx={{ width: '50ch' }}
                value={jiraName}
                disabled
              />
              <IconButton onClick={() => navigator.clipboard.writeText(jiraName)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Box>
              <TextField
                label="JIRA URI"
                id="jira-uri"
                sx={{ width: '50ch' }}
                value={jiraURI}
                disabled
              />
              <IconButton onClick={() => navigator.clipboard.writeText(jiraURI)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Box>
              <TextField
                label="JIRA Scope"
                id="jira-scope"
                sx={{ width: '50ch' }}
                value={jiraScope}
                disabled
              />
              <IconButton onClick={() => navigator.clipboard.writeText(jiraScope)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Box>
              <TextField
                label="JIRA Events"
                id="jira-events"
                sx={{ width: '50ch' }}
                value={jiraEvents}
                disabled
              />
              <IconButton onClick={() => navigator.clipboard.writeText(jiraEvents)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Typography>
              In your Jira administration console, go to <strong>System WebHooks</strong> in the
              Advanced section click the "Create a Webhook" button.
              <List sx={{ listStyleType: 'disc', pl: 2, lineHeight: '80%' }}>
                <ListItem sx={{ display: 'list-item' }}>
                  In the form that is shown, enter the <strong>Name</strong>, <strong>URL</strong>,{' '}
                  <strong>Scope</strong> and <strong>Event</strong> settings as indicated above.
                </ListItem>
                <ListItem sx={{ display: 'list-item' }}>
                  To register the new webhook, click "Create".
                </ListItem>
              </List>
              More information on configuring and using Jira webhooks can be found on their website
              at{' '}
              <Link
                target={'_blank'}
                href="https://developer.atlassian.com/server/jira/platform/webhooks/"
              >
                https://developer.atlassian.com/server/jira/platform/webhooks/
              </Link>
              .
            </Typography>
            <Box sx={{ m: 5 }}>
              <Stack>
                <Typography variant={'caption'}>Screenshot: </Typography>
                <Box sx={{ border: 1, p: 2 }}>
                  <img src={jiraImage} width="870" height="389" />
                </Box>
              </Stack>
            </Box>
          </Stack>
        </Box>
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <Box component="form" noValidate autoComplete="off">
          <Stack spacing={4}>
            <Box>
              <TextField
                label="GitHub URI"
                id="github-uri"
                sx={{ width: '50ch' }}
                value={gitHubURI}
                disabled
              />
              <IconButton
                onClick={() => {
                  navigator.clipboard.writeText(gitHubURI);
                }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Box>
              <TextField
                label="GitHub Secret"
                id="github-secret"
                value={gitHubSecret}
                onChange={(e) => setGitHubSecret(e.target.value)}
                sx={{ width: '50ch' }}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => setGitHubSecret(uuidv4())}>
                      <RefreshIcon />
                    </IconButton>
                  ),
                }}
              />
              <IconButton
                onClick={() => {
                  navigator.clipboard.writeText(gitHubSecret);
                }}
              >
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Typography>
              In your GitHub website, navigate to the <strong>Webhook</strong> page for your
              organization. You will need to create a new webhook for <strong>Liaison</strong> by
              clicking the "Add webhook" button in the upper right corner.
              <List sx={{ listStyleType: 'disc', pl: 2, lineHeight: '80%' }}>
                <ListItem sx={{ display: 'list-item' }}>
                  <strong>Payload URL: </strong> copy the value from the field above
                </ListItem>
                <ListItem sx={{ display: 'list-item' }}>
                  <strong>Content type :</strong> set this option to <code>application/json</code>{' '}
                  to deliver to <strong>Liaison</strong> as JSON formatted text
                </ListItem>
                <ListItem sx={{ display: 'list-item' }}>
                  <strong>Secret: </strong> a high entropy value shared with{' '}
                  <strong>Liaison</strong> used to validate webhook deliveries; copy the value from
                  the field above
                </ListItem>
              </List>
              More information on configuring and using GitHub webhooks can be found on their
              website at{' '}
              <Link target={'_blank'} href="https://docs.github.com/en/webhooks/about-webhooks">
                https://docs.github.com/en/webhooks/about-webhooks
              </Link>
              .
              <Box sx={{ m: 5 }}>
                <Stack>
                  <Typography variant={'caption'}>Screenshot: </Typography>
                  <Box sx={{ border: 1, p: 2 }}>
                    <img src={githubImage} width="768" height="794" />
                  </Box>
                </Stack>
              </Box>
            </Typography>
          </Stack>
        </Box>
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={2}>
        <Box component="form" noValidate autoComplete="off">
          <Stack spacing={4}>
            <Box>
              <TextField
                label="Confluence Name"
                id="confluence-name"
                value={confluenceName}
                disabled
                sx={{ width: '50ch' }}
              />
              <IconButton onClick={() => navigator.clipboard.writeText(confluenceName)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>{' '}
            <Box>
              <TextField
                label="Confluence URL"
                id="confluence-url"
                value={confluenceURI}
                disabled
                sx={{ width: '50ch' }}
              />
              <IconButton onClick={() => navigator.clipboard.writeText(confluenceURI)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>{' '}
            <Box>
              <TextField
                label="Confluence Secret"
                id="confluence-secret"
                value={confluenceSecret}
                onChange={(e) => setConfluenceSecret(e.target.value)}
                sx={{ width: '50ch' }}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => setConfluenceSecret(uuidv4())}>
                      <RefreshIcon />
                    </IconButton>
                  ),
                }}
              />
              <IconButton onClick={() => navigator.clipboard.writeText(confluenceSecret)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>{' '}
            <Box>
              <TextField
                label="Confluence Events"
                id="confluence-events"
                value={confluenceEvents}
                disabled
                sx={{ width: '50ch' }}
              />
              <IconButton onClick={() => navigator.clipboard.writeText(confluenceEvents)}>
                <ContentCopyIcon />
              </IconButton>
            </Box>
            <Typography>
              In your Confluence website, the administrator needs Confluence Administrator or System
              Administrator permissions to create the webhook using the values indicated above.
              <List sx={{ listStyleType: 'disc', pl: 2, lineHeight: '80%' }}>
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
              More information on configuring and using Confluence webhooks can be found on their
              website at{' '}
              <Link
                target={'_blank'}
                href="https://confluence.atlassian.com/doc/managing-webhooks-1021225606.html"
              >
                https://confluence.atlassian.com/doc/managing-webhooks-1021225606.html
              </Link>
              .
              <Box sx={{ m: 5 }}>
                <Stack>
                  <Typography variant={'caption'}>Screenshot: </Typography>
                  <Box sx={{ border: 1 }}>
                    <img src={confluenceImage} width="800" height="604" />
                  </Box>
                </Stack>
              </Box>
            </Typography>
          </Stack>
        </Box>
      </CustomTabPanel>
    </React.Fragment>
  );
}
