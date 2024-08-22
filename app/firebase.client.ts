import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const app = firebase.initializeApp(window.ROAKIT_ENV.firebase);

const clientAuth = app.auth();
clientAuth.languageCode = 'en'; // auth.useDeviceLanguage();

// We copy the JWT to our own cookie for server-side Remix
void clientAuth.setPersistence(firebase.auth.Auth.Persistence.NONE);

export { clientAuth };
