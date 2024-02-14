import { redirect } from '@remix-run/node';
import { useSubmit } from '@remix-run/react';
import { signOut } from 'firebase/auth';
import { useEffect } from 'react';
import { sessionCookie } from '~/cookies.server';
import { auth } from '~/firebase.client';

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
      await signOut(auth);
    }
    void signOutFromGoogle();
    submit({}, { method: 'post' }); // handle to server to redirect and clear cookie
  }, [submit]);
}
