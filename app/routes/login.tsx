import GoogleIcon from '@mui/icons-material/Google';
import { Alert, Box, Button, Stack, TextField, Typography } from '@mui/material';
import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useActionData, useNavigation, useSubmit } from '@remix-run/react';
import { GoogleAuthProvider, signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { SyntheticEvent, useEffect, useState } from 'react';
import App from '~/components/App';
import { sessionCookie } from '../cookies.server';
import { auth as clientAuth } from '../firebase.client';
import { queryCustomerId, auth as serverAuth } from '../firebase.server';
import { errMsg } from '../utils/errorUtils';

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const idToken = form.get('idToken')?.toString() ?? '';
  const token = await serverAuth.verifyIdToken(idToken);
  if (!token.email) {
    throw Error('Token missing email');
  }
  const customerId = await queryCustomerId(token.email);
  if (!form.get('isTokenRefreshed')) {
    // check if we need to add the customerId claim to the token (used by Firebase rules)
    if (!token.customerId || token.customerId != customerId) {
      await serverAuth.setCustomUserClaims(token.uid, { customerId: `${customerId}` });
      return { refreshToken: true }; // hand over to client to refresh the Firebase token
    }
  }
  const jwt = await serverAuth.createSessionCookie(idToken, {
    // 1 day - can be up to 2 weeks, see matching cookie expiration below
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
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();

  const [loginError, setLoginError] = useState('');
  const [googleError, setGoogleError] = useState('');

  const [refreshedToken, setRefreshedToken] = useState<string | undefined>();

  // useEffect(() => {
  //   async function getAuthRedirect() {
  //     try {
  //       setIsProcessingGoogle(true);
  //       const redirectResult = await getRedirectResult(clientAuth);
  //       if (!redirectResult) {
  //         setIsProcessingGoogle(false);
  //         return;
  //       }
  //       const idToken = await redirectResult?.user.getIdToken();
  //       setIsProcessingGoogle(false);
  //       if (!idToken) {
  //         throw Error('Token not found');
  //       }
  //       submit({ idToken }, { method: 'post' });
  //     } catch (e) {
  //       setIsProcessingGoogle(false);
  //       setGoogleError(errMsg(e, 'Login failed'));
  //     }
  //   }
  //   void getAuthRedirect();
  // }, [submit]);

  useEffect(() => {
    async function refreshToken() {
      setRefreshedToken(await clientAuth.currentUser?.getIdToken(true /* forceRefresh */));
    }
    if (actionData?.refreshToken) {
      // refresh the Firebase token (client-side call)
      void refreshToken();
      // and then the effect using refreshedToekn will be triggered to go back to the server
    }
  }, [actionData?.refreshToken]);

  useEffect(() => {
    if (refreshedToken) {
      submit({ isTokenRefreshed: true, idToken: refreshedToken }, { method: 'post' }); // hand over to server action
    }
  }, [refreshedToken, submit]);

  async function handleSignInWithGoogle(e: SyntheticEvent) {
    e.preventDefault();
    setLoginError('');
    setGoogleError('');

    try {
      const googleAuthProvider = new GoogleAuthProvider();
      // await signInWithRedirect(clientAuth, googleAuthProvider);
      const credential = await signInWithPopup(clientAuth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();
      submit({ idToken }, { method: 'post' }); // hand over to server action
    } catch (e) {
      // https://firebase.google.com/docs/reference/js/v8/firebase.auth.Auth#signinwithpopup
      setGoogleError(errMsg(e, 'Error signing in'));
    }
  }

  async function handleLogin(e: SyntheticEvent) {
    e.preventDefault();
    setLoginError('');
    setGoogleError('');

    const target = e.target as typeof e.target & {
      email: { value: string };
      password: { value: string };
    };
    const email = target.email.value;
    const password = target.password.value;
    try {
      const credential = await signInWithEmailAndPassword(clientAuth, email, password);
      const idToken = await credential.user.getIdToken();
      submit({ idToken }, { method: 'post' }); // hand over to server action
    } catch (e) {
      // https://firebase.google.com/docs/reference/js/auth#autherrorcodes
      setLoginError(errMsg(e, 'Error signing in'));
    }
  }

  return (
    <App view="login" isLoggedIn={false} showProgress={navigation.state === 'submitting'}>
      <Box display="flex" justifyContent="center" sx={{ mt: 10 }}>
        <Stack spacing={2} sx={{ width: 300, mb: 5 }}>
          <Form method="post" onSubmit={handleLogin} autoComplete="on">
            <Stack spacing={2}>
              <TextField label="Email" id="email" type="email" fullWidth />
              <TextField
                label="Password"
                id="password"
                type="password"
                fullWidth
                error={!!loginError}
                helperText={loginError}
                onChange={() => setLoginError('')}
              />
              <Button
                disabled={navigation.state === 'submitting'}
                variant="contained"
                type="submit"
              >
                Login
              </Button>
            </Stack>
          </Form>
          <Typography textAlign="center" sx={{ p: 2 }}>
            or
          </Typography>
          <Box sx={{ position: 'relative' }}>
            <Button
              disabled={navigation.state === 'submitting'}
              variant="outlined"
              startIcon={<GoogleIcon />}
              sx={{ width: '100%' }}
              onClick={handleSignInWithGoogle}
            >
              Sign in with Google
            </Button>
          </Box>
          {googleError && <Alert severity="error">{googleError}</Alert>}
        </Stack>
      </Box>
    </App>
  );
}
