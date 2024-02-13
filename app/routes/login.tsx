import { Box, Button, Stack, TextField } from '@mui/material';
import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useFetcher } from '@remix-run/react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { Fragment, SyntheticEvent, useState } from 'react';
import { sessionCookie } from '~/cookies.server';
import { auth as clientAuth } from '~/firebase.client';
import { auth as serverAuth } from '~/firebase.server';
import Breadcrumbs from '~/src/Breadcrumbs';

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

  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(e: SyntheticEvent) {
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

      // trigger a POST request which the server action will handle
      fetcher.submit({ idToken }, { method: 'post', action: '/login' });
    } catch (e: unknown) {
      // https://firebase.google.com/docs/reference/js/auth#autherrorcodes
      setErrorMessage(e instanceof Error ? e.message : 'Error signing in');
    }
  }

  return (
    <Fragment>
      <Breadcrumbs title="Login" />
      <Box display="flex" justifyContent="center">
        <Form method="post" onSubmit={handleSubmit} autoComplete="on">
          <Stack spacing={4} sx={{ minWidth: 300 }}>
            <TextField label="Email" id="email" type="email" fullWidth />
            <TextField
              label="Password"
              id="password"
              type="password"
              fullWidth
              error={!!errorMessage}
              helperText={errorMessage}
              onChange={() => setErrorMessage('')}
            />
            <Button variant="contained" type="submit">
              Login
            </Button>
          </Stack>
        </Form>
      </Box>
    </Fragment>
  );
}
