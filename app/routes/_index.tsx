import { redirect, type LoaderFunctionArgs } from '@remix-run/node';
import { loadSession } from '../utils/authUtils.server';
import { Role, View } from '../utils/rbac';

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, View.Index);
  switch (sessionData.role) {
    case Role.Admin:
    case Role.Monitor:
      return redirect('/activity/*');
    case Role.Contributor:
    default:
      return redirect('/status');
  }
};
