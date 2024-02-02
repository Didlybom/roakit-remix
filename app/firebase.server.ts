import { App, initializeApp, getApps, cert, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let app: App;

if (getApps().length === 0) {
  app = initializeApp({
    credential: cert(require('../firebase-service-account.json')),
  });
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore();

export { auth, firestore };