import {
  Box,
  GlobalStyles,
  IconButton,
  Paper,
  Popover,
  Snackbar,
  SxProps,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { grey } from '@mui/material/colors';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import pino from 'pino';
import { useState } from 'react';
import App from '../../components/App';
import TabPanel from '../../components/TabPanel';
import { sessionCookie } from '../../cookies.server';
import { firestore, auth as serverAuth } from '../../firebase.server';
import { feedSchema } from '../../schemas/schemas';
import { loadSession } from '../../utils/authUtils.server';
import { createClientId } from '../../utils/createClientId.server';
import * as feedUtils from '../../utils/feedUtils';
import { fetchInitiatives } from '../../utils/firestoreUtils.server';
import ConfluenceSettings from './ConfluenceSettings';
import GitHubSettings from './GitHubSettings';
import JiraSettings from './JiraSettings';

const logger = pino({ name: 'route:settings' });

enum FeedTab {
  Jira,
  GitHub,
  Confluence,
}

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

    // retrieve initiatives
    const initiatives = await fetchInitiatives(sessionData.customerId);

    return { feeds, initiatives };
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
    const token = await serverAuth.verifySessionCookie(jwt);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const customerId = token.customerId;

    const form = await request.formData();

    const feedId = form.get('feedId')?.toString() ?? '';
    if (feedId) {
      const secret = form.get('secret')?.toString() ?? '';
      const doc = firestore.doc('customers/' + customerId + '/feeds/' + feedId);
      await doc.update({ secret });
    }

    return null;
  } catch (e) {
    logger.error(e);
    return redirect('/logout');
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

export default function Settings() {
  const serverData = useLoaderData<typeof loader>();
  const [tabValue, setTabValue] = useState(0);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState<string | null>(null);
  const [popover, setPopover] = useState<{ element: HTMLElement; content: JSX.Element } | null>(
    null
  );

  const handleCopy = (content?: string) => {
    if (!content) {
      return;
    }
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(content);
  };

  return (
    <App view="settings" isLoggedIn={true}>
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
      <Popover
        id={popover?.element ? 'popover' : undefined}
        open={!!popover?.element}
        anchorEl={popover?.element}
        onClose={() => setPopover(null)}
        onClick={() => setPopover(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      >
        <Box sx={{ p: 2, overflow: 'scroll' }}>{popover?.content}</Box>
      </Popover>
      <Paper square={false} sx={{ backgroundColor: grey[50], m: 2 }}>
        <Typography variant="h6" sx={{ pl: 2, pt: 2, pb: 1 }}>
          Webhook Settings
        </Typography>
        <Form method="post" noValidate autoComplete="off">
          <Snackbar
            open={showCopyConfirmation !== null}
            autoHideDuration={3000}
            onClose={(_, reason?: string) => {
              if (reason === 'clickaway') {
                return;
              }
              setShowCopyConfirmation(null);
            }}
            message={'Copied ' + (showCopyConfirmation ?? '')}
          />
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
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
              settingsData={serverData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={FeedTab.GitHub}>
            <GitHubSettings
              settingsData={serverData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
          <TabPanel value={tabValue} index={FeedTab.Confluence}>
            <ConfluenceSettings
              settingsData={serverData}
              handleCopy={handleCopy}
              setPopover={setPopover}
            />
          </TabPanel>
        </Form>
      </Paper>
    </App>
  );
}
