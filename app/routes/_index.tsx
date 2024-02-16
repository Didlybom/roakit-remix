import { Alert, Box, LinearProgress, Link, Stack, Tab, Tabs, Typography } from '@mui/material';
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/firestore';
import { Fragment, SyntheticEvent, useEffect, useState } from 'react';
import { z } from 'zod';
import { firestore as firestoreClient } from '~/firebase.client';
import Header from '~/src/Header';
import TabPanel from '~/src/TabPanel';
import { errMsg } from '~/utils/errorUtils';
import { SessionData, getSessionData } from '~/utils/sessionCookie.server';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

enum EventType {
  PullRequest = 'pull_request',
  Push = 'push',
  Release = 'release',
}

interface GitHubRow {
  id: string;
  timestamp: number;
  repositoryName?: string;
  author?: { name?: string; url?: string };
  ref?: { label?: string; url?: string };
  activity: {
    title?: string;
    created?: string;
    changedFiles?: number;
    comments?: number;
    commits?: number;
  };
}

const gitHubColumns: GridColDef[] = [
  {
    field: 'timestamp',
    headerName: 'Date',
    type: 'dateTime',
    valueGetter: (params) => new Date(params.value as number),
    width: 200,
  },
  { field: 'repositoryName', headerName: 'Repository', width: 150 },
  {
    field: 'author',
    headerName: 'Author',
    width: 150,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderCell: (params: GridRenderCellParams<any, GitHubRow['author']>) => {
      return params.value?.url ?
          <Link href={params.value.url}>{params.value.name}</Link>
        : params.value?.name;
    },
  },
  {
    field: 'ref',
    headerName: 'Reference',
    width: 300,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    renderCell: (params: GridRenderCellParams<any, GitHubRow['ref']>) => {
      return params.value?.url ?
          <Link href={params.value.url}>{params.value.label}</Link>
        : params.value?.label;
    },
  },
  {
    field: 'activity',
    headerName: 'Activity',
    minWidth: 300,
    flex: 1,
    renderCell: (params) => {
      const fields = params.value as GitHubRow['activity'];
      const title = fields.title ?? '';
      let activity = '';
      if (fields.created) {
        activity += `Created ${new Date(fields.created).toLocaleDateString('en-us', {
          month: 'short',
          day: 'numeric',
        })}, `;
      }
      if (fields.changedFiles) {
        activity += `${fields.changedFiles} changed files, `;
      }
      if (fields.comments) {
        activity += `${fields.comments} comments, `;
      }
      if (fields.commits) {
        activity += `${fields.commits} commits, `;
      }
      if (activity) {
        activity = activity.slice(0, -2);
      }
      return (
        <Stack>
          <Typography variant="body2">{title}</Typography>
          <Typography variant="caption">{activity}</Typography>
        </Stack>
      );
    },
  },
];

const gitHubPushesColumns = [...gitHubColumns];
gitHubPushesColumns.splice(3, 1); // remove Reference

const gitHubEventSchema = z.object({
  repository: z.object({ name: z.string() }).optional(),
  sender: z.object({ login: z.string(), html_url: z.string().optional() }).optional(),

  // pull_request
  pull_request: z
    .object({
      title: z.string(),
      created_at: z.string(),
      changed_files: z.number(),
      deletions: z.number(),
      comments: z.number(),
      commits: z.number(),
      head: z.object({ ref: z.string() }),
      html_url: z.string().optional(),
    })
    .optional(),

  // push
  commits: z.object({ message: z.string() }).array().optional(),

  // release
  action: z.string().optional(),
  release: z.object({ body: z.string() }).optional(),
});

