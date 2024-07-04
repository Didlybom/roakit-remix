import type { App, ServiceAccount} from 'firebase-admin/app';
import { cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let app: App;
let projectId: string | undefined;

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const serviceAccount = JSON.parse(`${process.env.FIREBASE_SERVICE_ACCOUNT}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    projectId = serviceAccount.project_id as string;
    app = initializeApp({
      credential: cert(serviceAccount as ServiceAccount),
    });
  } else {
    // Firebase deploy script goes there when it checks the code, otherwise we expect to have env.FIREBASE_SERVICE_ACCOUNT set
    app = initializeApp();
  }
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);
const cloudstore = getStorage(app);

export { auth, cloudstore, firestore, projectId };
