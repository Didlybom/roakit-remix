import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { redirect } from '@remix-run/node';
import { useSubmit } from '@remix-run/react';
import { useEffect } from 'react';
import App from '../components/App';
import { clientAuth } from '../firebase.client';
import { postJsonOptions } from '../utils/httpUtils';
import { View } from '../utils/rbac';
import { sessionCookie } from '../utils/sessionCookie.server';

export const meta = () => [{ title: 'Logout | ROAKIT' }];

const VIEW = View.Logout;

export const action = async () =>
  redirect('/login', {
    headers: { 'Set-Cookie': await sessionCookie.serialize('', { expires: new Date(0) }) },
  });

export default function Logout() {
  const submit = useSubmit();

  useEffect(() => {
    async function signOutFromGoogle() {
      await clientAuth.signOut();
    }
    void signOutFromGoogle();
    submit({}, postJsonOptions); // handle to server to redirect and clear cookie
  }, [submit]);

  return (
    <App view={VIEW} isLoggedIn={false}>
      <Box display="flex" justifyContent="center" m={10} position="relative">
        <Typography>Logging out⋯</Typography>
        <CircularProgress
          size={60}
          sx={{ position: 'absolute', top: '50%', left: '50%', mt: '-30px', ml: '-30px' }}
        />
      </Box>
    </App>
  );
}
