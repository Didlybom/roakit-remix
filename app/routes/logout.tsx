import { Box, Typography } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';
import { redirect } from '@remix-run/node';
import { useSubmit } from '@remix-run/react';
import { useEffect } from 'react';
import App from '~/components/App';
import { sessionCookie } from '../cookies.server';
import { auth } from '../firebase.client';

export const action = async () => {
  return redirect('/', {
    headers: {
      'Set-Cookie': await sessionCookie.serialize('', {
        expires: new Date(0),
      }),
    },
  });
};

export default function Logout() {
  const submit = useSubmit();

  useEffect(() => {
    async function signOutFromGoogle() {
      await auth.signOut();
    }
    void signOutFromGoogle();
    submit({}, { method: 'post' }); // handle to server to redirect and clear cookie
  }, [submit]);

  return (
    <App view="login" isLoggedIn={false}>
      <Box sx={{ display: 'flex', justifyContent: 'center', m: 10, position: 'relative' }}>
        <Typography>Logging out...</Typography>
        <CircularProgress
          size={60}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginTop: '-30px',
            marginLeft: '-30px',
          }}
        />
      </Box>
    </App>
  );
}
