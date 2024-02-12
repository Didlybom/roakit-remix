/**
 * See https://github.com/penx/remix-google-cloud-functions
 * See https://firebase.google.com/docs/functions
 */

import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createRequestHandler } from 'remix-google-cloud-functions';

const firebaseServiceAccount = defineSecret('FIREBASE_SERVICE_ACCOUNT');
const clientIdKey = defineSecret('CLIENT_ID_KEY');

const remixApp = onRequest(
  {
    memory: '512MiB',
    region: 'us-west1',
    secrets: [firebaseServiceAccount, clientIdKey],
  },
  createRequestHandler({
    build: require('../build/remix.js'),
  })
);

module.exports = { remixApp };
