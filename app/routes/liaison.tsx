import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import HomeIcon from '@mui/icons-material/Home';

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
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, Link as RemixLink, useLoaderData, useNavigation, useSubmit } from '@remix-run/react';
import pino from 'pino';
import { ReactNode, SyntheticEvent, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { sessionCookie } from '~/cookies.server';
import { firestore, auth as serverAuth } from '~/firebase.server';
import confluenceImage from '~/images/confluence-webhook.png';
import githubImage from '~/images/github-webhook.png';
import jiraImage from '~/images/jira-webhook.png';
import { createClientId } from '~/utils/client-id.server';
import * as feedUtils from '~/utils/feed-utils';
import { SessionData, getSessionData } from '~/utils/session-cookie.server';

const logger = pino({ name: 'route:liaison' });

interface TabPanelProps {
  children?: ReactNode;
  index: number;
  value: number;
}

const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

// verify JWT, load client settings
export const loader = async ({ request }: LoaderFunctionArgs) => {
  let sessionData: SessionData;
  try {
    sessionData = await getSessionData(request);
    if (!sessionData.isLoggedIn || !sessionData.customerId) {
      return redirect('/login');
    }
  } catch (e) {
    logger.error(e);
    return redirect('/logout');
  }

  try {
    // retrieve feeds
    const feedsCollection = firestore.collection('users/' + sessionData.customerId + '/feeds');
    const feedDocs = await feedsCollection.listDocuments();
    const feeds = await Promise.all(
      feedDocs.map(async (feed) => {
        if (!sessionData.customerId) {
          return;
        }
        const feedDoc = await feed.get();
        const feedData = feedSchema.parse(feedDoc.data());
        return {
          feedId: feed.id,
          type: feedData.type,
          clientId: createClientId(+sessionData.customerId, +feed.id),
          ...(feedData.secret && { secret: feedData.secret }),
        };
      })
    );
    // create feeds not existing yet
    await Promise.all(
      feedUtils.FEED_TYPES.map(async (feedType) => {
        if (!sessionData.customerId) {
          return;
        }
        if (!feeds.find((f) => f && f.feedId === feedType.id && f.type === feedType.type)) {
          const feedValues = {
            type: feedType.type,
            ...(feedType.type !== feedUtils.JIRA_FEED_TYPE && { secret: uuidv4() }),
          };
          await feedsCollection.doc(feedType.id).set(feedValues);
          feeds.push({
            ...feedValues,
            feedId: feedType.id,
            clientId: createClientId(+sessionData.customerId, +feedType.id),
          });
        }
      })
    );
    return { customerId: +sessionData.customerId, feeds };
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

  try {
    await serverAuth.verifySessionCookie(jwt);

    const form = await request.formData();
    const customerId = form.get('customerId')?.toString() ?? '';
    const feedId = form.get('feedId')?.toString() ?? '';
    const secret = form.get('secret')?.toString() ?? '';

    const doc = firestore.doc('users/' + customerId + '/feeds/' + feedId);
    await doc.update({ secret });
    return null;
  } catch (e) {
    logger.error(e);
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
  const submit = useSubmit();
  const navigation = useNavigation();

  const [tabValue, setTabValue] = useState(0);

  const serverJiraFeed = serverData.feeds.filter((f) => f.type === feedUtils.JIRA_FEED_TYPE)[0];
  const serverGitHubFeed = serverData.feeds.filter((f) => f.type === feedUtils.GITHUB_FEED_TYPE)[0];
  const serverConfluenceFeed = serverData.feeds.filter(
    (f) => f.type === feedUtils.CONFLUENCE_FEED_TYPE
  )[0];

  const jiraName = 'Webhook for ROAKIT';
  const jiraURL = `https://liaison.roakit.com/jira/${serverJiraFeed.clientId}`;
  const jiraScope = 'all issues';
  const jiraEvents = 'all events';

  const githubURL = `https://liaison.roakit.com/github/${serverGitHubFeed.clientId}`;
  const githubSecret = navigation.formData?.get('secret')?.toString() ?? serverGitHubFeed.secret;
  const confluenceName = 'Webhook for ROAKIT';
  const confluenceURL = `https://liaison.roakit.com/confluence/${serverConfluenceFeed.clientId}`;
  const confluenceSecret =
    navigation.formData?.get('secret')?.toString() ?? serverConfluenceFeed.secret;
  const confluenceEvents =
    'attachment_created,attachment_removed,attachment_restored,attachment_trashed,attachment_updated,blog_created,blog_removed,blog_restored,blog_trashed,blog_updated,blueprint_page_created,comment_created,comment_removed,comment_updated,content_created,content_restored,content_trashed,content_updated,content_permissions_updated,group_created,group_removed,label_added,label_created,label_deleted,label_removed,page_children_reordered,page_created,page_moved,page_removed,page_restored,page_trashed,page_updated,space_created,space_logo_updated,space_permissions_updated,space_removed,space_updated,theme_enabled,user_created,user_deactivated,user_followed,user_reactivated,user_removed';

  const [showCopyConfirmation, setShowCopyConfirmation] = useState<string | null>(null);

  const handleCopyClick = (content?: string) => {
    if (!content) {
      return;
    }
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(content);
  };

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
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

      <Stack direction={'row'} sx={{ alignItems: 'center' }}>
        <Link variant="h6" underline="none" to="/" component={RemixLink}>
          <Stack direction={'row'} sx={{ alignItems: 'center' }}>
            <HomeIcon sx={{ mb: '2px', mr: '3px' }} /> ROAKIT
          </Stack>
        </Link>
        <ChevronRightIcon />
        <Typography variant="h6"> Liaison</Typography>
      </Stack>

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="Connectors">
          <Tab label="JIRA" id="tab-0" />
          <Tab label="GitHub" id="tab-1" />
          <Tab label="Confluence" id="tab-2" />
        </Tabs>
      </Box>
      <CustomTabPanel value={tabValue} index={0}>
        <Box>
          <Stack spacing={3} maxWidth={600}>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField label="JIRA Name" id="jira-name" value={jiraName} fullWidth disabled />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraName))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField label="JIRA URI" id="jira-uri" value={jiraURL} fullWidth disabled />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(jiraURL))}</Grid>
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
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={1}>
        <Stack spacing={3} maxWidth={600}>
          <Grid container spacing={1}>
            <Grid xs={11}>
              <TextField label="GitHub URL" id="github-uri" value={githubURL} fullWidth disabled />
            </Grid>
            <Grid xs={1}>{copyIcon(() => handleCopyClick(githubURL))}</Grid>
          </Grid>
          <Grid container spacing={1}>
            <Grid xs={11}>
              <TextField
                label="GitHub Secret"
                value={githubSecret}
                disabled
                fullWidth
                InputProps={{
                  endAdornment: (
                    <Tooltip title="Regenerate a secret">
                      <IconButton
                        onClick={() =>
                          submit(
                            {
                              customerId: serverData.customerId,
                              feedId: serverData.feeds.filter(
                                (f) => f.type === feedUtils.GITHUB_FEED_TYPE
                              )[0].feedId,
                              type: feedUtils.GITHUB_FEED_TYPE,
                              secret: uuidv4(),
                            },
                            { method: 'post' }
                          )
                        }
                      >
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>
                  ),
                }}
              />
            </Grid>
            <Grid xs={1}>{copyIcon(() => handleCopyClick(githubSecret))}</Grid>
          </Grid>
        </Stack>
        <Typography component="div" sx={{ mt: 5 }}>
          In your GitHub website, navigate to the <strong>Settings {'>'} Webhooks</strong> page for
          your organization (you must be an organization owner). You will need to create a new
          webhook for <strong>Liaison</strong> by clicking the <strong>Add webhook</strong> button
          in the upper right corner.
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
      </CustomTabPanel>
      <CustomTabPanel value={tabValue} index={2}>
        <Box>
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
                  value={confluenceURL}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid xs={1}>{copyIcon(() => handleCopyClick(confluenceURL))}</Grid>
            </Grid>
            <Grid container spacing={1}>
              <Grid xs={11}>
                <TextField
                  label="Confluence Secret"
                  value={confluenceSecret}
                  disabled
                  fullWidth
                  InputProps={{
                    endAdornment: (
                      <Tooltip title="Regenerate a secret">
                        <IconButton
                          onClick={() =>
                            submit(
                              {
                                customerId: serverData.customerId,
                                feedId: serverData.feeds.filter(
                                  (f) => f.type === feedUtils.CONFLUENCE_FEED_TYPE
                                )[0].feedId,
                                type: feedUtils.CONFLUENCE_FEED_TYPE,
                                secret: uuidv4(),
                              },
                              { method: 'post' }
                            )
                          }
                        >
                          <RefreshIcon />
                        </IconButton>
                      </Tooltip>
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
                Click <strong>[Save]</strong>
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
    </Form>
  );
}
