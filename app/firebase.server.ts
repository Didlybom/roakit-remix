import { App, initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

if (getApps().length === 0) {
  app = initializeApp({
    // credential: cert(JSON.parse(`${process.env.FIREBASE_SERVICE_ACCOUNT}`)),
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    credential: cert(require('../firebase-service-account.json')),
  });
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore();

export { auth, firestore };
