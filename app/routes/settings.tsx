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
  Snackbar,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Unstable_Grid2';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import pino from 'pino';
import { SyntheticEvent, useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import Header from '~/components/Header';
import { loadSession } from '~/utils/authUtils.server';
import TabPanel from '../components/TabPanel';
import { sessionCookie } from '../cookies.server';
import { firestore, auth as serverAuth } from '../firebase.server';
import confluenceImage from '../images/confluence-webhook.png';
import githubImage from '../images/github-webhook.png';
import jiraImage from '../images/jira-webhook.png';
import { createClientId } from '../utils/createClientId.server';
import * as feedUtils from '../utils/feedUtils';

const logger = pino({ name: 'route:settings' });

enum FeedTab {
  Jira = 0,
  GitHub = 1,
  Confluence = 2,
}

const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

// verify JWT, load client settings
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  try {
    // retrieve feeds
    const feedsCollection = firestore.collection('customers/' + sessionData.customerId + '/feeds');
    const feedDocs = await feedsCollection.listDocuments();
    const feeds = await Promise.all(
      feedDocs.map(async feed => {
        const feedDoc = await feed.get();
        const feedData = feedSchema.parse(feedDoc.data());
        return {
          feedId: feed.id,
          type: feedData.type,
          clientId: createClientId(+sessionData.customerId!, +feed.id),
          ...(feedData.secret && { secret: feedData.secret }),
        };
      })
    );
    // create feeds not existing yet
    await Promise.all(
      feedUtils.FEED_TYPES.map(async feedType => {
        if (!feeds.find(f => f && f.feedId === feedType.id && f.type === feedType.type)) {
          const feedValues = {
            type: feedType.type,
          };
          await feedsCollection.doc(feedType.id).set(feedValues);
          feeds.push({
            ...feedValues,
            feedId: feedType.id,
            clientId: createClientId(+sessionData.customerId!, +feedType.id),
          });
        }
      })
    );
    return { customerId: +sessionData.customerId!, feeds };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return redirect('/login');
  }
  await new Promise(f => setTimeout(f, 1000));
  try {
    await serverAuth.verifySessionCookie(jwt);

    const form = await request.formData();
    const customerId = form.get('customerId')?.toString() ?? '';
    const feedId = form.get('feedId')?.toString() ?? '';
    const secret = form.get('secret')?.toString() ?? '';

    const doc = firestore.doc('customers/' + customerId + '/feeds/' + feedId);
    await doc.update({ secret });
    return null;
  } catch (e) {
    logger.error(e);
    return redirect('/logout');
  }
};

