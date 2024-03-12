import { redirect } from '@remix-run/node';

export const loader = () => redirect('/dashboard');
// export const loader = () => redirect('/github');