const githubRows = (snapshot: firebase.firestore.QuerySnapshot): GitHubRow[] => {
  const rows: GitHubRow[] = [];
  snapshot.forEach((doc) => {
    const docData = doc.data();
    const props = gitHubEventSchema.safeParse(docData.properties);
    if (!props.success) {
      throw Error('Failed to parse GitHub events. ' + props.error.message);
    }
    const data = props.data;
    if (data.release && data.action !== 'released') {
      return;
    }
    rows.push({
      id: doc.id,
      timestamp: docData.eventTimestamp as number,
      repositoryName: data.repository?.name,
      author: { name: data.sender?.login, url: data.sender?.html_url },
      ref: { label: data.pull_request?.head.ref, url: data.pull_request?.html_url },
      activity: {
        title:
          data.pull_request?.title ??
          (data.commits ? data.commits[0]?.message : undefined) ??
          data.release?.body, // FIXME commits
        created: data.pull_request?.created_at,
        changedFiles: data.pull_request?.changed_files,
        comments: data.pull_request?.comments,
        commits: data.pull_request?.commits ?? data.commits?.length,
      },
    });
  });
  return rows;
};

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const sessionData = useLoaderData<typeof loader>();
  const [tabValue, setTabValue] = useState(0);

  const [gitHubPRs, setGithubPRs] = useState<GitHubRow[]>([]);
  const [gitHubPushes, setGithubPushes] = useState<GitHubRow[]>([]);
  const [gitHubReleases, setGithubReleases] = useState<GitHubRow[]>([]);

  const [gitHubError, setGitHubError] = useState('');

  const handleTabChange = (event: SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  // Firestore listeners
  useEffect(() => {
    const setGitHubRows = (type: EventType, querySnapshot: firebase.firestore.QuerySnapshot) => {
      try {
        switch (type) {
          case EventType.PullRequest:
            setGithubPRs(githubRows(querySnapshot));
            break;
          case EventType.Push:
            setGithubPushes(githubRows(querySnapshot));
            break;
          case EventType.Release:
            setGithubReleases(githubRows(querySnapshot));
            break;
        }
      } catch (e: unknown) {
        setGitHubError(errMsg(e, `Error parsing GitHub ${type} events`));
      }
    };
    if (!sessionData.customerId) {
      return;
    }
    const unsubscribe: Record<string, () => void> = {};
    Object.values(EventType).map((type) => {
      unsubscribe[type] = firestoreClient
        .collection(
          `customers/${sessionData.customerId}/feeds/1/events/${type}/instances` // FIXME feedId
        )
        .onSnapshot(
          (snapshot) => setGitHubRows(type, snapshot),
          (error) => setGitHubError(error.message)
        );
    });
    return () => {
      Object.keys(unsubscribe).forEach((k) => unsubscribe[k]());
    };
  }, [sessionData.customerId]);

  return (
    <Fragment>
      <Header isLoggedIn={sessionData.isLoggedIn} />
      {sessionData.isLoggedIn && (
        <Stack sx={{ mt: 5 }}>
          <Typography variant="h6" color="GrayText">
            GitHub Activity
          </Typography>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2, mb: 2 }}>
            <Tabs value={tabValue} onChange={handleTabChange} aria-label="Activities">
              <Tab label="Pull Requests" id="tab-0" />
              <Tab label="Pushes" id="tab-1" />
              <Tab label="Releases" id="tab-2" />
            </Tabs>
          </Box>
          <TabPanel value={tabValue} index={0}>
            {!!gitHubPRs.length && (
              <DataGrid
                columns={gitHubColumns}
                rows={gitHubPRs}
                rowHeight={75}
                density="compact"
                disableRowSelectionOnClick={true}
                initialState={{ sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' }] } }}
              ></DataGrid>
            )}
          </TabPanel>
          <TabPanel value={tabValue} index={1}>
            {!!gitHubPushes.length && (
              <DataGrid
                columns={gitHubPushesColumns}
                rows={gitHubPushes}
                rowHeight={75}
                density="compact"
                disableRowSelectionOnClick={true}
                initialState={{ sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' }] } }}
              ></DataGrid>
            )}
          </TabPanel>
          <TabPanel value={tabValue} index={2}>
            {!!gitHubPushes.length && (
              <DataGrid
                columns={gitHubPushesColumns}
                rows={gitHubReleases}
                rowHeight={75}
                density="compact"
                disableRowSelectionOnClick={true}
                initialState={{ sorting: { sortModel: [{ field: 'timestamp', sort: 'desc' }] } }}
              ></DataGrid>
            )}
          </TabPanel>
          {(!gitHubPRs.length || !gitHubPushes.length) && <LinearProgress sx={{ mt: 5 }} />}
          {gitHubError && <Alert severity="error">{gitHubError}</Alert>}
        </Stack>
      )}
      <Typography align="center" variant="h6" sx={{ mt: 5, mb: 5 }}>
        Under construction...
      </Typography>
    </Fragment>
  );
}
