import type { LoaderFunctionArgs } from '@remix-run/server-runtime';
import { json } from '@remix-run/server-runtime';
import { firestore } from '../firebase.server';
import { loadSession } from '../utils/authUtils.server';
import { View } from '../utils/rbac';

const VIEW = View.Developer;

// developer utility
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const sessionData = await loadSession(request, VIEW);

  // await firestore.recursiveDelete(
  //   firestore.collection(`customers/${sessionData.customerId!}/feeds/1/events/`)
  // );

  const docs = await firestore
    .collection(`customers/${sessionData.customerId!}/activities/`)
    .where('actorAccountId', '==', '5e258d63a7b9540e76f44ac0')
    .where('eventType', '==', 'confluence')
    .where('event', '==', 'unknown')
    .get();
  const batch = firestore.batch();
  const result: unknown[] = [];
  docs.forEach(doc => {
    // batch.delete(doc.ref);
    // batch.set(doc.ref, { event: 'comment' }, { merge: true });
    result.push(doc.data());
  });
  await batch.commit();

  return json(result);
};
