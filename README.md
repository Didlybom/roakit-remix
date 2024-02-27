# ROAKIT Prototype

Based on https://github.com/mui/material-ui/tree/master/examples/material-ui-remix-ts

## Local Development

To run locally, add the following secrets to your `.env` file in the root directory of this project.

    FIREBASE_SERVICE_ACCOUNT={ "type": "service_account", "project_id": "eternal-impulse-412418", "private_key_id": ........... }
    CLIENT_ID_KEY=gQrYw8b...........

- The JSON value of `FIREBASE_SERVICE_ACCOUNT` is generated from the
  [Firebase console](https://console.firebase.google.com/u/4/project/eternal-impulse-412418/settings/serviceaccounts/adminsdk)
  and formatted in one line.
- The string value of `CLIENT_ID_KEY` can be found in the `Liaison` project.

Then, `npm run local`.

## Environments

- `eternal_impulse-412418` is the dev/stage project.
- `roakit-production` is the production project.

[`npm run local`](package.json) and [`npm run local.prod`](package.json) pass the environment to the
code via a `ROAKTIV_ENV` env variable. So you can run locally against dev or prod data (for now). In
the cloud the `ROAKTIV_ENV` value is read from
[.env.eternal-impulse-412418](functions/.env.eternal-impulse-412418) and
[.env.roakit-production](functions/.env.roakit-production). [client-env](app/client-env) injects the
configs into the code.

## Cloud Deployment

- `npm run deploy` and `npm run deploy.prod` will deploy the Remix app and its Cloud function
  ([see src](functions/src/index.ts))
  [Remix adapter](https://remix.run/docs/en/main/other-api/adapter) that will read the secrets
  mentionned above from
  [Google Secret Management](https://console.cloud.google.com/security/secret-manager?project=eternal-impulse-412418).
