/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  devServerPort: 8002,
  // TODO: when mui has esm support, remove this (default is esm)
  // check it https://github.com/mui/material-ui/issues/30671
  serverModuleFormat: 'cjs',
  // for deployment to GCP
  appDirectory: 'app',
  assetsBuildDirectory: 'public/build',
  publicPath: '/',
  serverDependenciesToBundle: 'all',
  serverMinify: true,
  serverBuildPath: 'functions/build/remix.js',
};
