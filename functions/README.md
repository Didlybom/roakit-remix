# Cloud function to serve the Remix web app

The Remix app in the parent directory builds in this `functions/build` directory. This function is
an adapter to run the app. See
[remix-google-cloud-functions](https://remix.run/docs/en/main/other-api/adapter#community-adapters).

## Environment configuration

- The environment config is specified in `.env.PROJECT_ID` files following the instructions at
  https://firebase.google.com/docs/functions/config-env?gen=2nd#env-variables

- The secrets are read from Google Secret Manager. See
  https://firebase.google.com/docs/functions/config-env?gen=2nd#secret_parameters
