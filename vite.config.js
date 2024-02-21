import { vitePlugin as remix } from '@remix-run/dev';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    remix({
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
      buildDirectory: 'functions/build/',
      serverBuildFile: 'remix.js',
    }),
  ],
});
