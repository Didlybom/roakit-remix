import { Box, Button, Link, Stack, TextField } from '@mui/material';
import Typography from '@mui/material/Typography';
import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Link as RemixLink, useFetcher } from '@remix-run/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import * as React from 'react';
import { sessionCookie } from '~/cookies.server';
import { auth as clientAuth } from '~/firebase.client';
import { auth as serverAuth } from '~/firebase.server';

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const idToken = form.get('idToken')?.toString() ?? '';

  await serverAuth.verifyIdToken(idToken);

  const jwt = await serverAuth.createSessionCookie(idToken, {
    // 1 day - can be up to 2 weeks
    expiresIn: 60 * 60 * 24 * 1 * 1000,
  });

  const now = new Date();
  return redirect('/', {
    headers: {
      'Set-Cookie': await sessionCookie.serialize(jwt, {
        expires: new Date(now.setDate(now.getDate() + 1)), // 1 day, matching JWT expiration above
      }),
    },
  });
};

export default function Login() {
  const fetcher = useFetcher();
  const [errorMessage, setErrorMessage] = React.useState('');

  async function handleSubmit(e: React.SyntheticEvent): Promise<void> {
    e.preventDefault();
    const target = e.target as typeof e.target & {
      email: { value: string };
      password: { value: string };
    };

    const email = target.email.value;
    const password = target.password.value;

    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await credential.user.getIdToken();

      // trigger a POST request which the action will handle
      fetcher.submit({ idToken }, { method: 'post', action: '/login' });
    } catch (e: any) {
      // https://firebase.google.com/docs/reference/js/auth#autherrorcodes
      setErrorMessage(e.message ?? 'Error signing in');
    }
  }

  return (
    <React.Fragment>
      <Typography variant="h6" component="div" sx={{ mb: 6 }}>
        <Link underline="none" to="/" component={RemixLink}>
          ROAKIT
        </Link>{' '}
        Login
      </Typography>
      <Box component="form" autoComplete="on" onSubmit={handleSubmit}>
        <Stack spacing={4}>
          <TextField label="Email" id="email" type="email" sx={{ width: '50ch' }} />
          <TextField
            label="Password"
            id="password"
            type="password"
            sx={{ width: '50ch' }}
            error={!!errorMessage}
            helperText={errorMessage}
            onChange={() => setErrorMessage('')}
          />
          <Button variant="contained" type="submit" sx={{ width: '30ch' }}>
            Login
          </Button>
          <Typography variant="caption">
            Use u@d.com / testing (defined in Firebase here:{' '}
            <Link href="https://console.firebase.google.com/project/eternal-impulse-412418/authentication/users">
              https://console.firebase.google.com/project/eternal-impulse-412418/authentication/users
            </Link>
            )
          </Typography>
        </Stack>
      </Box>
    </React.Fragment>
  );
}
