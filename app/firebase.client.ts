import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';

const app = firebase.initializeApp(window.ROAKIT_ENV.firebase);

const auth = app.auth();
auth.languageCode = 'en'; // auth.useDeviceLanguage();

// We copy the JWT to our cookie for server-side Remix
void auth.setPersistence(firebase.auth.Auth.Persistence.NONE);

const firestore = firebase.firestore(app);

export { auth, firestore };
