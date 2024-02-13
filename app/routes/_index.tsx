import { Alert, LinearProgress, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { QuerySnapshot, collection, onSnapshot, query, where } from 'firebase/firestore';
import pino from 'pino';
import { Fragment, useEffect, useState } from 'react';
import { z } from 'zod';
import { firestore as firestoreClient } from '~/firebase.client';
import Header from '~/src/Header';
import { SessionData, getSessionData } from '~/utils/session-cookie.server';

const logger = pino({ name: 'route:index' });

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

const githubColumns: GridColDef[] = [
  { field: 'id', headerName: 'id', width: 250 },
  {
    field: 'timestamp',
    headerName: 'Date',
    type: 'dateTime',
    valueGetter: (params) => new Date(params.value as number),
    width: 200,
  },
  { field: 'repositoryName', headerName: 'Repositoy', width: 100 },
  { field: 'author', headerName: 'Author', width: 100 },
  { field: 'commit', headerName: 'Activity', minWidth: 300, flex: 1 },
];

interface GitHubRow {
  id: string;
  timestamp: number;
  repositoryName?: string;
  author?: string;
  commit?: string;
}

const gitHubEventSchema = z.object({
  repository: z.object({ name: z.string() }).optional(),
  pusher: z.object({ name: z.string(), email: z.string() }).optional(),
  commits: z.object({ message: z.string() }).array().optional(),
});

const githubRows = (snapshot: QuerySnapshot): GitHubRow[] => {
  const data: GitHubRow[] = [];
  snapshot.forEach((doc) => {
    const docData = doc.data();
    const props = gitHubEventSchema.safeParse(docData.properties);
    if (!props.success) {
      throw Error('Failed to parse GitHub events. ' + props.error.message);
    }
    data.push({
      id: doc.id,
      timestamp: docData.eventTimestamp as number,
      repositoryName: props.data.repository?.name,
      author: props.data.pusher?.name ?? props.data.pusher?.email,
      commit: props.data.commits ? props.data.commits[0]?.message : undefined,
    });
  });
  return data;
};

// verify and get session data
export const loader = async ({ request }: LoaderFunctionArgs): Promise<SessionData> => {
  return await getSessionData(request);
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const sessionData = useLoaderData<typeof loader>();
  const [githubData, setGithubData] = useState<GitHubRow[]>([]);
  const [gitHubError, setGitHubError] = useState('');

  // Firestore listener
  useEffect(() => {
    if (!sessionData.customerId) {
      return;
    }
    const q = query(
      collection(firestoreClient, 'events'),
      where('pluginName', '==', 'github'),
      where('event', '!=', 'ping'),
      where('customerId', '==', sessionData.customerId)
    );
    const unsuscribe = onSnapshot(
      q,
      (querySnapshot) => {
        try {
          setGithubData(githubRows(querySnapshot));
          setGitHubError('');
        } catch (e: unknown) {
          setGitHubError(e instanceof Error ? e.message : 'Error parsing GitHub events');
        }
      },
      (error) => setGitHubError(error.message)
    );
    return () => {
      unsuscribe();
    };
  }, [sessionData.customerId]);

  return (
    <Fragment>
      <Header />
      {sessionData.isLoggedIn && (
        <Stack sx={{ mt: 5 }}>
          <Typography variant="h6" color="GrayText">
            GitHub Activity
          </Typography>
          {githubData.length ?
            <DataGrid
              columns={githubColumns}
              rows={githubData}
              density="compact"
              disableRowSelectionOnClick={true}
              initialState={{
                sorting: {
                  sortModel: [{ field: 'timestamp', sort: 'desc' }],
                },
              }}
            ></DataGrid>
          : <LinearProgress sx={{ mt: 5 }} />}
          {gitHubError && <Alert severity="error">{gitHubError}</Alert>}
        </Stack>
      )}
      <Typography variant="h6" sx={{ mt: 5, mb: 5 }}>
        Under construction...
      </Typography>
    </Fragment>
  );
}
