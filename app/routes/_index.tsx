import * as React from 'react';
import { collection, QuerySnapshot, onSnapshot, query } from 'firebase/firestore';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth } from '~/firebase.server';
import { firestore as firestoreClient } from '~/firebase.client';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

type ServerData = {
  isLoggedIn: boolean;
};

const githubColumns: GridColDef[] = [
  { field: 'id', headerName: 'id', width: 250 },
  {
    field: 'timestamp',
    headerName: 'Date',
    type: 'dateTime',
    valueGetter: (params) => new Date(params.value),
    width: 200,
  },
  { field: 'repositoryName', headerName: 'Repositoy' },
  { field: 'author', headerName: 'Author' },
  { field: 'commit', headerName: 'Activity', width: '100%' },
];

const githubRows = (snapshot: QuerySnapshot) => {
  const data = [];
  snapshot.forEach((doc) => {
    if (!doc.id.startsWith('github:') || !doc.id.includes(':push:')) {
      return [];
    }
    const docData = doc.data();
    const props = docData.properties;
    data.push({
      id: doc.id,
      timestamp: docData.eventTimestamp,
      repositoryName: props.repository?.name,
      author: props.pusher?.name || props.pusher?.email,
      commit: props.commits[0]?.message,
    });
  });
  return data;
};

// verify jwt
export const loader = async ({ request }: LoaderFunctionArgs): Promise<ServerData> => {
  const jwt = await sessionCookie.parse(request.headers.get('Cookie'));
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
  const [githubData, setGithubData] = React.useState<any[]>([]);

  // Firestore listener
  React.useEffect(() => {
    const q = query(collection(firestoreClient, 'events'));
    const unsuscribe = onSnapshot(q, (querySnapshot) => {
      setGithubData(githubRows(querySnapshot));
    });
    return () => {
      unsuscribe();
    };
  }, []);

  return (
    <React.Fragment>
      <Box sx={{ flexGrow: 1 }}>
        <Stack direction="row" spacing={2}>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            ROAKIT
          </Typography>
          <Button
            href="/settings"
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
              initialState={{
                sorting: {
                  sortModel: [{ field: 'timestamp', sort: 'desc' }],
                },
              }}
            ></DataGrid>
          : <LinearProgress sx={{ mt: 5 }} />}
        </Stack>
      )}
      <Typography variant="h6" sx={{ mt: 5, mb: 5 }}>
        Under construction...
      </Typography>
    </React.Fragment>
  );
}