export default function Settings() {
  const serverData = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [tabValue, setTabValue] = useState(0);

  const serverJiraFeed = serverData.feeds.filter(f => f.type === feedUtils.JIRA_FEED_TYPE)[0];
  const serverGitHubFeed = serverData.feeds.filter(f => f.type === feedUtils.GITHUB_FEED_TYPE)[0];
  const serverConfluenceFeed = serverData.feeds.filter(
    f => f.type === feedUtils.CONFLUENCE_FEED_TYPE
  )[0];

  const jiraURL = `https://ingest.roakit.com/jira/${serverJiraFeed.clientId}`;
  const jiraScope = 'all issues';
  const jiraEvents = 'all events';

  const githubURL = `https://ingest.roakit.com/github/${serverGitHubFeed.clientId}`;
  const [gitHubSecret, setGitHubSecret] = useState(serverGitHubFeed.secret);

  const confluenceURL = `https://ingest.roakit.com/confluence/${serverConfluenceFeed.clientId}`;
  const [confluenceSecret, setConfluenceSecret] = useState(serverConfluenceFeed.secret);
  const confluenceEvents =
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed';

  const [showCopyConfirmation, setShowCopyConfirmation] = useState<string | null>(null);

  const handleCopy = (content?: string) => {
    if (!content) {
      return;
    }
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(content);
  };

  const actionIcon = (icon: JSX.Element, tooltip: string, action: () => void) => (
    <Tooltip title={tooltip}>
      <IconButton onClick={action}>{icon}</IconButton>
    </Tooltip>
  );

  useEffect(() => {
    if (!serverGitHubFeed.secret) {
      setGitHubSecret(uuidv4());
    }
    if (!serverConfluenceFeed.secret) {
      setConfluenceSecret(uuidv4());
    }
  }, [serverConfluenceFeed.secret, serverGitHubFeed.secret]);

  return (
    <>
      <Header isLoggedIn={true} view="settings" />
      <Form method="post" noValidate autoComplete="off">
        <Snackbar
          open={showCopyConfirmation !== null}
          autoHideDuration={3000}
          onClose={(event: SyntheticEvent | Event, reason?: string) => {
            if (reason === 'clickaway') {
              return;
            }
            setShowCopyConfirmation(null);
          }}
          message={'Copied ' + (showCopyConfirmation ?? '')}
        />
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
          <Tabs value={tabValue} onChange={(e, newValue: number) => setTabValue(newValue)}>
            <Tab label="JIRA" id={`tab-${FeedTab.Jira}`} />
            <Tab label="GitHub" id={`tab-${FeedTab.GitHub}`} />
            <Tab label="Confluence" id={`tab-${FeedTab.Confluence}`} />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={FeedTab.Jira}>
          <Box>
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
                  {actionIcon(<CopyIcon />, 'Copy scopes to clipboard', () =>
                    handleCopy(jiraScope)
                  )}
                </Grid>
              </Grid>
              <Grid container spacing={1}>
                <Grid xs={10}>
                  <TextField label="JIRA Events" value={jiraEvents} fullWidth disabled />
                </Grid>
                <Grid xs={2} sx={{ alignSelf: 'center' }}>
                  {actionIcon(<CopyIcon />, 'Copy events to clipboard', () =>
                    handleCopy(jiraEvents)
                  )}
                </Grid>
              </Grid>
            </Stack>
            <Typography component="div" sx={{ mt: 5 }}>
              In your Jira administration console, go to <strong>System WebHooks</strong> in the
              Advanced section click the <strong>Create a Webhook</strong> button.
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
          </Box>
        </TabPanel>
        <TabPanel value={tabValue} index={FeedTab.GitHub}>
          <Stack spacing={3} maxWidth={600}>
            <Grid container spacing={1}>
              <Grid xs={10}>
                <TextField
                  label="GitHub URL"
                  id="github-uri"
                  value={githubURL}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={2} sx={{ alignSelf: 'center' }}>
                {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () => handleCopy(githubURL))}
              </Grid>
            </Grid>
            {navigation.state !== 'loading' && (
              <Grid container spacing={1}>
                <Grid xs={10}>
                  {gitHubSecret === serverGitHubFeed.secret ?
                    <Tooltip title="If you've lost or forgotten the GitHub webhook secret, you can change it, but be aware that the webhook configuration on GitHub will need to be updated.">
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => setGitHubSecret(uuidv4())}
                      >
                        Change GitHub Secret
                      </Button>
                    </Tooltip>
                  : <TextField
                      label="GitHub Secret"
                      value={gitHubSecret}
                      onChange={e => setGitHubSecret(e.target.value)}
                      disabled={navigation.state === 'submitting'}
                      fullWidth
                      InputProps={{
                        ...(navigation.state !== 'submitting' && {
                          endAdornment: (
                            <Tooltip title="Regenerate a secret">
                              <IconButton onClick={() => setGitHubSecret(uuidv4())}>
                                <RefreshIcon />
                              </IconButton>
                            </Tooltip>
                          ),
                        }),
                      }}
                    />
                  }
                </Grid>
                <Grid xs={2} sx={{ alignSelf: 'center' }}>
                  <Stack direction={'row'}>
                    {gitHubSecret !== serverGitHubFeed.secret &&
                      actionIcon(<CopyIcon />, 'Copy secret to clipboard', () =>
                        handleCopy(gitHubSecret)
                      )}
                    {navigation.state !== 'submitting' &&
                      gitHubSecret?.trim() &&
                      gitHubSecret !== serverGitHubFeed.secret &&
                      actionIcon(
                        <DoneIcon />,
                        'Save the secret (make sure to copy it first, as it will be hidden once saved)',
                        () =>
                          submit(
                            {
                              customerId: serverData.customerId,
                              feedId: serverGitHubFeed.feedId,
                              type: feedUtils.GITHUB_FEED_TYPE,
                              secret: gitHubSecret,
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
                {gitHubSecret !== serverGitHubFeed.secret && (
                  <Typography variant="caption" sx={{ m: 1 }}>
                    <strong>Copy</strong> this secret (to paste it on the GitHub Webhook
                    configuration page) and <strong>save</strong> it by using the buttons on the
                    right. For security reasons, it will be hidden once saved.
                  </Typography>
                )}
              </Grid>
            )}
          </Stack>
          <Typography component="div" sx={{ mt: 5 }}>
            In your GitHub website, navigate to the <strong>Settings {'>'} Webhooks</strong> page
            for your organization (you must be an organization owner). You will need to create a new
            webhook for <strong>Roakit</strong> by clicking the <strong>Add webhook</strong> button
            in the upper right corner.
            <List sx={{ listStyleType: 'disc', pl: 2 }}>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Payload URL: </strong> copy the value from the field above
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Content type :</strong> set this option to <code>application/json</code> to
                deliver to <strong>Roakit</strong> as JSON formatted text
              </ListItem>
              <ListItem sx={{ display: 'list-item' }}>
                <strong>Secret: </strong> a high entropy value shared with <strong>Roakit</strong>{' '}
                used to validate webhook deliveries; copy the value from the field above (don&apos;t
                forget to save it with <DoneIcon sx={{ verticalAlign: 'middle' }} />)
              </ListItem>
            </List>
            More information on configuring and using GitHub webhooks can be found on their{' '}
            <Link
              target={'_blank'}
              href="https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks#creating-an-organization-webhook"
            >
              website
            </Link>
            .
            <Stack sx={{ mt: 4 }}>
              <Typography variant={'caption'}>Screenshot: </Typography>
              <img src={githubImage} width="768" height="794" style={{ borderStyle: 'dotted' }} />
            </Stack>
          </Typography>
        </TabPanel>
        <TabPanel value={tabValue} index={FeedTab.Confluence}>
          <Box>
            <Stack spacing={3} maxWidth={600}>
              <Grid container spacing={1}>
                <Grid xs={10}>
                  <TextField label="Confluence URL" value={confluenceURL} fullWidth disabled />
                </Grid>
                <Grid xs={2} sx={{ alignSelf: 'center' }}>
                  {actionIcon(<CopyIcon />, 'Copy URL to clipboard', () =>
                    handleCopy(confluenceURL)
                  )}
                </Grid>
              </Grid>
              {navigation.state !== 'loading' && (
                <Grid container spacing={1}>
                  <Grid xs={10}>
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
                  <Grid xs={2} sx={{ alignSelf: 'center' }}>
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
                                customerId: serverData.customerId,
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
                      configuration page) and <strong>save</strong> it by using the buttons on the
                      right. For security reasons, it will be hidden once saved.
                    </Typography>
                  )}
                </Grid>
              )}
              <Grid container spacing={1}>
                <Grid xs={10}>
                  <TextField
                    label="Confluence Events"
                    value={confluenceEvents}
                    fullWidth
                    disabled
                  />
                </Grid>
                <Grid xs={2} sx={{ alignSelf: 'center' }}>
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
                  Enter the <strong>secret</strong> for the <strong>Roakit</strong> service
                  (don&apos;t forget to save it on this page with{' '}
                  <DoneIcon sx={{ verticalAlign: 'middle' }} />)
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
        </TabPanel>
      </Form>
    </>
  );
}
