import * as React from 'react';
import { QuerySnapshot, collection, getDocs } from 'firebase/firestore';
import type { LoaderFunctionArgs, MetaFunction } from '@remix-run/node';
import { useLoaderData } from '@remix-run/react';
import { Box, Button, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import LoginIcon from '@mui/icons-material/Login';
import LogoutIcon from '@mui/icons-material/Logout';
import { sessionCookie } from '~/cookies.server';
import { auth as serverAuth, firestore as firestoreServer } from '~/firebase.server';
import { firestore as firestoreClient } from '~/firebase.client';

// https://remix.run/docs/en/main/route/meta
export const meta: MetaFunction = () => [
  { title: 'ROAKIT' },
  { name: 'description', content: 'ROAKIT Prototype' },
];

const stringifyDocuments = (snapshot: QuerySnapshot | FirebaseFirestore.QuerySnapshot) => {
  let response = '';
  snapshot.forEach((doc) => {
    response += `${doc.id} => ${JSON.stringify(doc.data())}`;
  });
  return response;
};

type ServerData = {
  isLoggedIn: boolean;
  firestoreData?: string;
};

// verify jwt and fetch Firestore
export const loader = async ({ request }: LoaderFunctionArgs): Promise<ServerData> => {
  const jwt = await sessionCookie.parse(request.headers.get('Cookie'));
  if (!jwt) {
    return { isLoggedIn: false };
  }
  try {
    await serverAuth.verifySessionCookie(jwt);
    const firestoreData = stringifyDocuments(await firestoreServer.collection('olebra_dev1').get());
    return { isLoggedIn: true, firestoreData };
  } catch (e) {
    return { isLoggedIn: false };
  }
};

// https://remix.run/docs/en/main/file-conventions/routes#basic-routes
export default function Index() {
  const serverData = useLoaderData<typeof loader>();
  const [fireStoreData, setFirestoreData] = React.useState('');

  React.useEffect(() => {
    const fetchFirestore = async () => {
      let response = stringifyDocuments(await getDocs(collection(firestoreClient, 'olebra_dev1')));
      setFirestoreData(response);
    };
    fetchFirestore();
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
        <Stack sx={{ mt: 10, mb: 10 }}>
          <Typography variant="body1" component="div">
            Firestore data fetched from client: {fireStoreData}
          </Typography>
          <Typography variant="body1" component="div">
            Firestore data fetched from server: {serverData.firestoreData}
          </Typography>
        </Stack>
      )}
      <Typography variant="h6" component="div" sx={{ mt: 10, mb: 10 }}>
        Under construction...
      </Typography>
    </React.Fragment>
  );
}
