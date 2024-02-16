import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

if (getApps().length === 0) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    app = initializeApp({
      credential: cert(JSON.parse(`${process.env.FIREBASE_SERVICE_ACCOUNT}`) as string),
    });
  } else {
    // Firebase deploy script goes there when it checks the code, otherwiswe we expect to have env.FIREBASE_SERVICE_ACCOUNT set
    app = initializeApp();
  }
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);

export { auth, firestore };
