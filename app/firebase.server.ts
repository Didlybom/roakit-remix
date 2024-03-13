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
    // Firebase deploy script goes there when it checks the code, otherwise we expect to have env.FIREBASE_SERVICE_ACCOUNT set
    app = initializeApp();
  }
} else {
  app = getApp();
}

const auth = getAuth(app);
const firestore = getFirestore(app);

const queryCustomerId = async (email: string) => {
  const userDocs = (await firestore.collection('users').where('email', '==', email).get()).docs;
  if (userDocs.length === 0) {
    throw Error('User not found');
  }
  if (userDocs.length > 1) {
    throw Error('More than one User found');
  }
  return userDocs[0].data().customerId as number;
};

export { auth, firestore, queryCustomerId };
