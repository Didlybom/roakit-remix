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

Then, `npm run dev`.

## Cloud Deployment

- `npm run build` (see [package.json scripts](package.json))
- `npm run deploy` will deploy the Remix app and its Cloud function
  ([see src](functions/src/index.ts))
  [Remix adapter](https://remix.run/docs/en/main/other-api/adapter) that will read the secrets
  mentionned above from
  [Google Secret Management](https://console.cloud.google.com/security/secret-manager?project=eternal-impulse-412418).
