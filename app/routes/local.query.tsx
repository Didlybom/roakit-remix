import { LoaderFunctionArgs, json, redirect } from '@remix-run/server-runtime';
import { firestore } from '../firebase.server';
import { loadSession } from '../utils/authUtils.server';

// developer utility
export const loader = async ({ request }: LoaderFunctionArgs) => {
  if (request.headers.get('host') !== 'localhost:3000') {
    return 'Invalid env';
  }

  const sessionData = await loadSession(request);
  if (sessionData.redirect) {
    return redirect(sessionData.redirect);
  }

  const docs = await firestore
    .collection(`customers/${sessionData.customerId!}/activities/`)
    .where('event', '==', 'workflow_run')
    .get();
  // const batch = firestore.batch();
  const result: unknown[] = [];
  docs.forEach(doc => {
    // batch.delete(doc.ref);
    result.push(doc.data());
  });
  // await batch.commit();

  return json(result);
};
