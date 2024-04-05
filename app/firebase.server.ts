import { App, ServiceAccount, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

let app: App;

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    app = initializeApp({
      credential: cert(JSON.parse(`${process.env.FIREBASE_SERVICE_ACCOUNT}`) as ServiceAccount),
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

export { auth, cloudstore, firestore };
