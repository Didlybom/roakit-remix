import { initializeApp } from 'firebase/app';
import { getAuth, inMemoryPersistence, setPersistence } from 'firebase/auth';

const app = initializeApp({
    apiKey: 'AIzaSyBTXYXdUDVIO62ZNM4TYxzDBBjq-9tXiUg',
    authDomain: 'eternal-impulse-412418.firebaseapp.com',
    projectId: 'eternal-impulse-412418',
    storageBucket: 'eternal-impulse-412418.appspot.com',
    messagingSenderId: '957020408701',
    appId: '1:957020408701:web:7fefaf10eddcb0bf509a14'
});

const auth = getAuth(app);

// let Remix handle the persistence via session cookies
setPersistence(auth, inMemoryPersistence);

export { auth };