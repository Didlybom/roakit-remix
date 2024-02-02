import { initializeApp } from 'firebase/app';
import { getAuth, browserLocalPersistence, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp({
    apiKey: 'AIzaSyBTXYXdUDVIO62ZNM4TYxzDBBjq-9tXiUg',
    authDomain: 'eternal-impulse-412418.firebaseapp.com',
    projectId: 'eternal-impulse-412418',
    storageBucket: 'eternal-impulse-412418.appspot.com',
    messagingSenderId: '957020408701',
    appId: '1:957020408701:web:7fefaf10eddcb0bf509a14'
});

const auth = getAuth(app);

// Note: we copy the JWT to our cookie for server-side Remix, so this would work with no persistence here but...
// ...for the rest such as Firestore client-side access, we use this persistence
 setPersistence(auth, browserLocalPersistence);

const firestore = getFirestore(app);

export { auth, firestore };