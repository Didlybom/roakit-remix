import {
  Alert,
  Box,
  GlobalStyles,
  IconButton,
  Paper,
  Snackbar,
  SxProps,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { Form, useActionData, useLoaderData } from '@remix-run/react';
import pino from 'pino';
import { useEffect, useState } from 'react';
import App from '../../components/App';
import BoxPopover, { type BoxPopoverContent } from '../../components/BoxPopover';
import TabPanel from '../../components/TabPanel';
import { firestore } from '../../firebase.server';
import { fetchInitiatives } from '../../firestore.server/fetchers.server';
import { bannedRecordSchema, feedSchema } from '../../types/schemas';
import { FEED_TYPES } from '../../types/types';
import { loadSession } from '../../utils/authUtils.server';
import { createClientId } from '../../utils/createClientId.server';
import { View } from '../../utils/rbac';
import ConfluenceSettings from './ConfluenceSettings';
import GitHubSettings from './GitHubSettings';
import JiraSettings from './JiraSettings';

const logger = pino({ name: 'route:settings' });

export const meta = () => [{ title: 'Settings | ROAKIT' }];

const VIEW = View.Settings;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);
  try {
    // retrieve feeds
    const feedsCollection = firestore.collection('customers/' + sessionData.customerId + '/feeds');
    const feedDocs = await firestore
      .collection('customers/' + sessionData.customerId + '/feeds')
      .listDocuments();
    const feeds = await Promise.all(
      feedDocs.map(async feed => {
        const feedDoc = await feed.get();
        const feedData = feedSchema.parse(feedDoc.data());
        return {
          feedId: feed.id,
          type: feedData.type,
          clientId: createClientId(+sessionData.customerId!, +feed.id),
          ...(feedData.secret && { secret: feedData.secret }),
          ...(feedData.bannedEvents && { bannedEvents: feedData.bannedEvents }),
          ...(feedData.bannedAccounts && { bannedAccounts: feedData.bannedAccounts }),
        };
      })
    );
    // create feeds not existing yet
    await Promise.all(
      FEED_TYPES.map(async feedType => {
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

    // retrieve initiatives
    const initiatives = await fetchInitiatives(sessionData.customerId!);

    return { ...sessionData, feeds, initiatives };
  } catch (e) {
    logger.error(e);
    throw e;
  }
};

interface JsonRequest {
  feedId?: number;
  secret?: string;
  bannedEvents?: string;
  bannedAccounts?: string;
}

export const action = async ({ request }: ActionFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);

  try {
    const customerId = sessionData.customerId;

    const jsonRequest = (await request.json()) as JsonRequest;

    const feedId = jsonRequest.feedId;
    if (feedId) {
      const secret = jsonRequest.secret;
      if (secret) {
        const doc = firestore.doc(`customers/${customerId!}/feeds/${feedId}`);
        await doc.update({ secret });
      }
      const bannedEvents = jsonRequest.bannedEvents;
      if (bannedEvents) {
        const doc = firestore.doc(`customers/${customerId!}/feeds/${feedId}`);
        await doc.update({
          bannedEvents: bannedRecordSchema.parse(JSON.parse(bannedEvents)),
        });
      }
      const bannedAccounts = jsonRequest.bannedAccounts;
      if (bannedAccounts) {
        const doc = firestore.doc(`customers/${customerId!}/feeds/${feedId}`);
        await doc.update({
          bannedAccounts: bannedRecordSchema.parse(JSON.parse(bannedAccounts)),
        });
      }
    }

    return null;
  } catch (e) {
    logger.error(e);
    return { error: 'Failed to save' };
  }
};

export const actionIcon = (icon: JSX.Element, tooltip: string, action: () => void) => (
  <Tooltip title={tooltip}>
    <IconButton onClick={action}>{icon}</IconButton>
  </Tooltip>
);

export const screenshotThumbSx: SxProps = {
  position: 'relative',
  zIndex: 2,
  float: 'right',
  margin: '40px 0 10px 10px',
  borderStyle: 'dotted',
  cursor: 'pointer',
};

const globalStyles = (
  <GlobalStyles
    styles={{
      code: {
        fontFamily: 'Roboto Mono, monospace',
        fontSize: '.8rem',
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        backgroundColor: grey[200],
        border: '1px solid',
        borderColor: grey[400],
        borderRadius: '5px',
        padding: '1px 4px',
      },
    }}
  />
);

enum FeedTab {
  Jira,
  GitHub,
  Confluence,
}

export default function Settings() {
  const loaderData = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const [tabValue, setTabValue] = useState(0);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState<string | null>(null);
  const [showError, setShowError] = useState<string | null>(actionData?.error ?? null);
  const [popover, setPopover] = useState<BoxPopoverContent | null>(null);

  const handleCopy = (content?: string) => {
    if (!content) {
      return;
    }
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(content);
  };

  useEffect(() => setShowError(actionData?.error ?? null), [actionData]);

  return (
    <App view={VIEW} role={loaderData.role} isNavOpen={loaderData.isNavOpen} isLoggedIn={true}>
      {globalStyles}
      <BoxPopover popover={popover} onClose={() => setPopover(null)} />
      <Paper variant="outlined" sx={{ backgroundColor: grey[50], m: 2 }}>
        <Typography variant="h6" pl={2} pt={2} pb={1}>
          Webhook Settings
        </Typography>
        <Form method="post" noValidate autoComplete="off">
          <Snackbar
            open={showCopyConfirmation !== null}
            autoHideDuration={3000}
            onClose={(_, reason) => (reason === 'clickaway' ? null : setShowCopyConfirmation(null))}
            message={'Copied ' + (showCopyConfirmation ?? '')}
          />
          <Snackbar
            open={showError !== null}
            autoHideDuration={3000}
            onClose={(_, reason) => (reason === 'clickaway' ? null : setShowError(null))}
          >
            <Alert severity="error" variant="filled" sx={{ width: '100%' }}>
              {'Error: ' + (showError ?? '')}
            </Alert>
          </Snackbar>
          <Box borderBottom={1} borderColor="divider" mb={1}>
            <Tabs
              variant="scrollable"
              value={tabValue}
              onChange={(_, newValue: number) => setTabValue(newValue)}
            >
              <Tab label="JIRA" id={`tab-${FeedTab.Jira}`} />
              <Tab label="GitHub" id={`tab-${FeedTab.GitHub}`} />
              <Tab label="Confluence" id={`tab-${FeedTab.Confluence}`} />
            </Tabs>
          </Box>
          <TabPanel value={tabValue} index={FeedTab.Jira}>
            <JiraSettings
              settingsData={loaderData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={FeedTab.GitHub}>
            <GitHubSettings
              settingsData={loaderData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={FeedTab.Confluence}>
            <ConfluenceSettings
              settingsData={loaderData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
        </Form>
      </Paper>
    </App>
  );
}
