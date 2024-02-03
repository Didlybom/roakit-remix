import * as React from 'react';
import { Link as RemixLink } from '@remix-run/react';
import type { LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Box, IconButton, Link, Stack, Tab, Tabs, TextField, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import RefreshIcon from '@mui/icons-material/Refresh';
import { v4 as uuidv4 } from 'uuid';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth } from '~/firebase.server';

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
          </Stack>
        </Box>
      </CustomTabPanel>
    </React.Fragment>
  );
}
