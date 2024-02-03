import { createCookie } from '@remix-run/node';

export const sessionCookie = createCookie('__session', {
  // WARNING: Firebase Hosting + Cloud Functions strip any cookie not named __session  https://stackoverflow.com/a/44935288
  secrets: ['roakit cookie secret'],
  path: '/',
});
