import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import SettingsIcon from '@mui/icons-material/Settings';
import { Alert, Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { PrefetchPageLinks, useLoaderData } from '@remix-run/react';
import { QuerySnapshot, collection, onSnapshot, query } from 'firebase/firestore';
import * as React from 'react';
import { z } from 'zod';
import { sessionCookie } from '~/cookies.server';
import { firestore as firestoreClient } from '~/firebase.client';
import { auth as serverAuth } from '~/firebase.server';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

interface ServerData {
  isLoggedIn: boolean;
}

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
    if (!doc.id.startsWith('github:') || !doc.id.includes(':push:')) {
      return [];
    }
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

// verify jwt
export const loader = async ({ request }: LoaderFunctionArgs): Promise<ServerData> => {
  const jwt = (await sessionCookie.parse(request.headers.get('Cookie'))) as string;
  if (!jwt) {
    return { isLoggedIn: false };
  }
  try {
    await serverAuth.verifySessionCookie(jwt);
    return { isLoggedIn: true };
  } catch (e) {
    return { isLoggedIn: false };
  }
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const serverData = useLoaderData<typeof loader>();
  const [githubData, setGithubData] = React.useState<GitHubRow[]>([]);
  const [gitHubError, setGitHubError] = React.useState('');

  // Firestore listener
  React.useEffect(() => {
    const q = query(collection(firestoreClient, 'events'));
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
  }, []);

  return (
    <React.Fragment>
      <PrefetchPageLinks page="/liaison" />
      <Box sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={2}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ROAKIT
          </Typography>
          <Button
            href="/liaison"
            disabled={!serverData.isLoggedIn}
            variant="contained"
            startIcon={<SettingsIcon />}
          >
            Liaison
          </Button>
          {!serverData.isLoggedIn && (
            <Button href="/login" variant="outlined" startIcon={<LoginIcon />}>
              Login
            </Button>
          )}
          {serverData.isLoggedIn && (
            <Button href="/logout" variant="outlined" startIcon={<LogoutIcon />}>
              logout
            </Button>
          )}
        </Stack>
      </Box>
      {serverData.isLoggedIn && (
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
    </React.Fragment>
  );
}
