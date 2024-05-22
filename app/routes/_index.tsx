import { redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { loadSession } from '../utils/authUtils.server';
import { Role } from '../utils/userUtils';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request);
  switch (sessionData.role) {
    case Role.Admin:
    case Role.Monitor:
      return redirect('/dashboard');
    case Role.Contributor:
    default:
      return redirect('/summary');
  }
};
