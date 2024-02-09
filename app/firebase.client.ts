import { initializeApp } from 'firebase/app';
import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const app = initializeApp(window.ROAKIT_ENV.firebase);

const auth = getAuth(app);

// Note: we copy the JWT to our cookie for server-side Remix, so this would work with no persistence here but...
// ...for the rest such as Firestore client-side access, we use this persistence
void setPersistence(auth, browserLocalPersistence);

const firestore = getFirestore(app);

export { auth, firestore };
