import { Box, IconButton, Snackbar, Tab, Tabs, Tooltip } from '@mui/material';
import type { ActionFunctionArgs, LoaderFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useLoaderData } from '@remix-run/react';
import pino from 'pino';
import { SyntheticEvent, useState } from 'react';
import { z } from 'zod';
import Header from '~/components/Header';
import { loadSession } from '~/utils/authUtils.server';
import TabPanel from '../../components/TabPanel';
import { sessionCookie } from '../../cookies.server';
import { firestore, auth as serverAuth } from '../../firebase.server';
import { createClientId } from '../../utils/createClientId.server';
import * as feedUtils from '../../utils/feedUtils';
import ConfluenceSettings from './ConfluenceSettings';
import GitHubSettings from './GitHubSettings';
import JiraSettings from './JiraSettings';

const logger = pino({ name: 'route:settings' });

enum FeedTab {
  Initiatives,
  Jira,
  GitHub,
  Confluence,
}

const feedSchema = z.object({
  type: z.string(),
  secret: z.string().optional(),
});

export interface SettingsData {
  customerId: number;
  feeds: {
    secret?: string | undefined;
    feedId: string;
    type: string;
    clientId: string;
  }[];
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

export const actionIcon = (icon: JSX.Element, tooltip: string, action: () => void) => (
  <Tooltip title={tooltip}>
    <IconButton onClick={action}>{icon}</IconButton>
  </Tooltip>
);

export default function Settings() {
  const serverData = useLoaderData<typeof loader>();
  const [tabValue, setTabValue] = useState(0);
  const [showCopyConfirmation, setShowCopyConfirmation] = useState<string | null>(null);

  const handleCopy = (content?: string) => {
    if (!content) {
      return;
    }
    void navigator.clipboard.writeText(content);
    setShowCopyConfirmation(content);
  };

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
          <Tabs
            variant="scrollable"
            value={tabValue}
            onChange={(e, newValue: number) => setTabValue(newValue)}
          >
            <Tab label="Initiatives" id={`tab-${FeedTab.Initiatives}`} />
            <Tab label="JIRA" id={`tab-${FeedTab.Jira}`} />
            <Tab label="GitHub" id={`tab-${FeedTab.GitHub}`} />
            <Tab label="Confluence" id={`tab-${FeedTab.Confluence}`} />
          </Tabs>
        </Box>
        <TabPanel value={tabValue} index={FeedTab.Initiatives}></TabPanel>
        <TabPanel value={tabValue} index={FeedTab.Jira}>
          <JiraSettings settingsData={serverData} handleCopy={handleCopy} />
        </TabPanel>
        <TabPanel value={tabValue} index={FeedTab.GitHub}>
          <GitHubSettings settingsData={serverData} handleCopy={handleCopy} />
        </TabPanel>
        <TabPanel value={tabValue} index={FeedTab.Confluence}>
          <ConfluenceSettings settingsData={serverData} handleCopy={handleCopy} />
        </TabPanel>
      </Form>
    </>
  );
}
