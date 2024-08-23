# ROAKIT Remix webapp

A fullstack web app, initially based on
https://github.com/mui/material-ui/tree/master/examples/material-ui-remix-ts. The app, with a single
deployment, hosted in a Google Cloud function, serves HTML pages running in client browsers as well
as a Node.js "backend for frontend". The server code resides in the `load` and `action` functions of
the [routes](app/routes). The [MUI](https://mui.com) UX is responsive, working on desktop and mobile
browsers.

### Authentication

Users [sign in](app/routes/login.tsx) with [Firebase authentication](app/firebase.client.ts). We
store Google JWT token, augmented with a `customerId` claim, into our own
[cookie](app/utils/sessionCookie.server.ts), [validated](app/utils/authUtils.server.tsx) in our
server code. The current project doesn't do any other client-side Firebase call, relying exclusively
on fetchers to our backend for frontend.

### Backend for frontend

Backend performance relies on Firestore indexes and pagination
[query](app/firestore.server/fetchers.server.ts) cursors, typically timestamp windows, and
rudimentary Node.js local memory caches (no distributed memory cache such as Redis yet).

The project being in an exploratory phase, we keep most of the stored data "atomic" and do grouping
and aggregation post Firestore fetch, in backend on-demand [processors](app/processors/) or even in
browsers. This limits us to relatively short timestamp windows for now (1-2 weeks), to avoid
fetching too much atomic data, but allows for quick and agile product experiments.

See also the companion project, `@roakit/ingest`, a webhook listener adapting Jira, GetHub,
Confluence, etc. feeds into Firestore and GCS Roakit storage, consumed by this project.

### Compiler

Remix is in the process of switching to Vite. We try to get ready with a
[vite config](vite.config.js).

## Developer Notes

### Local Deployment

To run locally, add the following secrets to your `.env` file in the root directory of this project.

    FIREBASE_SERVICE_ACCOUNT={ "type": "service_account", "project_id": "eternal-impulse-412418", "private_key_id": ... }
    CLIENT_ID_KEY=...

- The JSON value of `FIREBASE_SERVICE_ACCOUNT` is generated from the
  [Firebase console](https://console.firebase.google.com/u/4/project/eternal-impulse-412418/settings/serviceaccounts/adminsdk)
  and formatted in one line.
- The string value of `CLIENT_ID_KEY` can be found in
  [Google Secret Management](https://console.cloud.google.com/security/secret-manager).

Then, `npm run local`

### Environments

- `eternal_impulse-412418` is the dev/stage project.
- `roakit-production` is the production project.

[`npm run local`](package.json) and [`npm run local:prod`](package.json) pass the environment to the
code via a `ROAKIT_ENV` env variable. So you can run locally against dev or prod data (for now). In
the cloud the `ROAKIT_ENV` value is read from
[.env.eternal-impulse-412418](functions/.env.eternal-impulse-412418) and
[.env.roakit-production](functions/.env.roakit-production). [client-env](app/client-env) injects the
configs into the code.

### Cloud Deployment

- `npm run deploy` and `npm run deploy:prod` will deploy the Remix app and its Cloud function
  ([see src](functions/src/index.ts))
  [Remix adapter](https://remix.run/docs/en/main/other-api/adapter) that will read the secrets
  `FIREBASE_SERVICE_ACCOUNT` and `CLIENT_ID_KEY` from
  [Google Secret Management](https://console.cloud.google.com/security/secret-manager).
