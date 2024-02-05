/**
 * See https://github.com/penx/remix-google-cloud-functions
 * See https://firebase.google.com/docs/functions
 */

import { onRequest } from 'firebase-functions/v2/https';
import { createRequestHandler } from 'remix-google-cloud-functions';

const remixApp = onRequest(
  {
    memory: '512MiB',
    region: 'us-west1',
  },
  createRequestHandler({
    build: require('../build/remix.js'),
  }),
);

module.exports = { remixApp };
