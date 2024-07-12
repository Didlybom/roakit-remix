import { Google as GoogleIcon } from '@mui/icons-material';
import { Alert, Box, Button, Divider, Stack, TextField } from '@mui/material';
import type { ActionFunctionArgs } from '@remix-run/node';
import { redirect } from '@remix-run/node';
import { Form, useActionData, useFetcher, useNavigation, useSubmit } from '@remix-run/react';
import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import type { SyntheticEvent } from 'react';
import { useEffect, useState } from 'react';
import App from '../components/App';
import Copyright from '../components/Copyright';
import { clientAuth } from '../firebase.client';
import { auth as serverAuth } from '../firebase.server';
import { queryUser } from '../firestore.server/fetchers.server';
import { ONE_DAY } from '../utils/dateUtils';
import { errMsg } from '../utils/errorUtils';
import { getLogger } from '../utils/loggerUtils.server';
import { View } from '../utils/rbac';
import { sessionCookie } from '../utils/sessionCookie.server';

export const meta = () => [{ title: 'Login | ROAKIT' }];

const VIEW = View.Login;

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const idToken = form.get('idToken')?.toString() ?? '';
  const token = await serverAuth.verifyIdToken(idToken);
  if (!token.email) {
    throw Error('Token missing email');
  }
  const customerId = (await queryUser(token.email)).customerId;
  if (!form.get('isTokenRefreshed')) {
    // check if we need to add the customerId claim to the token (used by Firebase rules)
    if (!token.customerId || token.customerId != customerId) {
      await serverAuth.setCustomUserClaims(token.uid, { customerId: `${customerId}` });
      return { refreshToken: true }; // hand over to client to refresh the Firebase token
    }
  }

  getLogger('route:login').info(`${token.email} logged in`);

  const jwt = await serverAuth.createSessionCookie(idToken, {
    // 1 day - can be up to 2 weeks, see matching cookie expiration below
    expiresIn: ONE_DAY,
  });
  const now = new Date();
  const expires = new Date(now.setDate(now.getDate() + 1)); // 1 day, matching JWT expiration above

  const { searchParams } = new URL(request.url);
  const redirectUrl = searchParams.get('redirect');
  throw redirect(redirectUrl || '/', {
    headers: {
      'Set-Cookie': await sessionCookie.serialize(
        { jwt, expires: expires.getTime() /* allow the server to read the expires value */ },
        {
          expires, // browser deletes the cookie when it expires
        }
      ),
    },
  });
};

export default function Login() {
  const submit = useSubmit();
  const fetcher = useFetcher();
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
      // await clientAuth.currentUser?.reload();
    }
    if (actionData?.refreshToken) {
      // refresh the Firebase token (client-side call)
      void refreshToken();
      // and then the effect using refreshedToken will be triggered to go back to the server
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
      const credential = await signInWithPopup(
        clientAuth,
        googleAuthProvider,
        browserPopupRedirectResolver
      );
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
      fetcher.submit({ idToken }, { method: 'post' }); // hand over to server action
    } catch (e) {
      // https://firebase.google.com/docs/reference/js/auth#autherrorcodes
      setLoginError(errMsg(e, 'Error signing in'));
    }
  }

  return (
    <Stack display="flex" minHeight="100vh">
      <App view={VIEW} isLoggedIn={false} showProgress={navigation.state !== 'idle'}>
        <Box display="flex" justifyContent="center" mt={10}>
          <Stack spacing={2} width={300} mb={5}>
            <Form method="post" onSubmit={handleLogin}>
              <Stack spacing={2}>
                <TextField id="email" label="Email" type="email" autoComplete="on" fullWidth />
                <TextField
                  id="password"
                  label="Password"
                  type="password"
                  autoComplete="off"
                  fullWidth
                  error={!!loginError}
                  helperText={loginError}
                  onChange={() => setLoginError('')}
                />
                <Button variant="contained" type="submit">
                  Login
                </Button>
              </Stack>
            </Form>
            <Divider sx={{ py: 3 }}>or</Divider>
            <Box position="relative">
              <Button
                variant="outlined"
                startIcon={<GoogleIcon />}
                sx={{ width: '100%' }}
                onClick={handleSignInWithGoogle}
                disabled={navigation.state !== 'idle'}
              >
                Sign in with Google
              </Button>
            </Box>
            {!!googleError && <Alert severity="error">{googleError}</Alert>}
          </Stack>
        </Box>
      </App>
      <Box flexGrow={1} />
      <Copyright />
    </Stack>
  );
}
