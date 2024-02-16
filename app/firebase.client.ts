import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
// import { browserLocalPersistence, getAuth, setPersistence } from 'firebase/compat/auth';
// import { getFirestore } from 'firebase/firestore';

const app = firebase.initializeApp(window.ROAKIT_ENV.firebase);

const auth = app.auth();
auth.languageCode = 'en'; // auth.useDeviceLanguage();

// Note: we copy the JWT to our cookie for server-side Remix, so this would work with no persistence here but...
// ...for the rest such as Firestore client-side access, we use this persistence
void auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);

const firestore = firebase.firestore(app);

export { auth, firestore };
