/**
 * See https://github.com/penx/remix-google-cloud-functions
 * See https://firebase.google.com/docs/functions
 */

import compression from 'compression';
import { defineSecret } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { createRequestHandler } from './remixAdapter';

const firebaseServiceAccount = defineSecret('FIREBASE_SERVICE_ACCOUNT');
const clientIdKey = defineSecret('CLIENT_ID_KEY');

const remixApp = onRequest(
  {
    memory: '1GiB',
    region: 'us-west1',
    secrets: [firebaseServiceAccount, clientIdKey],
  },
  (req, res) => {
    // gcloud doesn't compress for us
    compression()(req, res, () =>
      createRequestHandler({ build: require('../build/server/remix.js') })(req, res)
    );
  }
);

module.exports = { remixApp };
